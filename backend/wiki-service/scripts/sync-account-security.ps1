[CmdletBinding()]
param(
    [string]$ServerUrl = 'http://localhost:8081',
    [string]$Realm = 'wikiaov',
    [string]$ClientId = 'wiki-service',
    # Server-only secret shared with wiki-service (WIKI_SERVICE_CLIENT_SECRET). Defaults to that environment variable.
    [SecureString]$ClientSecret,
    [PSCredential]$Credential,
    [switch]$DryRun
)

# Applies the Keycloak settings of ADR-028 to an existing realm; a fresh import already has the client part.
# - wiki-service: confidential client, service account with realm-management view-users/manage-users,
#   standard token exchange and an `account` audience mapper (device details of sessions).
# - Browser flow: recovery codes as an alternative to the authenticator code.
# - Identity providers: post-login flow that asks for the code when the account has two-step sign-in.
# - Required actions for authenticator, recovery codes and credential deletion stay enabled.
$ErrorActionPreference = 'Stop'
$server = [Uri]$ServerUrl
if ($server.Scheme -ne 'https' -and -not ($server.Scheme -eq 'http' -and $server.IsLoopback)) {
    throw 'Use HTTPS for non-local Keycloak servers.'
}
$postBrokerFlow = 'aov post broker 2fa'
$conditionalFlow = 'aov post broker 2fa conditional'
$requiredActions = @('CONFIGURE_TOTP', 'CONFIGURE_RECOVERY_AUTHN_CODES', 'delete_credential')
$serviceRoles = @('view-users', 'manage-users')
if ($DryRun) {
    [pscustomobject]@{
        Client = $ClientId; ServiceAccountRoles = $serviceRoles; TokenExchangeAudience = 'account'
        BrowserFlowRecoveryCodes = 'ALTERNATIVE'; PostBrokerLoginFlow = $postBrokerFlow; RequiredActions = $requiredActions
    }
    return
}
if (-not $ClientSecret) {
    if (-not $env:WIKI_SERVICE_CLIENT_SECRET) { throw 'Provide -ClientSecret or set WIKI_SERVICE_CLIENT_SECRET.' }
    $ClientSecret = ConvertTo-SecureString $env:WIKI_SERVICE_CLIENT_SECRET -AsPlainText -Force
}
if (-not $Credential) { $Credential = Get-Credential -UserName 'admin' -Message 'Keycloak master realm administrator' }
$base = $ServerUrl.TrimEnd('/')
$headers = $null
$session = $null
try {
    $session = Invoke-RestMethod -Method Post -Uri "$base/realms/master/protocol/openid-connect/token" -TimeoutSec 30 -Body @{
        client_id = 'admin-cli'; grant_type = 'password'; username = $Credential.UserName
        password = $Credential.GetNetworkCredential().Password
    }
    $headers = @{Authorization = "Bearer $($session.access_token)"}
    $api = "$base/admin/realms/$([Uri]::EscapeDataString($Realm))"
    function Invoke-Admin([string]$Method, [string]$Path, $Body = $null) {
        Write-Verbose "$Method $Path"
        $arguments = @{Method = $Method; Uri = "$api$Path"; Headers = $headers; TimeoutSec = 30}
        if ($null -ne $Body) { $arguments.ContentType = 'application/json'; $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 12 -Compress }
        $response = Invoke-RestMethod @arguments
        if ($null -ne $response) { $response | Write-Output }
    }
    function Get-Executions([string]$Flow) { @(Invoke-Admin GET "/authentication/flows/$([Uri]::EscapeDataString($Flow))/executions") }

    # 1. Confidential client with service account and token exchange.
    $found = @(Invoke-Admin GET "/clients?clientId=$([Uri]::EscapeDataString($ClientId))" | Where-Object clientId -eq $ClientId)
    if ($found.Count -ne 1) { throw "Expected exactly one $ClientId client." }
    $client = $found[0]
    $attributes = @{}
    foreach ($attribute in $client.attributes.PSObject.Properties) { $attributes[$attribute.Name] = $attribute.Value }
    $attributes['standard.token.exchange.enabled'] = 'true'
    $plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($ClientSecret))
    try {
        $null = Invoke-Admin PUT "/clients/$($client.id)" @{
            id = $client.id; clientId = $ClientId; enabled = $true; publicClient = $false; bearerOnly = $false
            standardFlowEnabled = $false; implicitFlowEnabled = $false; directAccessGrantsEnabled = $false
            serviceAccountsEnabled = $true; secret = $plainSecret; attributes = $attributes
        }
    } finally { $plainSecret = $null }
    $mapper = @{
        name = 'audience-account'; protocol = 'openid-connect'; protocolMapper = 'oidc-audience-mapper'
        config = @{'included.client.audience' = 'account'; 'access.token.claim' = 'true'; 'id.token.claim' = 'false'; 'introspection.token.claim' = 'true'}
    }
    $existing = @(Invoke-Admin GET "/clients/$($client.id)/protocol-mappers/models" | Where-Object name -eq $mapper.name)
    if ($existing.Count) {
        $mapper.id = $existing[0].id
        $null = Invoke-Admin PUT "/clients/$($client.id)/protocol-mappers/models/$($mapper.id)" $mapper
    } else { $null = Invoke-Admin POST "/clients/$($client.id)/protocol-mappers/models" $mapper }

    # 2. Service account roles: exactly what account security needs.
    $serviceUser = Invoke-Admin GET "/clients/$($client.id)/service-account-user"
    $management = @(Invoke-Admin GET '/clients?clientId=realm-management' | Where-Object clientId -eq 'realm-management')[0]
    $roles = @($serviceRoles | ForEach-Object { Invoke-Admin GET "/clients/$($management.id)/roles/$_" })
    $null = Invoke-Admin POST "/users/$($serviceUser.id)/role-mappings/clients/$($management.id)" $roles

    # 3. Recovery codes beside the authenticator code in the browser flow.
    $realmSettings = Invoke-Admin GET ''
    $recovery = @(Get-Executions $realmSettings.browserFlow | Where-Object providerId -eq 'auth-recovery-authn-code-form')
    if ($recovery.Count -ne 1) { throw 'The browser flow lacks the recovery code form; review the flow manually.' }
    if ($recovery[0].requirement -ne 'ALTERNATIVE') {
        $recovery[0].requirement = 'ALTERNATIVE'
        $null = Invoke-Admin PUT "/authentication/flows/$([Uri]::EscapeDataString($realmSettings.browserFlow))/executions" $recovery[0]
    }

    # 4. Post-login flow for identity providers: ask for the code only when the account has one.
    $flows = @(Invoke-Admin GET '/authentication/flows')
    if (-not ($flows | Where-Object alias -eq $postBrokerFlow)) {
        $null = Invoke-Admin POST '/authentication/flows' @{
            alias = $postBrokerFlow; description = 'Two-step sign-in after an identity provider (ADR-028)'
            providerId = 'basic-flow'; topLevel = $true; builtIn = $false
        }
        $null = Invoke-Admin POST "/authentication/flows/$([Uri]::EscapeDataString($postBrokerFlow))/executions/flow" @{
            alias = $conditionalFlow; type = 'basic-flow'; provider = 'registration-page-form'; description = 'Authenticator or recovery code'
        }
        foreach ($provider in @('conditional-user-configured', 'auth-otp-form', 'auth-recovery-authn-code-form')) {
            $null = Invoke-Admin POST "/authentication/flows/$([Uri]::EscapeDataString($conditionalFlow))/executions/execution" @{provider = $provider}
        }
        $requirements = @{
            $conditionalFlow = 'CONDITIONAL'; 'conditional-user-configured' = 'REQUIRED'
            'auth-otp-form' = 'ALTERNATIVE'; 'auth-recovery-authn-code-form' = 'ALTERNATIVE'
        }
        foreach ($execution in Get-Executions $postBrokerFlow) {
            $key = if ($execution.authenticationFlow) { $execution.displayName } else { $execution.providerId }
            if ($requirements.ContainsKey($key) -and $execution.requirement -ne $requirements[$key]) {
                $execution.requirement = $requirements[$key]
                $null = Invoke-Admin PUT "/authentication/flows/$([Uri]::EscapeDataString($postBrokerFlow))/executions" $execution
            }
        }
    }
    # Keycloak fails a top-level flow in which nothing ran, which is the case for an account without two-step sign-in
    # once the conditional sub-flow is skipped. A required "Allow access" step after it ends the flow successfully.
    # It must stay REQUIRED: an ALTERNATIVE step would be offered under "Try another way" and skip the code.
    $allowAccess = @(Get-Executions $postBrokerFlow | Where-Object { $_.level -eq 0 -and $_.providerId -eq 'allow-access-authenticator' })
    if (-not $allowAccess.Count) {
        $null = Invoke-Admin POST "/authentication/flows/$([Uri]::EscapeDataString($postBrokerFlow))/executions/execution" @{provider = 'allow-access-authenticator'}
        $allowAccess = @(Get-Executions $postBrokerFlow | Where-Object { $_.level -eq 0 -and $_.providerId -eq 'allow-access-authenticator' })
    }
    if ($allowAccess[0].requirement -ne 'REQUIRED') {
        $allowAccess[0].requirement = 'REQUIRED'
        $null = Invoke-Admin PUT "/authentication/flows/$([Uri]::EscapeDataString($postBrokerFlow))/executions" $allowAccess[0]
    }
    foreach ($provider in @(Invoke-Admin GET '/identity-provider/instances')) {
        if ($provider.postBrokerLoginFlowAlias -ne $postBrokerFlow) {
            $provider | Add-Member -NotePropertyName postBrokerLoginFlowAlias -NotePropertyValue $postBrokerFlow -Force
            $null = Invoke-Admin PUT "/identity-provider/instances/$([Uri]::EscapeDataString($provider.alias))" $provider
        }
    }

    # 5. Required actions used through kc_action.
    foreach ($alias in $requiredActions) {
        $action = Invoke-Admin GET "/authentication/required-actions/$alias"
        if (-not $action.enabled) {
            $action.enabled = $true
            $null = Invoke-Admin PUT "/authentication/required-actions/$alias" $action
        }
    }

    $verified = Invoke-Admin GET "/clients/$($client.id)"
    if ($verified.publicClient -or -not $verified.serviceAccountsEnabled -or $verified.directAccessGrantsEnabled -or
        $verified.standardFlowEnabled -or $verified.attributes.'standard.token.exchange.enabled' -ne 'true') {
        throw 'wiki-service client verification failed.'
    }
    $steps = @(Get-Executions $postBrokerFlow | ForEach-Object { "$($_.displayName)=$($_.requirement)" })
    Write-Host "Account security configured for $Realm. Post-login flow: $($steps -join ', ')."
} finally {
    $headers = $null
    $session = $null
    $Credential = $null
}

[CmdletBinding()]
param(
    [string]$ServerUrl = 'http://localhost:8081',
    [string]$Realm = 'wikiaov',
    [string]$TargetUsername = 'admin',
    [PSCredential]$Credential,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$server = [Uri]$ServerUrl
if ($server.Scheme -ne 'https' -and -not ($server.Scheme -eq 'http' -and $server.IsLoopback)) {
    throw 'Use HTTPS for non-local Keycloak servers.'
}
$required = @('tournament:read', 'tournament:write', 'tournament:publish')
$audienceClients = @('admin-aov', 'admin-aov-backend', 'wiki-local-cli')
if ($DryRun) {
    [pscustomobject]@{ Realm = $Realm; ResourceClient = 'community-service'; Capabilities = $required; AudienceClients = $audienceClients }
    return
}
if (-not $Credential) { $Credential = Get-Credential -UserName 'admin' -Message 'Keycloak master realm administrator' }
$base = $ServerUrl.TrimEnd('/')
$realmPath = [Uri]::EscapeDataString($Realm)
$token = $null
$headers = $null
try {
    $identitySession = @{ Headers = $null; ExpiresAt = [DateTimeOffset]::MinValue }
    function Renew-AdminSession {
        $response = Invoke-RestMethod -Method Post -Uri "$base/realms/master/protocol/openid-connect/token" -TimeoutSec 30 -Body @{
            client_id = 'admin-cli'
            grant_type = 'password'
            username = $Credential.UserName
            password = $Credential.GetNetworkCredential().Password
        }
        $identitySession.Headers = @{ Authorization = "Bearer $($response.access_token)" }
        $identitySession.ExpiresAt = [DateTimeOffset]::UtcNow.AddSeconds([Math]::Max(1, $response.expires_in - 10))
    }
    $api = "$base/admin/realms/$realmPath"
    function Invoke-Admin([string]$Method, [string]$Path, $Body = $null) {
        if ([DateTimeOffset]::UtcNow -ge $identitySession.ExpiresAt) { Renew-AdminSession }
        Write-Verbose "$Method $Path"
        $arguments = @{ Method = $Method; Uri = "$api/$Path"; Headers = $identitySession.Headers; TimeoutSec = 30 }
        if ($null -ne $Body) {
            $arguments.ContentType = 'application/json'
            $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 16 -Compress
        }
        try {
            $response = Invoke-RestMethod @arguments
        } catch {
            if ([int]$_.Exception.Response.StatusCode -ne 401) { throw }
            Renew-AdminSession
            $arguments.Headers = $identitySession.Headers
            $response = Invoke-RestMethod @arguments
        }
        if ($null -ne $response) { $response | Write-Output }
    }
    function Find-Client([string]$Name) {
        $found = @(Invoke-Admin GET "clients?clientId=$([Uri]::EscapeDataString($Name))" | Where-Object clientId -eq $Name)
        if ($found.Count -ne 1) { throw "Expected one client: $Name" }
        return $found[0]
    }
    function Add-Composites([string]$RoleName, [array]$Roles) {
        $existing = @(Invoke-Admin GET "roles/$RoleName/composites")
        $missing = @($Roles | Where-Object { $_.id -notin $existing.id })
        if ($missing.Count) { $null = Invoke-Admin POST "roles/$RoleName/composites" $missing }
    }

    # Resolve the existing gateway and user before creating scoped capabilities.
    $targets = @($audienceClients | ForEach-Object { Find-Client $_ })
    $wikiClient = Find-Client 'wiki-service'
    $users = @(Invoke-Admin GET "users?username=$([Uri]::EscapeDataString($TargetUsername))&exact=true" | Where-Object username -eq $TargetUsername)
    if ($users.Count -ne 1) { throw 'Expected exactly one existing target user.' }
    $null = Invoke-Admin GET 'roles/wiki-admin'

    $clients = @(Invoke-Admin GET 'clients?clientId=community-service' | Where-Object clientId -eq 'community-service')
    if (-not $clients.Count) {
        $null = Invoke-Admin POST 'clients' @{
            clientId = 'community-service'; name = 'community-service (resource server)'; enabled = $true
            publicClient = $true; standardFlowEnabled = $false; directAccessGrantsEnabled = $false; serviceAccountsEnabled = $false
        }
    }
    $communityClient = Find-Client 'community-service'
    $roles = @(Invoke-Admin GET "clients/$($communityClient.id)/roles")
    foreach ($name in $required) {
        if ($name -notin $roles.name) { $null = Invoke-Admin POST "clients/$($communityClient.id)/roles" @{name = $name; description = "Capability $name"} }
    }
    $roles = @($required | ForEach-Object { Invoke-Admin GET "clients/$($communityClient.id)/roles/$([Uri]::EscapeDataString($_))" })
    $realmRoles = @(Invoke-Admin GET 'roles')
    foreach ($name in @('community-editor', 'community-publisher', 'community-admin')) {
        if ($name -notin $realmRoles.name) { $null = Invoke-Admin POST 'roles' @{name = $name; description = "Community application role $name"; composite = $true} }
    }

    $catalogRead = Invoke-Admin GET "clients/$($wikiClient.id)/roles/catalog%3Aread"
    Add-Composites 'community-editor' @($catalogRead, ($roles | Where-Object name -eq 'tournament:read'), ($roles | Where-Object name -eq 'tournament:write'))
    Add-Composites 'community-publisher' @((Invoke-Admin GET 'roles/community-editor'), ($roles | Where-Object name -eq 'tournament:publish'))
    Add-Composites 'community-admin' @((Invoke-Admin GET 'roles/community-publisher'))
    Add-Composites 'wiki-admin' @((Invoke-Admin GET 'roles/community-admin'))

    foreach ($client in $targets) {
        $mappers = @(Invoke-Admin GET "clients/$($client.id)/protocol-mappers/models")
        $existing = @($mappers | Where-Object name -eq 'audience-community-service')
        if ($existing.Count -gt 1) { throw 'Duplicate community audience mappers require manual review.' }
        $mapper = @{
            name = 'audience-community-service'; protocol = 'openid-connect'; protocolMapper = 'oidc-audience-mapper'
            config = @{'included.client.audience' = 'community-service'; 'access.token.claim' = 'true'; 'id.token.claim' = 'false'; 'introspection.token.claim' = 'true'}
        }
        if (-not $existing.Count) {
            $null = Invoke-Admin POST "clients/$($client.id)/protocol-mappers/models" $mapper
        } elseif ($existing[0].protocolMapper -ne $mapper.protocolMapper -or
                $existing[0].config.'included.client.audience' -ne 'community-service' -or
                $existing[0].config.'access.token.claim' -ne 'true' -or
                $existing[0].config.'id.token.claim' -ne 'false' -or
                $existing[0].config.'introspection.token.claim' -ne 'true') {
            $mapper.id = $existing[0].id
            $null = Invoke-Admin PUT "clients/$($client.id)/protocol-mappers/models/$($existing[0].id)" $mapper
        }
    }

    $effective = @(Invoke-Admin GET "users/$($users[0].id)/role-mappings/clients/$($communityClient.id)/composite")
    foreach ($name in $required) {
        if ($name -notin $effective.name) { throw "The target user lacks $name. Assign community-admin or wiki-admin before retrying." }
    }
    Write-Host "Verified community-service roles for ${Realm}/${TargetUsername}. Sign in again to refresh the session."
} finally {
    $headers = $null
    $token = $null
    if ($identitySession) { $identitySession.Clear() }
    $Credential = $null
}

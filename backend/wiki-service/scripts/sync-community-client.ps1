[CmdletBinding()]
param(
    [string]$ServerUrl = 'http://localhost:8081',
    [string]$Realm = 'wikiaov',
    [string]$Origin = 'http://localhost:5174',
    [PSCredential]$Credential,
    [switch]$EnableRegistration,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
foreach ($value in @($ServerUrl, $Origin)) {
    $uri = [Uri]$value
    if ($uri.Scheme -ne 'https' -and -not ($uri.Scheme -eq 'http' -and $uri.IsLoopback)) {
        throw 'Use HTTPS for non-local endpoints.'
    }
    if ($uri.UserInfo -or $uri.Query -or $uri.Fragment -or $uri.AbsolutePath -ne '/') { throw 'Use an origin without path, credentials, query or fragment.' }
}
$client = @{
    clientId = 'aov-stream'; name = 'AthaHub Community'; enabled = $true; publicClient = $true
    standardFlowEnabled = $true; implicitFlowEnabled = $false; directAccessGrantsEnabled = $false; serviceAccountsEnabled = $false
    redirectUris = @("$($Origin.TrimEnd('/'))/auth/callback"); webOrigins = @($Origin.TrimEnd('/'))
    attributes = @{'pkce.code.challenge.method' = 'S256'; 'post.logout.redirect.uris' = "$($Origin.TrimEnd('/'))/pages"}
}
# community-service serves pages and tournaments; wiki-service serves the shared user profile (ADR-008).
$audiences = @('community-service', 'wiki-service')
if ($DryRun) { [pscustomobject]@{Client = $client; Audiences = $audiences}; return }
if (-not $Credential) { $Credential = Get-Credential -UserName 'admin' -Message 'Keycloak master realm administrator' }
$sessionHeaders = $null
try {
    $sessionResponse = Invoke-RestMethod -Method Post -Uri "$($ServerUrl.TrimEnd('/'))/realms/master/protocol/openid-connect/token" -TimeoutSec 30 -Body @{
        client_id = 'admin-cli'; grant_type = 'password'; username = $Credential.UserName; password = $Credential.GetNetworkCredential().Password
    }
    $sessionHeaders = @{Authorization = "Bearer $($sessionResponse.access_token)"}
    $api = "$($ServerUrl.TrimEnd('/'))/admin/realms/$([Uri]::EscapeDataString($Realm))"
    function Invoke-ClientAdmin([string]$Method, [string]$Path, $Body = $null) {
        Write-Verbose "$Method $Path"
        $arguments = @{Method = $Method; Uri = "$api$Path"; Headers = $sessionHeaders; TimeoutSec = 30}
        if ($null -ne $Body) { $arguments.ContentType = 'application/json'; $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 12 -Compress }
        $response = Invoke-RestMethod @arguments
        if ($null -ne $response) { $response | Write-Output }
    }
    $found = @(Invoke-ClientAdmin GET '/clients?clientId=aov-stream' | Where-Object clientId -eq 'aov-stream')
    if ($found.Count -gt 1) { throw 'Expected at most one community client.' }
    if ($found.Count) {
        $client.id = $found[0].id
        $null = Invoke-ClientAdmin PUT "/clients/$($client.id)" $client
    } else {
        $null = Invoke-ClientAdmin POST '/clients' $client
        $found = @(Invoke-ClientAdmin GET '/clients?clientId=aov-stream' | Where-Object clientId -eq 'aov-stream')
        $client.id = $found[0].id
    }
    foreach ($audience in $audiences) {
        $mapper = @{
            name = "audience-$audience"; protocol = 'openid-connect'; protocolMapper = 'oidc-audience-mapper'
            config = @{'included.client.audience' = $audience; 'access.token.claim' = 'true'; 'id.token.claim' = 'false'}
        }
        $existing = @(Invoke-ClientAdmin GET "/clients/$($client.id)/protocol-mappers/models" | Where-Object name -eq $mapper.name)
        if ($existing.Count -gt 1) { throw 'Duplicate audience mappers require review.' }
        if ($existing.Count) {
            $mapper.id = $existing[0].id
            $null = Invoke-ClientAdmin PUT "/clients/$($client.id)/protocol-mappers/models/$($mapper.id)" $mapper
        } else { $null = Invoke-ClientAdmin POST "/clients/$($client.id)/protocol-mappers/models" $mapper }
    }
    if ($EnableRegistration) { $null = Invoke-ClientAdmin PUT '' @{registrationAllowed = $true} }
    $verified = Invoke-ClientAdmin GET "/clients/$($client.id)"
    if (-not $verified.publicClient -or $verified.attributes.'pkce.code.challenge.method' -ne 'S256' -or $verified.directAccessGrantsEnabled) { throw 'Community client verification failed.' }
    $configured = @(Invoke-ClientAdmin GET "/clients/$($client.id)/protocol-mappers/models" | ForEach-Object { $_.config.'included.client.audience' })
    foreach ($audience in $audiences) { if ($configured -notcontains $audience) { throw "Community client lacks the $audience audience." } }
    Write-Host 'Community client configured with exact redirect URI, PKCE and community-service/wiki-service audiences. No roles were granted.'
} finally {
    $sessionHeaders = $null
    $sessionResponse = $null
    $Credential = $null
}

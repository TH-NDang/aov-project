param(
    [string]$ServerUrl = 'http://localhost:8081',
    [string]$Realm = 'wikiaov',
    [string]$TargetUsername = 'admin',
    [PSCredential]$Credential
)

$ErrorActionPreference = 'Stop'
$server = [Uri]$ServerUrl
if ($server.Scheme -ne 'https' -and -not ($server.Scheme -eq 'http' -and $server.IsLoopback)) {
    throw 'Use HTTPS for non-local Keycloak servers.'
}
if (-not $Credential) {
    $Credential = Get-Credential -UserName 'admin' -Message 'Keycloak master realm administrator'
}
$base = $ServerUrl.TrimEnd('/')
$realmPath = [Uri]::EscapeDataString($Realm)
$headers = $null
$token = $null
try {
    $token = Invoke-RestMethod -Method Post -Uri "$base/realms/master/protocol/openid-connect/token" -TimeoutSec 30 -Body @{
        client_id = 'admin-cli'
        grant_type = 'password'
        username = $Credential.UserName
        password = $Credential.GetNetworkCredential().Password
    }
    $headers = @{ Authorization = "Bearer $($token.access_token)" }
    $api = "$base/admin/realms/$realmPath"
    function Invoke-Admin([string]$Method, [string]$Path, $Body = $null) {
        $arguments = @{
            Method = $Method
            Uri = "$api/$Path"
            Headers = $headers
            TimeoutSec = 30
        }
        if ($null -ne $Body) {
            $arguments.ContentType = 'application/json'
            $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 12 -Compress
        }
        $response = Invoke-RestMethod @arguments
        if ($null -ne $response) { $response | Write-Output }
    }

    # Resolve all targets before changing roles; never create or reset user accounts.
    $clients = @(Invoke-Admin GET 'clients?clientId=wiki-service' | Where-Object clientId -eq 'wiki-service')
    $username = [Uri]::EscapeDataString($TargetUsername)
    $users = @(Invoke-Admin GET "users?username=$username&exact=true" | Where-Object username -eq $TargetUsername)
    if ($clients.Count -ne 1 -or $users.Count -ne 1) {
        throw 'Expected exactly one wiki-service client and one target user.'
    }
    $null = Invoke-Admin GET 'roles/wiki-admin'
    $clientId = $clients[0].id
    $userId = $users[0].id
    $existing = @(Invoke-Admin GET "clients/$clientId/roles")
    $required = @('user:read', 'user:write')
    foreach ($name in $required) {
        if ($name -notin $existing.name) {
            $null = Invoke-Admin POST "clients/$clientId/roles" @{ name = $name; description = "Capability $name" }
            Write-Host "Created role: $name"
        }
    }
    $roles = @(foreach ($name in $required) {
        Invoke-Admin GET "clients/$clientId/roles/$([Uri]::EscapeDataString($name))"
    })
    $composites = @(Invoke-Admin GET "roles/wiki-admin/composites/clients/$clientId")
    $missing = @($roles | Where-Object { $_.id -notin $composites.id })
    if ($missing.Count -gt 0) {
        $null = Invoke-Admin POST 'roles/wiki-admin/composites' $missing
        Write-Host 'Updated wiki-admin composite.'
    }
    $effective = @(Invoke-Admin GET "users/$userId/role-mappings/clients/$clientId/composite")
    $missing = @($roles | Where-Object { $_.id -notin $effective.id })
    if ($missing.Count -gt 0) {
        $null = Invoke-Admin POST "users/$userId/role-mappings/clients/$clientId" $missing
        Write-Host "Assigned missing profile roles to $TargetUsername."
    }
    $verified = @(Invoke-Admin GET "users/$userId/role-mappings/clients/$clientId/composite")
    foreach ($name in $required) {
        if ($name -notin $verified.name) { throw "Role verification failed: $name" }
    }
    Write-Host "Verified ${Realm}/${TargetUsername}: user:read, user:write. Sign in again to refresh permissions."
} finally {
    $headers = $null
    $token = $null
    $Credential = $null
}

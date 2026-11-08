param(
    [string]$ServerUrl = 'http://localhost:8081',
    [string]$Realm = 'wikiaov',
    [PSCredential]$Credential,
    [switch]$DryRun
)

# Adds the game mode capabilities (ADR-023) to a realm that was imported before they existed:
# gamemode:write joins the wiki-editor composite, gamemode:publish joins wiki-publisher.
# It never creates users, resets passwords or assigns roles to individual accounts.
$ErrorActionPreference = 'Stop'
$server = [Uri]$ServerUrl
if ($server.Scheme -ne 'https' -and -not ($server.Scheme -eq 'http' -and $server.IsLoopback)) {
    throw 'Use HTTPS for non-local Keycloak servers.'
}
$plan = [ordered]@{ 'gamemode:write' = 'wiki-editor'; 'gamemode:publish' = 'wiki-publisher' }
if ($DryRun) { [pscustomobject]$plan; return }
if (-not $Credential) {
    $Credential = Get-Credential -UserName 'admin' -Message 'Keycloak master realm administrator'
}
$base = $ServerUrl.TrimEnd('/')
$headers = $null
try {
    $token = Invoke-RestMethod -Method Post -Uri "$base/realms/master/protocol/openid-connect/token" -TimeoutSec 30 -Body @{
        client_id = 'admin-cli'
        grant_type = 'password'
        username = $Credential.UserName
        password = $Credential.GetNetworkCredential().Password
    }
    $headers = @{ Authorization = "Bearer $($token.access_token)" }
    $api = "$base/admin/realms/$([Uri]::EscapeDataString($Realm))"
    function Invoke-Admin([string]$Method, [string]$Path, $Body = $null) {
        $arguments = @{ Method = $Method; Uri = "$api/$Path"; Headers = $headers; TimeoutSec = 30 }
        if ($null -ne $Body) {
            $arguments.ContentType = 'application/json'
            $arguments.Body = ConvertTo-Json -InputObject $Body -Depth 12 -Compress
        }
        $response = Invoke-RestMethod @arguments
        if ($null -ne $response) { $response | Write-Output }
    }

    $clients = @(Invoke-Admin GET 'clients?clientId=wiki-service' | Where-Object clientId -eq 'wiki-service')
    if ($clients.Count -ne 1) { throw 'Expected exactly one wiki-service client.' }
    $clientId = $clients[0].id
    $existing = @(Invoke-Admin GET "clients/$clientId/roles")
    foreach ($name in $plan.Keys) {
        if ($name -notin $existing.name) {
            $null = Invoke-Admin POST "clients/$clientId/roles" @{ name = $name; description = "Capability $name" }
            Write-Host "Created role: $name"
        }
        $role = Invoke-Admin GET "clients/$clientId/roles/$([Uri]::EscapeDataString($name))"
        $composite = $plan[$name]
        $current = @(Invoke-Admin GET "roles/$composite/composites/clients/$clientId")
        if ($role.id -notin $current.id) {
            $null = Invoke-Admin POST "roles/$composite/composites" @($role)
            Write-Host "Added $name to $composite."
        }
    }
    foreach ($name in $plan.Keys) {
        $current = @(Invoke-Admin GET "roles/$($plan[$name])/composites/clients/$clientId")
        if ($name -notin $current.name) { throw "Role verification failed: $name" }
    }
    Write-Host 'Game mode roles are in place. Sign in again to receive them in a new token.'
} finally {
    $headers = $null
    $token = $null
}

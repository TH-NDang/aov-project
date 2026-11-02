$ErrorActionPreference = 'Stop'
$serviceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$initialize = Join-Path $PSScriptRoot 'initialize-community-database.ps1'
$synchronize = Join-Path $serviceDirectory 'scripts/sync-community-roles.ps1'
$streamClient = Join-Path $serviceDirectory 'scripts/sync-community-client.ps1'

foreach ($path in @($initialize, $synchronize, $streamClient)) {
    $parseTokens = $null
    $parseErrors = $null
    $null = [Management.Automation.Language.Parser]::ParseFile($path, [ref]$parseTokens, [ref]$parseErrors)
    if ($parseErrors.Count) { throw ($parseErrors.Message -join [Environment]::NewLine) }
}

$preview = & $initialize -DryRun
if ($preview.Database -ne 'community' -or $preview.Role -ne 'community' -or $preview.ExistingData -ne 'Preserved') {
    throw 'The database preview did not preserve the expected isolated storage contract.'
}
foreach ($arguments in @(
    @{CommunityDatabase = 'wiki'},
    @{CommunityUser = 'wiki'},
    @{CommunityDatabase = 'community;drop'},
    @{CommunityUser = 'community-user'},
    @{CommunityPassword = ''}
)) {
    $rejected = $false
    try { $null = & $initialize @arguments -DryRun } catch { $rejected = $true }
    if (-not $rejected) { throw 'An unsafe database setup argument was accepted.' }
}

$rolesPreview = & $synchronize -DryRun
if ($rolesPreview.ResourceClient -ne 'community-service' -or $rolesPreview.Capabilities.Count -ne 3) {
    throw 'The identity preview did not expose the three scoped tournament capabilities.'
}
$realm = Get-Content -LiteralPath (Join-Path $serviceDirectory 'infra/local/keycloak/wikiaov-realm.json') -Raw | ConvertFrom-Json
$resource = @($realm.clients | Where-Object clientId -eq 'community-service')
if ($resource.Count -ne 1 -or $resource[0].standardFlowEnabled -or $resource[0].directAccessGrantsEnabled -or $resource[0].serviceAccountsEnabled) {
    throw 'The community resource client must not start an authentication flow.'
}
foreach ($clientName in @('admin-aov', 'admin-aov-backend', 'wiki-local-cli')) {
    $client = @($realm.clients | Where-Object clientId -eq $clientName)
    $mapper = @($client[0].protocolMappers | Where-Object name -eq 'audience-community-service')
    if ($client.Count -ne 1 -or $mapper.Count -ne 1 -or $mapper[0].config.'included.client.audience' -ne 'community-service') {
        throw "The local authentication client lacks its community audience: $clientName"
    }
}
$stream = @($realm.clients | Where-Object clientId -eq 'aov-stream')
$streamAudiences = @($stream[0].protocolMappers | ForEach-Object { $_.config.'included.client.audience' })
if ($stream.Count -ne 1 -or -not $stream[0].publicClient -or $stream[0].directAccessGrantsEnabled -or $stream[0].serviceAccountsEnabled -or
    $stream[0].attributes.'pkce.code.challenge.method' -ne 'S256' -or
    (Compare-Object $streamAudiences @('community-service', 'wiki-service'))) {
    throw 'The stream client must be a PKCE public client for the community and shared profile APIs only.'
}
$clientPreview = & $streamClient -DryRun
if (Compare-Object $clientPreview.Audiences $streamAudiences) {
    throw 'The stream client synchronization must grant the same audiences as the local realm.'
}
$importer = $realm.clients | Where-Object clientId -eq 'wiki-importer'
if (@($importer.protocolMappers | Where-Object name -eq 'audience-community-service').Count) {
    throw 'The wiki importer must not receive community access.'
}
Write-Host 'Community setup checks passed.'

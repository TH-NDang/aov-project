$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'start-local.ps1'

function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    if (-not $failed) { throw $Message }
}

$parseTokens = $null
$parseErrors = $null
$null = [Management.Automation.Language.Parser]::ParseFile($launcher, [ref]$parseTokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors.Message -join [Environment]::NewLine) }

$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixtureDirectory = Join-Path $temporaryRoot ('community-local-environment-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null
$secret = 'fixture-' + [Guid]::NewGuid().ToString('N')
try {
    $fixture = Join-Path $fixtureDirectory '.env'
    [IO.File]::WriteAllLines($fixture, @(
        '# Literal configuration of community-service.',
        'SERVER_PORT=8092',
        ('YOUTUBE_API_KEY=' + $secret),
        'COMMUNITY_EXCHANGE_RATES_ENABLED=false'
    ))

    $plan = & $launcher -EnvironmentFile $fixture -SkipDatabaseSetup -DryRun
    $keys = @($plan.EnvironmentKeys)
    if (Compare-Object $keys @('COMMUNITY_EXCHANGE_RATES_ENABLED', 'SERVER_PORT', 'YOUTUBE_API_KEY')) {
        throw 'The dry run must list every variable of the environment file by name.'
    }
    if ($plan.DatabaseSetup) { throw 'The dry run must report that the database setup is skipped.' }
    if (($plan | ConvertTo-Json -Depth 5).Contains($secret)) { throw 'The dry run must never print a value.' }

    Assert-Throws { & $launcher -EnvironmentFile (Join-Path $fixtureDirectory 'missing.env') -DryRun } 'The launcher must stop when its explicit configuration file is missing.'

    [IO.File]::WriteAllLines($fixture, @('YOUTUBE_API_KEY=one', 'YOUTUBE_API_KEY=two'))
    Assert-Throws { & $launcher -EnvironmentFile $fixture -DryRun } 'A variable set twice must fail early.'
} finally {
    Remove-Item -LiteralPath $fixtureDirectory -Recurse -Force -ErrorAction SilentlyContinue
}
Write-Host 'Community launcher checks passed.'

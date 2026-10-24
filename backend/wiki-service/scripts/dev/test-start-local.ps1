$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LocalEnvironment.psm1') -Force

function Assert-Equal($Actual, $Expected, [string]$Message) {
    if ($Actual -cne $Expected) { throw $Message }
}

function Assert-Throws([scriptblock]$Action, [string]$Message) {
    $failed = $false
    try { & $Action | Out-Null } catch { $failed = $true }
    if (-not $failed) { throw $Message }
}

$temporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$fixtureDirectory = Join-Path $temporaryRoot ('wiki-local-environment-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $fixtureDirectory | Out-Null
try {
    $fixture = Join-Path $fixtureDirectory '.env'
    $probe = Join-Path $fixtureDirectory 'must-not-exist.txt'
    $literal = '$(Set-Content -LiteralPath "' + $probe + '" -Value unsafe)'
    [IO.File]::WriteAllLines($fixture, @(
        '# Literal configuration, not a shell script.',
        'POSTGRES_DB=example',
        'POSTGRES_USER=file-user',
        'POSTGRES_PASSWORD="file # secret"',
        ('export ADMIN_AUTH_CLIENT_SECRET=' + $literal),
        'REDIS_USERNAME=',
        'REDIS_HOST=cache # ignored comment'
    ))
    $fileValues = Read-LocalEnvironmentFile $fixture
    Assert-Equal $fileValues['POSTGRES_PASSWORD'] 'file # secret' 'Quoted hashes must stay literal.'
    Assert-Equal $fileValues['ADMIN_AUTH_CLIENT_SECRET'] $literal 'Shell-looking values must stay inert data.'
    Assert-Equal $fileValues['REDIS_USERNAME'] '' 'Empty values must remain explicit.'
    Assert-Equal $fileValues['REDIS_HOST'] 'cache' 'Unquoted trailing comments must be removed.'
    if (Test-Path -LiteralPath $probe) { throw 'Reading configuration executed file contents.' }

    $resolved = Resolve-LocalEnvironment -FileValues $fileValues -ProcessValues @{}
    Assert-Equal $resolved['DB_URL'] 'jdbc:postgresql://localhost:5432/example' 'The database name must match Compose.'
    Assert-Equal $resolved['DB_USERNAME'] 'file-user' 'The database user must match Compose.'
    Assert-Equal $resolved['DB_PASSWORD'] 'file # secret' 'The database password must match Compose.'
    foreach ($emptySource in @(
        @{
            FileValues = @{ POSTGRES_DB = ''; POSTGRES_USER = ''; POSTGRES_PASSWORD = '' }
            ProcessValues = @{}
        },
        @{
            FileValues = @{ POSTGRES_DB = 'file-db'; POSTGRES_USER = 'file-user'; POSTGRES_PASSWORD = 'file-password' }
            ProcessValues = @{ POSTGRES_DB = ''; POSTGRES_USER = ''; POSTGRES_PASSWORD = '' }
        }
    )) {
        $resolved = Resolve-LocalEnvironment @emptySource
        Assert-Equal $resolved['DB_URL'] 'jdbc:postgresql://localhost:5432/wiki' 'Empty Compose database values must use the Compose default.'
        Assert-Equal $resolved['DB_USERNAME'] 'wiki' 'Empty Compose usernames must use the Compose default.'
        Assert-Equal $resolved['DB_PASSWORD'] 'wiki-local' 'Empty Compose passwords must use the Compose default.'
    }
    foreach ($explicitSource in @(
        @{
            FileValues = @{ DB_URL = ''; DB_USERNAME = ''; DB_PASSWORD = '' }
            ProcessValues = @{}
        },
        @{
            FileValues = @{ DB_URL = 'file-url'; DB_USERNAME = 'file-user'; DB_PASSWORD = 'file-password' }
            ProcessValues = @{ DB_URL = ''; DB_USERNAME = ''; DB_PASSWORD = '' }
        }
    )) {
        $resolved = Resolve-LocalEnvironment @explicitSource
        Assert-Equal $resolved['DB_URL'] '' 'An explicit empty DB_URL must not be replaced by a Compose fallback.'
        Assert-Equal $resolved['DB_USERNAME'] '' 'An explicit empty DB_USERNAME must not be replaced by a Compose fallback.'
        Assert-Equal $resolved['DB_PASSWORD'] '' 'An explicit empty DB_PASSWORD must not be replaced by a Compose fallback.'
    }
    $resolved = Resolve-LocalEnvironment -FileValues $fileValues -ProcessValues @{
        POSTGRES_USER = 'process-compose'; DB_USERNAME = 'process-app'; DB_PASSWORD = ''; REDIS_HOST = 'process-cache'
    }
    Assert-Equal $resolved['DB_USERNAME'] 'process-app' 'Exported DB settings must override file/Compose settings.'
    Assert-Equal $resolved['DB_PASSWORD'] '' 'An explicitly exported empty value must not be silently replaced.'
    Assert-Equal $resolved['REDIS_HOST'] 'process-cache' 'Exported application settings must override file values.'
    $resolved = Resolve-LocalEnvironment -FileValues @{ POSTGRES_USER = 'file'; DB_USERNAME = 'explicit-file' } -ProcessValues @{ POSTGRES_USER = 'process' }
    Assert-Equal $resolved['DB_USERNAME'] 'explicit-file' 'Explicit DB settings must take priority over Compose fallback.'

    foreach ($invalid in @('broken line', 'ADMIN_ORIGIN="unfinished', ('DB_USERNAME=one' + "`n" + 'DB_USERNAME=two'), 'PATH=unsafe')) {
        [IO.File]::WriteAllText($fixture, $invalid)
        Assert-Throws { Read-LocalEnvironmentFile $fixture } 'Invalid or ambiguous configuration must fail early.'
    }

    $original = [Environment]::GetEnvironmentVariable('WIKI_LOCAL_LAUNCHER_TEST', 'Process')
    [Environment]::SetEnvironmentVariable('WIKI_LOCAL_LAUNCHER_TEST', 'before', 'Process')
    try {
        Invoke-WithLocalEnvironment -Values @{ WIKI_LOCAL_LAUNCHER_TEST = 'during' } -Action {
            Assert-Equal $env:WIKI_LOCAL_LAUNCHER_TEST 'during' 'The child action must receive the local environment.'
        }
        Assert-Equal $env:WIKI_LOCAL_LAUNCHER_TEST 'before' 'Successful actions must restore the parent environment.'
        Assert-Throws {
            Invoke-WithLocalEnvironment -Values @{ WIKI_LOCAL_LAUNCHER_TEST = 'failure' } -Action { throw 'Expected test failure.' }
        } 'Child failures must remain failures.'
        Assert-Equal $env:WIKI_LOCAL_LAUNCHER_TEST 'before' 'Failed actions must restore the parent environment.'

        [Environment]::SetEnvironmentVariable('WIKI_LOCAL_LAUNCHER_TEST', [NullString]::Value, 'Process')
        Invoke-WithLocalEnvironment -Values @{ WIKI_LOCAL_LAUNCHER_TEST = 'temporary' } -Action { }
        if ([Environment]::GetEnvironmentVariables('Process').Contains('WIKI_LOCAL_LAUNCHER_TEST')) {
            throw 'Successful actions must remove previously absent environment keys.'
        }
        Assert-Throws {
            Invoke-WithLocalEnvironment -Values @{ WIKI_LOCAL_LAUNCHER_TEST = 'temporary' } -Action { throw 'Expected absent-key test failure.' }
        } 'Child failures must remain failures when the parent key is absent.'
        if ([Environment]::GetEnvironmentVariables('Process').Contains('WIKI_LOCAL_LAUNCHER_TEST')) {
            throw 'Failed actions must remove previously absent environment keys.'
        }
    } finally {
        $originalValue = if ($null -eq $original) { [NullString]::Value } else { $original }
        [Environment]::SetEnvironmentVariable('WIKI_LOCAL_LAUNCHER_TEST', $originalValue, 'Process')
    }

    [IO.File]::WriteAllText($fixture, 'ADMIN_AUTH_CLIENT_SECRET=must-stay-private')
    $plan = & (Join-Path $PSScriptRoot 'start-local.ps1') -EnvironmentFile $fixture -DryRun
    Assert-Equal $plan.WorkingDirectory ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))) 'Dry-run must resolve the service from the script path.'
    if ('ADMIN_AUTH_CLIENT_SECRET' -notin $plan.EnvironmentKeys) { throw 'Dry-run must describe configured key names.' }
    if (($plan | ConvertTo-Json -Depth 5) -match 'must-stay-private') { throw 'Dry-run exposed a credential value.' }
    if (Test-Path -LiteralPath $probe) { throw 'Dry-run executed file contents.' }

    $launcherPath = Join-Path $PSScriptRoot 'start-local.ps1'
    $originalProcessDirectory = [Environment]::CurrentDirectory
    Push-Location -LiteralPath $fixtureDirectory
    try {
        # PowerShell location can differ from the process directory used by .NET file APIs.
        [Environment]::CurrentDirectory = $temporaryRoot
        $relativeValues = Read-LocalEnvironmentFile -Path '.\.env'
        Assert-Equal $relativeValues['ADMIN_AUTH_CLIENT_SECRET'] 'must-stay-private' 'Relative files must resolve from the PowerShell location.'
        $relativePlan = & $launcherPath -EnvironmentFile '.\.env' -DryRun
        if ('ADMIN_AUTH_CLIENT_SECRET' -notin $relativePlan.EnvironmentKeys) {
            throw 'The launcher must load relative environment files from the caller location.'
        }

        $ErrorActionPreference = 'Continue'
        Assert-Throws { Read-LocalEnvironmentFile -Path '.\missing.env' } 'Missing environment files must terminate even when the caller continues on errors.'
        Assert-Throws { & $launcherPath -EnvironmentFile '.\missing.env' -DryRun } 'The launcher must stop when its explicit configuration file is missing.'
    } finally {
        $ErrorActionPreference = 'Stop'
        [Environment]::CurrentDirectory = $originalProcessDirectory
        Pop-Location
    }

    Write-Output 'Local environment checks passed.'
} finally {
    $resolvedFixture = [IO.Path]::GetFullPath($fixtureDirectory)
    if (-not $resolvedFixture.StartsWith($temporaryRoot) -or (Split-Path -Leaf $resolvedFixture) -notlike 'wiki-local-environment-*') {
        throw 'Refusing to remove an unexpected fixture directory.'
    }
    Remove-Item -LiteralPath $resolvedFixture -Recurse -Force
}

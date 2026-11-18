<#
.SYNOPSIS
Exports the development databases and Keycloak accounts for the one-machine stack in infra/.

.DESCRIPTION
Writes wiki.dump, community.dump, keycloak-users.json and keycloak-identity-providers.json (Google sign-in, with its
client secret) into a new folder, by default infra/backups/db/dev-<UTC time>.
The stack reads that folder with its dev-import and dev-users-import services (infra/README.md, section on moving the
dev data). Nothing in the development environment changes: pg_dump only reads, and the accounts are exported from a copy
of the Keycloak volume inside a throwaway container. The folder holds password hashes and user data; keep it private.

Before it runs: the development Keycloak is stopped, the development PostgreSQL is running, and wiki-service and
community-service are stopped so that no write lands after the dump.
#>
[CmdletBinding()]
param(
    [string]$OutputDirectory,
    # Compose project of the development services; another name targets a copy of them.
    [string]$ProjectName = 'wiki-service',
    # Skips the check that the backends are stopped, for a rehearsal that may miss the latest writes.
    [switch]$AllowRunningServices
)

$ErrorActionPreference = 'Stop'
$serviceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $serviceDirectory '../..'))
$stamp = (Get-Date).ToUniversalTime().ToString("yyyyMMdd'T'HHmmss'Z'")
if (-not $OutputDirectory) {
    $OutputDirectory = Join-Path $repositoryRoot "infra/backups/db/dev-$stamp"
}
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $OutputDirectory) {
    throw "$OutputDirectory already exists; choose a new folder."
}

$compose = @('compose', '--project-name', $ProjectName, '--profile', 'identity')
$realm = 'wikiaov'
$backendPorts = @(8080, 8082)

function Invoke-Docker {
    param([string[]]$Arguments, [string]$InputText, [switch]$AllowFailure)

    # Docker writes progress to stderr, which Windows PowerShell turns into errors once the caller redirects it, so
    # only the exit code decides.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        if ($PSBoundParameters.ContainsKey('InputText')) {
            $output = $InputText | & docker @Arguments
        } else {
            $output = & docker @Arguments
        }
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
        throw "docker $($Arguments -join ' ') failed."
    }
    return $output
}

function Test-LocalPort {
    param([int]$Port)

    $client = New-Object System.Net.Sockets.TcpClient
    try {
        return $client.ConnectAsync('127.0.0.1', $Port).Wait(500)
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

# 071 and 71 name the same Flyway version.
function ConvertTo-VersionKey {
    param([string]$Version)

    return (($Version -split '[._]') | ForEach-Object { [string][long]$_ }) -join '.'
}

function Assert-MigrationsKnown {
    param([string]$Database, [string]$MigrationDirectory)

    $rows = Invoke-Docker -Arguments ($compose + @('exec', '-T', 'postgres', 'sh', '-c',
            'psql -X -At -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $1', 'sh', $Database)) -InputText @'
select version || ':' || success from flyway_schema_history where version is not null;
'@
    $applied = @{}
    foreach ($row in @($rows)) {
        $version, $success = $row -split ':', 2
        if ($success -ne 'true') {
            throw "Flyway version $version of database $Database failed; repair it before exporting."
        }
        $applied[(ConvertTo-VersionKey $version)] = $version
    }

    $known = @{}
    Get-ChildItem -LiteralPath $MigrationDirectory -Filter 'V*__*.sql' | ForEach-Object {
        $known[(ConvertTo-VersionKey ($_.Name -replace '^V([^_]+)__.*$', '$1'))] = $true
    }
    $unknown = @($applied.Keys | Where-Object { -not $known.ContainsKey($_) } | ForEach-Object { $applied[$_] })
    if ($unknown.Count -gt 0) {
        throw "Database $Database has migrations this checkout lacks: $($unknown -join ', '). The stack would refuse " +
            'to start on it; export from the branch the stack runs, after merging those migrations.'
    }
    $pending = @($known.Keys | Where-Object { -not $applied.ContainsKey($_) })
    Write-Host "Database $Database`: $($applied.Count) migrations applied, $($pending.Count) more run when the stack starts."
}

Push-Location -LiteralPath $serviceDirectory
try {
    if (Invoke-Docker -Arguments ($compose + @('ps', '--status', 'running', '--quiet', 'keycloak'))) {
        throw 'Stop the development Keycloak first (docker compose stop keycloak): its data must not change while it is copied.'
    }
    if (-not (Invoke-Docker -Arguments ($compose + @('ps', '--status', 'running', '--quiet', 'postgres')))) {
        throw 'Start the development database first: docker compose up -d postgres'
    }
    if (-not $AllowRunningServices) {
        foreach ($port in $backendPorts) {
            if (Test-LocalPort $port) {
                throw "Something still answers on port $port. Stop wiki-service and community-service so that no " +
                    'write lands after the dump, or pass -AllowRunningServices for a rehearsal.'
            }
        }
    }

    Assert-MigrationsKnown 'wiki' (Join-Path $serviceDirectory 'src/main/resources/db/migration')
    Assert-MigrationsKnown 'community' (Join-Path $repositoryRoot 'backend/community-service/src/main/resources/db/migration')

    $configuration = Invoke-Docker -Arguments ($compose + @('config', '--format', 'json')) | Out-String | ConvertFrom-Json
    $keycloakImage = $configuration.services.keycloak.image
    $keycloakVolume = "${ProjectName}_keycloak-data"
    Invoke-Docker -Arguments @('volume', 'inspect', $keycloakVolume) | Out-Null

    New-Item -ItemType Directory -Path $OutputDirectory | Out-Null

    # pg_dump writes inside the container, never into the data volume; the file is then copied out.
    foreach ($database in 'wiki', 'community') {
        $temporary = "/tmp/aov-export-$stamp-$database.dump"
        Invoke-Docker -Arguments ($compose + @('exec', '-T', 'postgres', 'sh', '-c',
                'pg_dump -U $POSTGRES_USER --format=custom --file=$1 $2', 'sh', $temporary, $database)) | Out-Null
        try {
            Invoke-Docker -Arguments ($compose + @('cp', "postgres:$temporary", (Join-Path $OutputDirectory "$database.dump"))) | Out-Null
        } finally {
            Invoke-Docker -Arguments ($compose + @('exec', '-T', 'postgres', 'rm', '-f', $temporary)) -AllowFailure | Out-Null
        }
        Write-Host "Dumped database $database."
    }

    # Keycloak opens its H2 file for writing, so the export runs on a copy: the volume is mounted read-only.
    $container = "aov-realm-export-$stamp".ToLowerInvariant()
    $exportScript = 'set -e; cp -r /source/h2 /opt/keycloak/data/h2; ' +
        "/opt/keycloak/bin/kc.sh export --dir /tmp/realm --realm $realm --users same_file"
    Invoke-Docker -Arguments @('create', '--name', $container, '--network', 'none', '-v', "${keycloakVolume}:/source:ro",
        '--entrypoint', '/bin/bash', $keycloakImage, '-c', $exportScript) | Out-Null
    try {
        Invoke-Docker -Arguments @('start', '--attach', $container) -AllowFailure | Out-Null
        $exitCode = Invoke-Docker -Arguments @('inspect', '--format', '{{.State.ExitCode}}', $container)
        if ("$exitCode".Trim() -ne '0') {
            Invoke-Docker -Arguments @('logs', '--tail', '30', $container) -AllowFailure | ForEach-Object { Write-Host $_ }
            throw 'The Keycloak export failed; the development Keycloak was not changed.'
        }
        Invoke-Docker -Arguments @('cp', "${container}:/tmp/realm/$realm-users-0.json",
            (Join-Path $OutputDirectory 'keycloak-users.json')) | Out-Null

        # Only the identity providers (Google sign-in) leave this machine: the realm file also holds the secret of
        # every development client, which the stack replaces with its own.
        $realmFile = Join-Path ([IO.Path]::GetTempPath()) "$container-realm.json"
        try {
            Invoke-Docker -Arguments @('cp', "${container}:/tmp/realm/$realm-realm.json", $realmFile) | Out-Null
            $realmSettings = Get-Content -LiteralPath $realmFile -Raw -Encoding UTF8 | ConvertFrom-Json
            $providers = @($realmSettings.identityProviders | Where-Object { $_ } |
                    Select-Object -Property * -ExcludeProperty internalId)
            $mappers = @($realmSettings.identityProviderMappers | Where-Object { $_ } |
                    Select-Object -Property * -ExcludeProperty id)
            $document = [ordered]@{ identityProviders = $providers; identityProviderMappers = $mappers }
            [IO.File]::WriteAllText((Join-Path $OutputDirectory 'keycloak-identity-providers.json'),
                (ConvertTo-Json -InputObject $document -Depth 20), (New-Object System.Text.UTF8Encoding $false))
        } finally {
            Remove-Item -LiteralPath $realmFile -Force -ErrorAction SilentlyContinue
        }
    } finally {
        Invoke-Docker -Arguments @('rm', '--force', $container) -AllowFailure | Out-Null
    }

    $users = Get-Content -LiteralPath (Join-Path $OutputDirectory 'keycloak-users.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $people = @($users.users | Where-Object { -not $_.serviceAccountClientId })
    $serviceAccounts = @($users.users | Where-Object { $_.serviceAccountClientId })
    Write-Host "Exported $($people.Count) accounts and $($serviceAccounts.Count) service accounts of realm $realm."
    Write-Host "Exported identity providers: $((@($providers | ForEach-Object { $_.alias }) -join ', '))"
    Write-Host "Written: $OutputDirectory"
    Write-Host 'It holds password hashes and user data: copy it to the server privately, then delete this copy.'
} catch {
    if (Test-Path -LiteralPath $OutputDirectory) {
        Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
    }
    throw
} finally {
    Pop-Location
}

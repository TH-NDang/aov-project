[CmdletBinding()]
param(
    [string]$CommunityDatabase = 'community',
    [string]$CommunityUser = 'community',
    [string]$CommunityPassword = 'community-local',
    [string]$PostgresUser = 'wiki',
    [string]$PostgresDatabase = 'wiki',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
foreach ($identifier in @($CommunityDatabase, $CommunityUser, $PostgresUser, $PostgresDatabase)) {
    if ($identifier -cnotmatch '^[a-z][a-z0-9_]{0,62}$') {
        throw 'Database and role names must be lowercase PostgreSQL identifiers.'
    }
}
if ([string]::IsNullOrWhiteSpace($CommunityPassword) -or $CommunityPassword.Contains([char]0)) {
    throw 'A nonempty database password is required.'
}
if ($CommunityDatabase -eq $PostgresDatabase -or $CommunityUser -eq $PostgresUser) {
    throw 'Community storage must use a different database and role from wiki storage.'
}

$serviceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if ($DryRun) {
    [pscustomobject]@{
        ComposeDirectory = $serviceDirectory
        Database = $CommunityDatabase
        Role = $CommunityUser
        ExistingData = 'Preserved'
    }
    return
}

$passwordLiteral = $CommunityPassword.Replace("'", "''")
$bodyDelimiter = '$community_setup$'
$sql = @"
\set ON_ERROR_STOP on
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', '$CommunityUser', '$passwordLiteral')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$CommunityUser') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', '$CommunityDatabase', '$CommunityUser')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$CommunityDatabase') \gexec
DO $bodyDelimiter
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba
        WHERE d.datname = '$CommunityDatabase' AND r.rolname = '$CommunityUser'
    ) THEN
        RAISE EXCEPTION 'The existing community database has a different owner';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_roles WHERE rolname = '$CommunityUser'
        AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)
    ) THEN
        RAISE EXCEPTION 'The community database role has unexpected administrative privileges';
    END IF;
END
$bodyDelimiter;
"@

Push-Location -LiteralPath $serviceDirectory
try {
    $sql | & docker compose exec -T postgres psql -X -q -U $PostgresUser -d $PostgresDatabase
    if ($LASTEXITCODE -ne 0) { throw 'Community database provisioning failed.' }
    Write-Host "Verified database $CommunityDatabase with separate owner $CommunityUser. Existing data was preserved."
} finally {
    $sql = $null
    $passwordLiteral = $null
    Pop-Location
}

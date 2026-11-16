[CmdletBinding()]
param(
    [string]$PostgresUser = 'wiki',
    [string]$PostgresDatabase = 'wiki'
)

# Lists every text column of the local database that still holds text not in Unicode NFC form (decomposed accents,
# which look identical but search and equality miss). Read-only: it runs in a READ ONLY transaction and changes nothing.
$ErrorActionPreference = 'Stop'
foreach ($identifier in @($PostgresUser, $PostgresDatabase)) {
    if ($identifier -cnotmatch '^[a-z][a-z0-9_]{0,62}$') {
        throw 'Database and role names must be lowercase PostgreSQL identifiers.'
    }
}

$serviceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$sql = @'
\set ON_ERROR_STOP on
BEGIN READ ONLY;
SELECT 'SELECT place, rows FROM (' || string_agg(format(
           'SELECT %L AS place, count(*) AS rows FROM %I.%I WHERE %I::text IS NOT NFC NORMALIZED',
           c.table_schema || '.' || c.table_name || '.' || c.column_name,
           c.table_schema, c.table_name, c.column_name), ' UNION ALL ')
       || ') found WHERE rows > 0 ORDER BY place'
FROM information_schema.columns c
JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE t.table_type = 'BASE TABLE'
  AND c.table_schema NOT IN ('pg_catalog', 'information_schema')
  AND c.data_type IN ('text', 'character varying', 'jsonb', 'json')
  AND c.table_name <> 'flyway_schema_history' \gexec
ROLLBACK;
'@

Push-Location -LiteralPath $serviceDirectory
try {
    $sql | & docker compose exec -T postgres psql -X -q -U $PostgresUser -d $PostgresDatabase
    if ($LASTEXITCODE -ne 0) { throw 'The NFC check failed.' }
} finally {
    Pop-Location
}

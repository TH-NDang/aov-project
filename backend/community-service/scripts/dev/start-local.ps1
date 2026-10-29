param([switch]$SkipDatabaseSetup)
$ErrorActionPreference = 'Stop'
$serviceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
if (-not $SkipDatabaseSetup) {
    & (Join-Path $serviceDirectory '../wiki-service/scripts/dev/initialize-community-database.ps1')
}
Push-Location -LiteralPath $serviceDirectory
try {
    & ./mvnw.cmd spring-boot:run
    if ($LASTEXITCODE -ne 0) { throw "Community service exited with code $LASTEXITCODE." }
}
finally {
    Pop-Location
}

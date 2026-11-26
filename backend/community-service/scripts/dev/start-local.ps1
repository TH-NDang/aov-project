[CmdletBinding()]
param(
    # Variables of community-service only (see .env.example). Missing default file: the application.yml defaults apply.
    [string]$EnvironmentFile = (Join-Path $PSScriptRoot '../../.env'),
    [switch]$SkipDatabaseSetup,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$serviceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
# One parser for the local environment files of both services.
Import-Module (Join-Path $serviceDirectory '../wiki-service/scripts/dev/LocalEnvironment.psm1') -Force

$values = [ordered]@{}
if (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf) {
    $fileValues = Read-LocalEnvironmentFile -Path $EnvironmentFile
    $processValues = [Environment]::GetEnvironmentVariables('Process')
    foreach ($name in $fileValues.Keys) {
        # A variable exported in the shell wins over the file, as with the wiki-service launcher.
        $values[$name] = if ($processValues.Contains($name)) { [string]$processValues[$name] } else { [string]$fileValues[$name] }
    }
} elseif ($PSBoundParameters.ContainsKey('EnvironmentFile')) {
    throw 'The requested local environment file does not exist.'
}
$windowsHost = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT

if ($DryRun) {
    # Report names only: connection strings, credentials and API keys must never appear in diagnostics.
    [pscustomobject]@{
        WorkingDirectory = $serviceDirectory
        Command = if ($windowsHost) { './mvnw.cmd spring-boot:run' } else { 'sh ./mvnw spring-boot:run' }
        DatabaseSetup = -not $SkipDatabaseSetup
        EnvironmentKeys = @($values.Keys | Sort-Object)
    }
    return
}

if (-not $SkipDatabaseSetup) {
    & (Join-Path $serviceDirectory '../wiki-service/scripts/dev/initialize-community-database.ps1')
}
Push-Location -LiteralPath $serviceDirectory
try {
    Invoke-WithLocalEnvironment -Values $values -Action {
        if ($windowsHost) {
            & (Join-Path $serviceDirectory 'mvnw.cmd') spring-boot:run
        } else {
            & sh (Join-Path $serviceDirectory 'mvnw') spring-boot:run
        }
        if ($LASTEXITCODE -ne 0) { throw "Community service exited with code $LASTEXITCODE." }
    }
}
finally {
    Pop-Location
}

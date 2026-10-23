[CmdletBinding()]
param(
    [string]$EnvironmentFile = (Join-Path $PSScriptRoot '../../.env'),
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'LocalEnvironment.psm1') -Force

$serviceDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$fileValues = [ordered]@{}
if (Test-Path -LiteralPath $EnvironmentFile -PathType Leaf) {
    $fileValues = Read-LocalEnvironmentFile -Path $EnvironmentFile
} elseif ($PSBoundParameters.ContainsKey('EnvironmentFile')) {
    throw 'The requested local environment file does not exist.'
}
$values = Resolve-LocalEnvironment -FileValues $fileValues
$mavenArguments = @('spring-boot:run', '-Dspring-boot.run.profiles=local')
$windowsHost = [Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT

if ($DryRun) {
    # Report names only: connection strings and credentials must never appear in diagnostics.
    [pscustomobject]@{
        WorkingDirectory = $serviceDirectory
        Command = if ($windowsHost) { './mvnw.cmd spring-boot:run "-Dspring-boot.run.profiles=local"' } else { 'sh ./mvnw spring-boot:run "-Dspring-boot.run.profiles=local"' }
        EnvironmentKeys = @($values.Keys | Sort-Object)
    }
    return
}

Push-Location -LiteralPath $serviceDirectory
try {
    Invoke-WithLocalEnvironment -Values $values -Action {
        if ($windowsHost) {
            & (Join-Path $serviceDirectory 'mvnw.cmd') @mavenArguments
        } else {
            & sh (Join-Path $serviceDirectory 'mvnw') @mavenArguments
        }
        if ($LASTEXITCODE -ne 0) { throw "Maven exited with code $LASTEXITCODE." }
    }
} finally {
    Pop-Location
}

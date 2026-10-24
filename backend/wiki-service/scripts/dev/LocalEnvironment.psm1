Set-StrictMode -Version Latest

function Read-LocalEnvironmentFile {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path)

    $ErrorActionPreference = 'Stop'
    $resolvedPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).ProviderPath

    $values = [ordered]@{}
    $lineNumber = 0
    foreach ($line in [IO.File]::ReadAllLines($resolvedPath)) {
        $lineNumber++
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
        if ($line -notmatch '^\s*(?:export\s+)?(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)$') {
            throw "Invalid environment assignment at line $lineNumber."
        }
        $name = $Matches.name
        $value = $Matches.value.Trim()
        if ($name -in @('PATH', 'HOME', 'USERPROFILE', 'CODEX_HOME', 'PSModulePath', 'ComSpec')) {
            throw "System environment variable '$name' is not supported in a local application file."
        }
        if ($values.Contains($name)) { throw "Duplicate environment variable '$name' at line $lineNumber." }

        if ($value.StartsWith('"') -or $value.StartsWith("'")) {
            $quote = $value.Substring(0, 1)
            if ($value.Length -lt 2 -or -not $value.EndsWith($quote)) {
                throw "Unterminated quoted environment value at line $lineNumber."
            }
            $value = $value.Substring(1, $value.Length - 2)
        } else {
            $value = [regex]::Replace($value, '\s+#.*$', '').TrimEnd()
        }
        if ($value.Contains([char]0)) { throw "Invalid environment value at line $lineNumber." }
        # Values are literal data. Never evaluate shell expressions or expand other variables.
        $values[$name] = $value
    }
    return $values
}

function Resolve-LocalEnvironment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][AllowEmptyCollection()][Collections.IDictionary]$FileValues,
        [Collections.IDictionary]$ProcessValues = [Environment]::GetEnvironmentVariables('Process')
    )

    $resolved = [ordered]@{}
    foreach ($name in $FileValues.Keys) {
        $resolved[$name] = if ($ProcessValues.Contains($name)) { [string]$ProcessValues[$name] } else { [string]$FileValues[$name] }
    }
    $read = {
        param([string]$Name, [string]$Default, [switch]$DefaultWhenEmpty)
        $value = if ($ProcessValues.Contains($Name)) { [string]$ProcessValues[$Name] }
        elseif ($FileValues.Contains($Name)) { [string]$FileValues[$Name] }
        else { $Default }
        if ($DefaultWhenEmpty -and [string]::IsNullOrEmpty($value)) { return $Default }
        return $value
    }
    # Compose uses ${NAME:-default}, so empty POSTGRES_* values also select the default.
    $databaseName = & $read 'POSTGRES_DB' 'wiki' -DefaultWhenEmpty
    $databaseUser = & $read 'POSTGRES_USER' 'wiki' -DefaultWhenEmpty
    $databasePassword = & $read 'POSTGRES_PASSWORD' 'wiki-local' -DefaultWhenEmpty
    $resolved['DB_URL'] = & $read 'DB_URL' "jdbc:postgresql://localhost:5432/$databaseName"
    $resolved['DB_USERNAME'] = & $read 'DB_USERNAME' $databaseUser
    $resolved['DB_PASSWORD'] = & $read 'DB_PASSWORD' $databasePassword
    return $resolved
}

function Invoke-WithLocalEnvironment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][Collections.IDictionary]$Values,
        [Parameter(Mandatory)][scriptblock]$Action
    )

    $previous = [ordered]@{}
    try {
        foreach ($name in $Values.Keys) {
            $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
            [Environment]::SetEnvironmentVariable($name, [string]$Values[$name], 'Process')
        }
        & $Action
    } finally {
        foreach ($name in $previous.Keys) {
            $value = if ($null -eq $previous[$name]) { [NullString]::Value } else { $previous[$name] }
            [Environment]::SetEnvironmentVariable($name, $value, 'Process')
        }
    }
}

Export-ModuleMember -Function Read-LocalEnvironmentFile, Resolve-LocalEnvironment, Invoke-WithLocalEnvironment

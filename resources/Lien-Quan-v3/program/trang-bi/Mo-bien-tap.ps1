$ErrorActionPreference = 'Stop'
$editorRoot = $PSScriptRoot
$editorNode = 'C:\Users\ndang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (-not (Test-Path -LiteralPath $editorNode)) { $editorNode = (Get-Command node -ErrorAction Stop).Source }
$editorUrl = 'http://127.0.0.1:8785'
try { $editorResponse = Invoke-RestMethod "$editorUrl/api/catalog" -TimeoutSec 2 } catch { $editorResponse = $null }
if (-not $editorResponse.catalog) {
    $editorServer = Join-Path $editorRoot 'editor-server.mjs'
    $editorProcess = Start-Process -FilePath $editorNode -ArgumentList ('"' + $editorServer + '"') -WorkingDirectory $editorRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $editorRoot 'editor-server.log') -RedirectStandardError (Join-Path $editorRoot 'editor-server-error.log') -PassThru
    $editorProcess.Id | Set-Content (Join-Path $editorRoot 'editor-server.pid')
    Start-Sleep -Seconds 1
}
Start-Process $editorUrl

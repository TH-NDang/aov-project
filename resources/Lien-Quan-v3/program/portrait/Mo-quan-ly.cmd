@echo off
setlocal
cd /d "%~dp0"
set "PYTHONIOENCODING=utf-8"
set "PORTRAIT_PYTHON=C:\Users\ndang\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%PORTRAIT_PYTHON%" (
  "%PORTRAIT_PYTHON%" "%~dp0server.py"
) else (
  python "%~dp0server.py"
)
pause

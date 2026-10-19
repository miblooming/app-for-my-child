$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
python -X utf8 (Join-Path $PSScriptRoot 'tools\build.py')
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Check the output above.' }

$ErrorActionPreference = 'Stop'
$env:TEMP = 'D:\CodexTemp'
$env:TMP = 'D:\CodexTemp'
$env:PYTHONDONTWRITEBYTECODE = '1'
New-Item -ItemType Directory -Path $env:TEMP -Force | Out-Null
Set-Location -LiteralPath $PSScriptRoot
python -B -X utf8 (Join-Path $PSScriptRoot 'tools\build.py')
if ($LASTEXITCODE -ne 0) { throw 'Build failed. Check the output above.' }

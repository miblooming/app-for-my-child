$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
$townFfmpeg = 'K:\ai-model\tools\ffmpeg\windows-x64\ffmpeg.exe'
if (-not (Test-Path -LiteralPath $townFfmpeg)) { $townFfmpeg = 'ffmpeg' }
New-Item -ItemType Directory -Path 'public\voice' -Force | Out-Null
$townJobs = (Get-Content -LiteralPath 'voice-jobs.json' -Raw | ConvertFrom-Json).jobs
foreach ($townJob in $townJobs) {
    $townInput = Join-Path (Get-Location) ('audio\' + $townJob.id + '.wav')
    $townOutput = Join-Path (Get-Location) ('public\voice\' + $townJob.id + '.mp3')
    & $townFfmpeg -hide_banner -loglevel error -y -i $townInput -af 'loudnorm=I=-18:TP=-2:LRA=7' -ar 24000 -ac 1 -codec:a libmp3lame -b:a 64k $townOutput
    if ($LASTEXITCODE -ne 0) { throw "Audio encoding failed: $($townJob.id)" }
}
Copy-Item -LiteralPath 'audio\voice-manifest.json' -Destination 'public\voice\voice-manifest.json' -Force
Write-Output "Offline voice clips ready: $($townJobs.Count)"

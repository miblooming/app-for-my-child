$ErrorActionPreference = 'Stop'
& 'K:\ai-model\run.ps1' tts-batch --jobs (Join-Path $PSScriptRoot 'voice-jobs.json') --output-dir (Join-Path $PSScriptRoot 'audio') --batch-size 2 --resume
& (Join-Path $PSScriptRoot 'tools\prepare-audio.ps1')

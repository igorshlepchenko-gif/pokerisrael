# Auto-restart supervisor for the Joker Club scraper.
# Registered as a Windows Scheduled Task (trigger: at log on).
#
# Unlike the WhatsApp forwarder, index.js has its own internal node-cron (runs an
# immediate scrape on startup, then every 2h) — this loop's only job is keeping that
# process alive across crashes/reboots, not scheduling scrapes itself. No QR/interactive
# step ever needed here, so this runs hidden (see the scheduled task's WindowStyle).

Set-Location $PSScriptRoot

$envLine = Get-Content "$PSScriptRoot\..\server\.env" | Where-Object { $_ -match '^AGENT_SECRET=' }
$env:AGENT_SECRET = ($envLine -replace '^AGENT_SECRET=', '') -replace '^"|"$', ''

$logFile = Join-Path $PSScriptRoot 'scraper.log'
Start-Transcript -Path $logFile -Append | Out-Null

$retryDelaySeconds = 60

while ($true) {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting jokerclub-scraper..."
    & 'C:\Program Files\nodejs\node.exe' index.js
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Exited with code $LASTEXITCODE. Restarting in $retryDelaySeconds s..."
    Start-Sleep -Seconds $retryDelaySeconds
}

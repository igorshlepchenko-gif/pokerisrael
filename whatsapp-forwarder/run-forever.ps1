# Auto-restart supervisor for the WhatsApp forwarder.
# Registered as a Windows Scheduled Task (trigger: at log on) — see setup notes in README below.
#
# Reads AGENT_SECRET from ../server/.env (never hardcoded here), then loops forever:
# run node index.js, log when/why it exited, wait, restart. A WhatsApp-side logout
# (invalid .auth) makes node exit almost immediately every time — this just keeps
# retrying at a fixed interval rather than crash-looping, and picks the connection
# back up automatically the moment someone deletes .auth and scans a fresh QR here.

Set-Location $PSScriptRoot

$envLine = Get-Content "$PSScriptRoot\..\server\.env" | Where-Object { $_ -match '^AGENT_SECRET=' }
$env:AGENT_SECRET = ($envLine -replace '^AGENT_SECRET=', '') -replace '^"|"$', ''

# Restrict to SUITS + HOUSE only, per explicit user request 2026-07-26 — was previously
# unfiltered (listening to every group the account is in), which is what let an unrelated
# club's casual chat land in the manual-review queue. Substrings, not full names, to sidestep
# the emoji/symbol characters in the real group names ("SUITS - The Mind's Playground ♣️",
# "האוס אירועים House ♦️") — matching is substring-based (see GROUP_FILTER in index.js).
$env:GROUPS = "suits,house"

$logFile = Join-Path $PSScriptRoot 'forwarder.log'
Start-Transcript -Path $logFile -Append | Out-Null

$retryDelaySeconds = 60

while ($true) {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Starting whatsapp-forwarder..."
    & 'C:\Program Files\nodejs\node.exe' index.js
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] Exited with code $LASTEXITCODE. Restarting in $retryDelaySeconds s... (close this window or Ctrl+C to stop permanently)"
    Start-Sleep -Seconds $retryDelaySeconds
}

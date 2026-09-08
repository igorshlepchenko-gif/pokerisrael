@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  Starts the local development environment: API first, then the client.
REM
REM  The order matters. Vite proxies /api to port 5000, and if the client comes
REM  up while the API is down that proxy keeps answering 500 even after the API
REM  starts — which looks exactly like "I can't log in" and has cost us the same
REM  debugging session three times.
REM
REM  Two windows open. Closing a window stops that server. Unlike servers started
REM  from inside a Claude session, these keep running on their own.
REM ─────────────────────────────────────────────────────────────────────────────

set "ROOT=%~dp0"

echo.
echo   Starting the API server on port 5000...
start "poker API (port 5000)" cmd /k "cd /d "%ROOT%server" && node index.js"

REM Give the API a moment to bind before the proxy goes looking for it.
timeout /t 4 /nobreak >nul

echo   Starting the client on port 5173...
start "poker client (port 5173)" cmd /k "cd /d "%ROOT%client" && npm run dev"

echo.
echo   Open http://localhost:5173
echo.
echo   If /api calls fail with 500, the API was not up yet — close the client
echo   window and re-run this script.
echo.
pause

@echo off
title Claudio AI Radio
cd /d "%~dp0"

echo [1/2] Starting NetEase Cloud Music API...
start "NCM-API" /min cmd /c "cd /d "%~dp0api-enhanced" && set PORT=3001 && node app.js"

echo Waiting for NCM API (max 30s)...
set wait_count=0
:wait_ncm
timeout /t 2 /nobreak >nul
set /a wait_count+=1
if %wait_count% gtr 15 (
    echo [!] NCM API startup timed out, starting Claudio anyway...
    goto start_claudio
)
curl -s http://localhost:3001/search?keywords=test^&limit=1 >nul 2>&1
if errorlevel 1 goto wait_ncm

:start_claudio
echo [2/2] Starting Claudio server on http://localhost:3005

:: Kill any existing process on port 3005
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3005 "') do (
  taskkill //F //PID %%p >nul 2>&1
)
timeout /t 1 /nobreak >nul

echo.
start "Claudio-Server" /min cmd /c "cd /d "%~dp0" && node --env-file=.env --import tsx src\server.ts"

echo.
echo ========================================
echo  Claudio is starting up...
echo  Open http://localhost:3005 in browser
echo ========================================
echo.
timeout /t 3 /nobreak >nul
start http://localhost:3005
echo.
echo Press any key to stop both servers...
pause >nul

echo Shutting down...
taskkill //F //FI "WINDOWTITLE eq NCM-API" 2>nul
taskkill //F //FI "WINDOWTITLE eq Claudio-Server" 2>nul
exit

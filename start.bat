@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Starting Claudio...
node --env-file=.env --import tsx src/server.ts
pause

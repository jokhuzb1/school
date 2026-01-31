@echo off
REM MediaMTX Restart Script - Config yangilanganda ishlatiladi
echo Restarting MediaMTX...
taskkill /IM mediamtx.exe /F 2>nul
timeout /t 1 /nobreak >nul
cd /d "d:\projects-advanced\school\tools\mediamtx"
start "" /min mediamtx.exe mediamtx.yml
echo MediaMTX restarted successfully!

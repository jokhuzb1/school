@echo off
REM MediaMTX Stop Script
echo Stopping MediaMTX...
taskkill /IM mediamtx.exe /F 2>nul
echo MediaMTX stopped.

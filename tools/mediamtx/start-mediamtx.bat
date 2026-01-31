@echo off
REM MediaMTX Auto-Start Script for School Camera System
REM Bu script MediaMTX serverini ishga tushiradi

echo ========================================
echo   MediaMTX Camera Streaming Server
echo ========================================
echo.

cd /d "d:\projects-advanced\school\tools\mediamtx"

REM Agar oldin ishlayotgan bo'lsa, to'xtatamiz
taskkill /IM mediamtx.exe /F 2>nul

echo Starting MediaMTX...
start "" /min mediamtx.exe mediamtx.yml

echo.
echo MediaMTX started successfully!
echo.
echo Endpoints:
echo   RTSP: rtsp://localhost:8554
echo   HLS:  http://localhost:8888
echo   WebRTC: http://localhost:8889
echo.
echo Press any key to exit (MediaMTX will continue in background)
pause >nul

@echo off
cd /d "%~dp0"
echo Building FFmpeg Studio for Windows...
npm run dist
pause

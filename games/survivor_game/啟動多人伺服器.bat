@echo off
title Survivor Game Multiplayer Server
cls

echo ==========================================
echo    Survivor Game Server Bootloader
echo ==========================================
echo.

:: Check for server.js
echo [1/3] Checking for server.js...
if exist "%~dp0server.js" (
    echo [OK] Found server.js
) else (
    echo [ERROR] Cannot find server.js! 
    echo Please make sure this .bat file is in the same folder as server.js.
    pause
    exit
)

:: Check for Node.js
echo [2/3] Checking Node.js environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit
)
echo [OK] Node.js is installed

:: Start the server
echo [3/3] Starting Server...
echo ------------------------------------------
echo KEEP THIS WINDOW OPEN WHILE PLAYING.
echo ------------------------------------------
echo.

cd /d "%~dp0"
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Server stopped or failed to start.
    echo Error Code: %errorlevel%
    pause
)
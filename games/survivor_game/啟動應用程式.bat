@echo off
title Survivor Game Desktop App
cls

echo ==========================================
echo    Survivor Game App Bootloader
echo ==========================================
echo.

:: Check for Node.js
echo [1/3] Checking Node.js environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is NOT installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit
)
echo [OK] Node.js is installed

:: Check for node_modules
echo [2/3] Checking dependencies...
if not exist "%~dp0node_modules" (
    echo [INFO] node_modules not found. Installing dependencies...
    npm install
) else (
    echo [OK] Dependencies found
)

:: Start the app
echo [3/3] Starting Application...
echo ------------------------------------------
echo.

cd /d "%~dp0"
npm start

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Application failed to start.
    echo Error Code: %errorlevel%
    pause
)

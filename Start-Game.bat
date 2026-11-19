@echo off
title Chiikawa Creator & Village Game
echo ====================================================
echo   Starting Chiikawa Creator & Village Companion!
echo   Gift Edition for PC
echo ====================================================
echo.

set FILE_PATH=%~dp0index.html

:: Try to launch with MS Edge in App Mode (feels like a native PC game!)
start msedge --app="%FILE_PATH%" 2>nul
if %ERRORLEVEL% EQU 0 goto done

:: Otherwise try Chrome App Mode
start chrome --app="%FILE_PATH%" 2>nul
if %ERRORLEVEL% EQU 0 goto done

:: Fallback to default browser
start "" "%FILE_PATH%"

:done
echo Game launched successfully! Enjoy!
exit

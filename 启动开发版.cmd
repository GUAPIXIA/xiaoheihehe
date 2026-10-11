@echo off
setlocal
chcp 65001 >nul
title Xiaoheihehe - Development
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-dev.ps1"
set "DEV_EXIT_CODE=%ERRORLEVEL%"
if not "%DEV_EXIT_CODE%"=="0" pause
exit /b %DEV_EXIT_CODE%

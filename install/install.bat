@echo off
chcp 65001 >nul 2>&1
title 세무 AI 어시스턴트 - 설치 프로그램

echo.
echo  세무 AI 어시스턴트 설치를 시작합니다...
echo.

:: install.ps1 은 같은 폴더(install/)에 있음
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"

if %errorlevel% neq 0 (
    echo.
    echo  [오류] 설치 중 문제가 발생했습니다.
    pause
)

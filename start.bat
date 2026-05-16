@echo off
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8001 "') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":3000 "') do taskkill /PID %%p /F >nul 2>&1
start "TaxAI-Backend" cmd /k "cd /d "%BACKEND%" && python -m uvicorn main:app --port 8001"
timeout /t 4 /nobreak >nul
start "TaxAI-Frontend" cmd /k "cd /d "%FRONTEND%" && npm start"
timeout /t 6 /nobreak >nul
start "" "http://localhost:3000"
echo.
echo Service started: http://localhost:3000
echo Run stop.bat to stop.
echo.

@echo off
taskkill /FI "WindowTitle eq TaxAI-Backend*" /F >nul 2>&1
taskkill /FI "WindowTitle eq TaxAI-Frontend*" /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8001 "') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":3000 "') do taskkill /PID %%p /F >nul 2>&1
echo Stopped.
timeout /t 2 /nobreak >nul

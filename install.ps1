#Requires -Version 5.1
# 세무 AI 어시스턴트 설치 스크립트 v1.0
# 실행 방법: install.bat 을 더블클릭 (또는 PowerShell에서 직접 실행)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ── 경로 설정 ────────────────────────────────────────────────────────────────
$ROOT        = $PSScriptRoot
$BACKEND     = Join-Path $ROOT "backend"
$FRONTEND    = Join-Path $ROOT "frontend"
$VENV        = Join-Path $BACKEND ".venv"
$VENV_PY     = Join-Path $VENV "Scripts\python.exe"
$VENV_PIP    = Join-Path $VENV "Scripts\pip.exe"
$ENV_FILE    = Join-Path $BACKEND ".env"
$ENV_EXAMPLE = Join-Path $BACKEND ".env.example"
$START_BAT   = Join-Path $ROOT "start.bat"
$STOP_BAT    = Join-Path $ROOT "stop.bat"

$STEP = 0
$TOTAL_STEPS = 6

# ── 출력 헬퍼 ────────────────────────────────────────────────────────────────
function Header {
    Clear-Host
    Write-Host ""
    Write-Host "  +--------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host "  |   세무 AI 어시스턴트   설치 프로그램   v1.0      |" -ForegroundColor Cyan
    Write-Host "  +--------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host ""
}

function Step([string]$msg) {
    $script:STEP++
    Write-Host ""
    Write-Host "  [$script:STEP/$TOTAL_STEPS] $msg" -ForegroundColor Cyan
}

function OK([string]$msg)   { Write-Host "        OK  $msg" -ForegroundColor Green }
function Info([string]$msg) { Write-Host "        >>  $msg" -ForegroundColor Gray }
function Warn([string]$msg) { Write-Host "       [!]  $msg" -ForegroundColor Yellow }
function Fail([string]$msg) {
    Write-Host ""
    Write-Host "  [오류] $msg" -ForegroundColor Red
    Write-Host ""
    Read-Host "  Enter 키를 눌러 종료하세요"
    exit 1
}

function RefreshPath {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user    = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machine;$user"
}

# ── 실행 ──────────────────────────────────────────────────────────────────────
Header

# ────────────────────────────────────────────────────────────
# STEP 1: Python 확인 / 설치
# ────────────────────────────────────────────────────────────
Step "Python 확인"

$pyCmd = $null
foreach ($cmd in @("python", "python3", "py")) {
    try {
        $out = & $cmd --version 2>&1
        if ($LASTEXITCODE -eq 0 -and "$out" -match "Python 3\.(\d+)") {
            if ([int]$Matches[1] -ge 9) { $pyCmd = $cmd; break }
        }
    } catch {}
}

if ($pyCmd) {
    $ver = (& $pyCmd --version 2>&1).ToString().Trim()
    OK "$ver 확인됨"
} else {
    Info "Python 3.9+ 을 찾을 수 없습니다. winget으로 설치합니다..."
    try {
        winget install --id Python.Python.3.12 `
            --accept-source-agreements --accept-package-agreements --silent `
            | Out-Null
        RefreshPath
        # winget installs Python Launcher (py.exe) which is most reliable
        $pyCmd = "py"
        $ver = (& $pyCmd --version 2>&1).ToString().Trim()
        OK "Python 설치 완료: $ver"
    } catch {
        Fail "Python 자동 설치에 실패했습니다.`n  https://www.python.org/downloads/ 에서 Python 3.11 이상을 수동으로 설치한 후 다시 실행하세요."
    }
}

# ────────────────────────────────────────────────────────────
# STEP 2: Node.js 확인 / 설치
# ────────────────────────────────────────────────────────────
Step "Node.js 확인"

$nodeOk = $false
try {
    $nodeVer = (& node --version 2>&1).ToString().Trim()
    if ($LASTEXITCODE -eq 0 -and $nodeVer -match "v(\d+)" -and [int]$Matches[1] -ge 18) {
        $nodeOk = $true
        OK "Node.js $nodeVer 확인됨"
    }
} catch {}

if (-not $nodeOk) {
    Info "Node.js 18+ 을 찾을 수 없습니다. winget으로 설치합니다..."
    try {
        winget install --id OpenJS.NodeJS.LTS `
            --accept-source-agreements --accept-package-agreements --silent `
            | Out-Null
        RefreshPath
        $nodeVer = (& node --version 2>&1).ToString().Trim()
        OK "Node.js 설치 완료: $nodeVer"
    } catch {
        Fail "Node.js 자동 설치에 실패했습니다.`n  https://nodejs.org/ 에서 Node.js 20 LTS를 수동으로 설치한 후 다시 실행하세요."
    }
}

# ────────────────────────────────────────────────────────────
# STEP 3: 백엔드 설정
# ────────────────────────────────────────────────────────────
Step "백엔드 설정"

# .env 생성
if (-not (Test-Path $ENV_FILE)) {
    if (Test-Path $ENV_EXAMPLE) {
        Copy-Item $ENV_EXAMPLE $ENV_FILE
        OK ".env 파일 생성됨 (.env.example 에서 복사)"
    } else {
        Warn ".env.example 을 찾을 수 없습니다. .env 파일을 수동으로 생성해주세요."
    }
} else {
    OK ".env 파일 이미 존재함"
}

# 가상환경 생성
if (-not (Test-Path $VENV_PY)) {
    Info "Python 가상환경 생성 중..."
    Push-Location $BACKEND
    try {
        & $pyCmd -m venv .venv | Out-Null
        if (-not (Test-Path $VENV_PY)) { throw "venv 생성 실패" }
        OK "가상환경 생성 완료"
    } catch {
        Pop-Location
        Fail "Python 가상환경 생성에 실패했습니다: $_"
    }
    Pop-Location
} else {
    OK "가상환경 이미 존재함"
}

# pip 패키지 설치
Info "Python 패키지 설치 중... (시간이 걸릴 수 있습니다)"
Push-Location $BACKEND
try {
    & $VENV_PIP install --upgrade pip --quiet 2>&1 | Out-Null
    & $VENV_PIP install -r requirements.txt --quiet 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pip install 실패" }
    OK "Python 패키지 설치 완료"
} catch {
    Pop-Location
    Fail "Python 패키지 설치에 실패했습니다: $_"
}
Pop-Location

# 데이터베이스 초기화
Info "데이터베이스 초기화 중..."
Push-Location $BACKEND
try {
    & $VENV_PY -m alembic upgrade head 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "alembic 실패" }
    OK "데이터베이스 초기화 완료"
} catch {
    Pop-Location
    Fail "데이터베이스 초기화에 실패했습니다: $_"
}
Pop-Location

# ────────────────────────────────────────────────────────────
# STEP 4: 프론트엔드 설정
# ────────────────────────────────────────────────────────────
Step "프론트엔드 설정"

# .env.local 생성
$envLocal = Join-Path $FRONTEND ".env.local"
if (-not (Test-Path $envLocal)) {
    "NEXT_PUBLIC_API_BASE_URL=http://localhost:8001/api/v1" | Set-Content $envLocal -Encoding UTF8
    OK ".env.local 생성됨"
} else {
    OK ".env.local 이미 존재함"
}

# npm install
Info "Node.js 패키지 설치 중... (시간이 걸릴 수 있습니다)"
Push-Location $FRONTEND
try {
    & npm install --prefer-offline 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        & npm install 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "npm install 실패" }
    }
    OK "Node.js 패키지 설치 완료"
} catch {
    Pop-Location
    Fail "npm install에 실패했습니다: $_"
}
Pop-Location

# ────────────────────────────────────────────────────────────
# STEP 5: 프론트엔드 빌드
# ────────────────────────────────────────────────────────────
Step "프론트엔드 빌드 (프로덕션)"

Info "Next.js 빌드 중... (1~3분 소요)"
Push-Location $FRONTEND
try {
    $buildOutput = & npm run build 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ($buildOutput | Select-Object -Last 30 | Out-String) -ForegroundColor DarkRed
        throw "빌드 실패"
    }
    OK "프론트엔드 빌드 완료"
} catch {
    Pop-Location
    Fail "프론트엔드 빌드에 실패했습니다.`n  상세 로그를 확인하세요: $_"
}
Pop-Location

# ────────────────────────────────────────────────────────────
# STEP 6: 실행 파일 생성
# ────────────────────────────────────────────────────────────
Step "실행 파일 생성"

# start.bat ───────────────────────────────────────────────────
$startContent = @'
@echo off
chcp 65001 >nul 2>&1
title 세무 AI 어시스턴트

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"
set "VENV_PY=%BACKEND%\.venv\Scripts\python.exe"

echo.
echo  +--------------------------------------------------+
echo  |          세무 AI 어시스턴트  시작 중...          |
echo  +--------------------------------------------------+
echo.

:: ── 포트 충돌 정리 ────────────────────────────────────────────
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8001 "') do (
    taskkill /PID %%p /F >nul 2>&1
)
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":3000 "') do (
    taskkill /PID %%p /F >nul 2>&1
)

:: ── 백엔드 시작 (재시작 루프 포함) ──────────────────────────────
start "세무AI-백엔드" cmd /c "call "%ROOT%_run_backend.bat""

:: ── 프론트엔드 준비 대기 후 시작 ────────────────────────────────
timeout /t 4 /nobreak >nul
start "세무AI-프론트엔드" cmd /k "cd /d "%FRONTEND%" && npm start"

:: ── 브라우저 열기 ────────────────────────────────────────────────
timeout /t 6 /nobreak >nul

:: 첫 설정인지 확인 (law_key_set 이 false 이면 /config 로)
set "OPEN_URL=http://localhost:3000"
for /f "delims=" %%R in ('curl -s --max-time 3 http://localhost:8001/api/v1/config 2^>nul') do set "CFG=%%R"
echo %CFG% | findstr /i "\"setup_complete\":false" >nul 2>&1
if not errorlevel 1 set "OPEN_URL=http://localhost:3000/config"

start "" "%OPEN_URL%"
echo.
echo  서비스가 시작되었습니다: %OPEN_URL%
echo  종료하려면 stop.bat 을 실행하세요.
echo.
'@

$startContent | Set-Content $START_BAT -Encoding UTF8
OK "start.bat 생성됨"

# _run_backend.bat (재시작 루프용) ──────────────────────────────
$runBackend = @'
@echo off
chcp 65001 >nul 2>&1
title 세무AI-백엔드
set "BACKEND=%~dp0backend"
set "VENV_PY=%BACKEND%\.venv\Scripts\python.exe"

:loop
cd /d "%BACKEND%"
"%VENV_PY%" -m uvicorn main:app --port 8001
if %errorlevel% equ 3 (
    echo  [백엔드] 설정 변경으로 재시작합니다...
    timeout /t 2 /nobreak >nul
    goto loop
)
echo  [백엔드] 종료됨.
'@

$runBackend | Set-Content (Join-Path $ROOT "_run_backend.bat") -Encoding UTF8
OK "_run_backend.bat 생성됨 (재시작 루프)"

# stop.bat ────────────────────────────────────────────────────
$stopContent = @'
@echo off
chcp 65001 >nul 2>&1
echo.
echo  세무 AI 어시스턴트를 종료합니다...
echo.

taskkill /FI "WindowTitle eq 세무AI-백엔드*"   /F >nul 2>&1
taskkill /FI "WindowTitle eq 세무AI-프론트엔드*" /F >nul 2>&1

for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":8001 "') do taskkill /PID %%p /F >nul 2>&1
for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":3000 "') do taskkill /PID %%p /F >nul 2>&1

echo  종료 완료.
timeout /t 2 /nobreak >nul
'@

$stopContent | Set-Content $STOP_BAT -Encoding UTF8
OK "stop.bat 생성됨"

# ────────────────────────────────────────────────────────────
# 완료
# ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +--------------------------------------------------+" -ForegroundColor Green
Write-Host "  |               설치가 완료되었습니다!              |" -ForegroundColor Green
Write-Host "  +--------------------------------------------------+" -ForegroundColor Green
Write-Host ""
Write-Host "  사용 방법:" -ForegroundColor White
Write-Host "    start.bat  - 서비스 시작  (더블클릭)" -ForegroundColor Gray
Write-Host "    stop.bat   - 서비스 종료  (더블클릭)" -ForegroundColor Gray
Write-Host ""
Write-Host "  첫 실행 후 브라우저에서:" -ForegroundColor White
Write-Host "    http://localhost:3000/config" -ForegroundColor DarkCyan
Write-Host "    위 주소에서 API 키를 설정하면 서비스를 이용할 수 있습니다." -ForegroundColor Gray
Write-Host ""

$ans = Read-Host "  지금 바로 서비스를 시작하시겠습니까? (Y/N)"
if ($ans -match "^[Yy]") {
    Write-Host "  서비스를 시작합니다..." -ForegroundColor Cyan
    Start-Process $START_BAT
}

Write-Host ""
Read-Host "  Enter 키를 눌러 종료하세요"

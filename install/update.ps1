#Requires -Version 5.1
# 세무 AI 어시스턴트 업데이트 스크립트 v1.0

$ErrorActionPreference = "Stop"
$null = chcp 65001
[Console]::OutputEncoding = [System.Text.Encoding]::GetEncoding(65001)
$OutputEncoding             = [System.Text.Encoding]::GetEncoding(65001)

$ROOT     = Split-Path $PSScriptRoot -Parent
$BACKEND  = Join-Path $ROOT "backend"
$FRONTEND = Join-Path $ROOT "frontend"
$VENV_PY  = Join-Path $BACKEND ".venv\Scripts\python.exe"

$REPO_ZIP_URL = "https://github.com/freeegg76/taxissuereport/archive/refs/heads/main.zip"
$STEP = 0
$TOTAL_STEPS = 5

# ── 출력 헬퍼 ────────────────────────────────────────────────────────────────
function Header {
    Clear-Host
    Write-Host ""
    Write-Host "  +--------------------------------------------------+" -ForegroundColor DarkCyan
    Write-Host "  |   세무 AI 어시스턴트   업데이트 프로그램   v1.0  |" -ForegroundColor Cyan
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

Header

# ── STEP 1: 서비스 중지 ──────────────────────────────────────────────────────
Step "서비스 중지"

foreach ($port in @(8001, 3000)) {
    $lines = netstat -aon 2>$null | Select-String ":$port "
    foreach ($line in $lines) {
        $procId = ($line -split '\s+')[-1]
        if ($procId -match '^\d+$') {
            try { Stop-Process -Id ([int]$procId) -Force -ErrorAction SilentlyContinue } catch {}
        }
    }
}
OK "서비스 중지 완료"

# ── STEP 2: 최신 소스 다운로드 ──────────────────────────────────────────────
Step "최신 소스 다운로드"

$TMP_ZIP = Join-Path $env:TEMP "taxissuereport_update.zip"
$TMP_DIR = Join-Path $env:TEMP "taxissuereport_update"
$srcFolder = $null

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    Info "GitHub에서 최신 버전 다운로드 중..."
    Invoke-WebRequest -Uri $REPO_ZIP_URL -OutFile $TMP_ZIP -UseBasicParsing

    Info "압축 해제 중..."
    if (Test-Path $TMP_DIR) { Remove-Item $TMP_DIR -Recurse -Force }
    Expand-Archive -Path $TMP_ZIP -DestinationPath $TMP_DIR -Force
    Remove-Item $TMP_ZIP -Force -ErrorAction SilentlyContinue

    $srcFolder = Get-ChildItem $TMP_DIR -Directory | Select-Object -First 1
    if (-not $srcFolder) { throw "ZIP 내부 폴더를 찾을 수 없습니다." }

    OK "다운로드 완료"
} catch {
    Remove-Item $TMP_ZIP -Force -ErrorAction SilentlyContinue
    Remove-Item $TMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
    Fail "다운로드 실패: $_"
}

# ── STEP 3: 소스 코드 업데이트 ──────────────────────────────────────────────
Step "소스 코드 업데이트"

# 덮어쓰지 않고 보존할 경로
$preserve = @(
    (Join-Path $BACKEND ".env"),
    (Join-Path $BACKEND ".venv"),
    (Join-Path $BACKEND "tax_agent.db"),
    (Join-Path $FRONTEND "node_modules"),
    (Join-Path $FRONTEND ".next"),
    (Join-Path $FRONTEND ".env.local")
)

function ShouldPreserve([string]$path) {
    foreach ($p in $preserve) {
        if ($path -eq $p -or $path.StartsWith($p + "\")) { return $true }
    }
    return $false
}

try {
    Get-ChildItem $srcFolder.FullName | ForEach-Object {
        $srcItem = $_
        $destTop = Join-Path $ROOT $srcItem.Name

        if (ShouldPreserve $destTop) { return }

        if ($srcItem.PSIsContainer) {
            Get-ChildItem $srcItem.FullName -Recurse | ForEach-Object {
                $relPath = $_.FullName.Substring($srcFolder.FullName.Length + 1)
                $dest    = Join-Path $ROOT $relPath
                if (ShouldPreserve $dest) { return }
                if ($_.PSIsContainer) {
                    New-Item -ItemType Directory -Path $dest -Force | Out-Null
                } else {
                    Copy-Item $_.FullName $dest -Force
                }
            }
        } else {
            Copy-Item $srcItem.FullName $destTop -Force
        }
    }
    OK "소스 코드 업데이트 완료"
} catch {
    Fail "파일 복사 실패: $_"
} finally {
    Remove-Item $TMP_DIR -Recurse -Force -ErrorAction SilentlyContinue
}

# ── STEP 4: 백엔드 업데이트 ─────────────────────────────────────────────────
Step "백엔드 업데이트"

if (-not (Test-Path $VENV_PY)) {
    Fail "가상환경을 찾을 수 없습니다. install.bat을 먼저 실행해주세요."
}

Push-Location $BACKEND
try {
    Info "Python 패키지 업데이트 중..."
    & $VENV_PY -m pip install -r requirements.txt --upgrade --no-warn-script-location --quiet
    if ($LASTEXITCODE -ne 0) { throw "pip install 실패 (exit: $LASTEXITCODE)" }
    OK "Python 패키지 업데이트 완료"

    Info "데이터베이스 마이그레이션 중..."
    & $VENV_PY -m alembic upgrade head
    if ($LASTEXITCODE -ne 0) { throw "alembic upgrade 실패 (exit: $LASTEXITCODE)" }
    OK "데이터베이스 마이그레이션 완료"
} catch {
    Pop-Location
    Fail "백엔드 업데이트 실패: $_"
}
Pop-Location

# ── STEP 5: 프론트엔드 업데이트 ─────────────────────────────────────────────
Step "프론트엔드 업데이트"

Push-Location $FRONTEND
try {
    Info "Node.js 패키지 업데이트 중..."
    cmd /c "npm install --prefer-offline"
    if ($LASTEXITCODE -ne 0) {
        cmd /c "npm install"
        if ($LASTEXITCODE -ne 0) { throw "npm install 실패" }
    }
    OK "Node.js 패키지 업데이트 완료"

    Info "프론트엔드 빌드 중... (1~3분 소요)"
    $buildOutput = cmd /c "npm run build" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host ($buildOutput | Select-Object -Last 20 | Out-String) -ForegroundColor DarkRed
        throw "빌드 실패"
    }
    OK "프론트엔드 빌드 완료"
} catch {
    Pop-Location
    Fail "프론트엔드 업데이트 실패: $_"
}
Pop-Location

# ── 완료 ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +--------------------------------------------------+" -ForegroundColor Green
Write-Host "  |               업데이트가 완료되었습니다!          |" -ForegroundColor Green
Write-Host "  +--------------------------------------------------+" -ForegroundColor Green
Write-Host ""

$ans = Read-Host "  지금 바로 서비스를 시작하시겠습니까? (Y/N)"
if ($ans -match "^[Yy]") {
    $startBat = Join-Path $ROOT "start.bat"
    if (Test-Path $startBat) {
        Start-Process $startBat
    } else {
        Warn "start.bat을 찾을 수 없습니다. install.bat을 먼저 실행해주세요."
    }
}

Write-Host ""
Read-Host "  Enter 키를 눌러 종료하세요"

# SAP AI Triage Bridge - Script de inicio local
# Ejecutar desde la raiz del proyecto: .\start.ps1

Write-Host ""
Write-Host "=== SAP AI Triage Bridge - Setup Local ===" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que pnpm este instalado
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "[1/5] Instalando pnpm..." -ForegroundColor Yellow
    npm install -g pnpm@9
} else {
    Write-Host "[1/5] pnpm OK ($(pnpm --version))" -ForegroundColor Green
}

# 2. Instalar dependencias si node_modules no existe
if (-not (Test-Path "node_modules")) {
    Write-Host "[2/5] Instalando dependencias (pnpm install)..." -ForegroundColor Yellow
    pnpm install
} else {
    Write-Host "[2/5] Dependencias ya instaladas" -ForegroundColor Green
}

# 3. Esperar Docker Desktop
Write-Host "[3/5] Verificando Docker..." -ForegroundColor Yellow
$dockerOk = $false
$attempts = 0
do {
    $result = docker ps 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dockerOk = $true
        Write-Host "      Docker disponible" -ForegroundColor Green
        break
    }
    $attempts++
    if ($attempts -eq 1) {
        Write-Host "      Docker no esta corriendo. Intentando iniciar Docker Desktop..." -ForegroundColor Yellow
        Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
        Write-Host "      Esperando que Docker Desktop arranque (puede tardar ~30s)..." -ForegroundColor Yellow
    }
    Start-Sleep 5
} while ($attempts -le 18)

if (-not $dockerOk) {
    Write-Host ""
    Write-Host "ERROR: Docker Desktop no pudo iniciarse." -ForegroundColor Red
    Write-Host "   1. Abre Docker Desktop manualmente" -ForegroundColor White
    Write-Host "   2. Espera que el icono de Docker este activo en la barra de tareas" -ForegroundColor White
    Write-Host "   3. Vuelve a ejecutar: .\start.ps1" -ForegroundColor White
    exit 1
}

# 4. Levantar PostgreSQL en puerto 5433
# (puerto 5432 puede estar ocupado por PostgreSQL local de Windows)
Write-Host "[4/5] Iniciando PostgreSQL en puerto 5433 (docker compose up)..." -ForegroundColor Yellow
$composeOutput = docker compose up -d 2>&1
if ($LASTEXITCODE -ne 0) {
    if ($composeOutput -match "port is already allocated" -or $composeOutput -match "address already in use") {
        Write-Host "      El puerto 5433 tambien esta ocupado." -ForegroundColor Red
        Write-Host "      Ejecuta: docker rm -f sap-triage-db  y vuelve a intentarlo." -ForegroundColor White
        exit 1
    }
    Write-Host $composeOutput -ForegroundColor Red
    exit 1
}

# Esperar healthcheck
Write-Host "      Esperando que PostgreSQL este listo..." -ForegroundColor Yellow
$dbReady = $false
for ($i = 0; $i -lt 20; $i++) {
    $health = docker inspect sap-triage-db --format "{{.State.Health.Status}}" 2>&1
    if ($health -eq "healthy") {
        $dbReady = $true
        Write-Host "      PostgreSQL listo en puerto 5433" -ForegroundColor Green
        break
    }
    Start-Sleep 3
}

if (-not $dbReady) {
    Write-Host "      PostgreSQL puede no estar completamente listo, continuando..." -ForegroundColor Yellow
}

# 5. Prisma generate + migrate
Write-Host "[5/5] Generando Prisma client y aplicando migraciones..." -ForegroundColor Yellow
pnpm db:generate 2>&1 | Out-Null

$migrateOutput = pnpm db:migrate 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "      Migraciones aplicadas OK" -ForegroundColor Green
} else {
    Write-Host "      Error en migraciones:" -ForegroundColor Red
    Write-Host $migrateOutput -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Todo listo ===" -ForegroundColor Green
Write-Host ""
Write-Host "   API:       http://localhost:3001" -ForegroundColor Cyan
Write-Host "   Frontend:  http://localhost:5173" -ForegroundColor Cyan
Write-Host "   DB Studio: ejecuta pnpm db:studio en otra terminal" -ForegroundColor Cyan
Write-Host ""

# Advertencia sobre la API key
$envContent = Get-Content "apps\api\.env" -ErrorAction SilentlyContinue
if ($envContent -match "REEMPLAZA") {
    Write-Host "AVISO: Configura tu ANTHROPIC_API_KEY en apps\api\.env" -ForegroundColor Yellow
    Write-Host "       Sin ella el dashboard y sync funcionan, pero el triage AI no." -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Iniciando servidores de desarrollo..." -ForegroundColor Cyan
Write-Host "   (Ctrl+C para detener)" -ForegroundColor White
Write-Host ""

pnpm dev

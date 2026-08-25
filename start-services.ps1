Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   ARMS - ACCOUNT RESOURCE MANAGEMENT SYSTEM    " -ForegroundColor Green
Write-Host "          Khoi dong Infrastructure & Backend    " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan

# 1. Start Docker Containers (MongoDB + Redis)
Write-Host "`n[1/3] Khoi dong MongoDB (ReplicaSet) & Redis..." -ForegroundColor Yellow
docker-compose up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[CANH BAO] Docker chua khoi dong hoac co loi. Vui long mo Docker Desktop neu chua chay!" -ForegroundColor Red
} else {
    Write-Host "[OK] Docker containers da khoi dong xong." -ForegroundColor Green
}

# 2. Start PM2 Backend (API + Worker)
Write-Host "`n[2/3] Khoi dong Backend (API + Worker qua PM2)..." -ForegroundColor Yellow
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 start ecosystem.config.js
    pm2 save
    Write-Host "[OK] PM2 services da khoi dong." -ForegroundColor Green
} else {
    Write-Host "[CANH BAO] Chua cai dat PM2. Cai dat bang lenh: npm install -g pm2" -ForegroundColor Red
    Write-Host "Dang khoi dong tam qua npm dev..." -ForegroundColor Yellow
    npm run dev
}

# 3. Status Report
Write-Host "`n[3/3] Kiem tra trang thai he thong:" -ForegroundColor Yellow
if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 status
}
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n================================================" -ForegroundColor Cyan
Write-Host " He thong san sang! De mo Tunnel cho Google Apps Script:" -ForegroundColor Green
Write-Host " Chay: .\start-tunnel.ps1" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan

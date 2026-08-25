Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   ARMS - PERMANENT STATIC TUNNEL (NGROK)       " -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Cyan

$PERMANENT_URL = "https://dribble-statistic-facedown.ngrok-free.dev"

Write-Host "`nDang mo Tunnel co dinh vinh vien toi 127.0.0.1:4000..." -ForegroundColor Yellow
Write-Host "URL Co Dinh Cua Ban:" -ForegroundColor Cyan
Write-Host "$PERMANENT_URL" -ForegroundColor Green
Write-Host "`n1. Copy URL tren" -ForegroundColor White
Write-Host "2. Mo Google Sheet -> Menu ARMS -> Setup Wizard" -ForegroundColor White
Write-Host "3. Dan URL vao va Test Connection (Chi can lam 1 lan duy nhat!)" -ForegroundColor White
Write-Host "`n[Nhan Ctrl+C de dung Tunnel]`n" -ForegroundColor Yellow

while ($true) {
    npx ngrok http http://127.0.0.1:4000 --url=dribble-statistic-facedown.ngrok-free.dev
    Write-Host "`n[WARNING] Tunnel bi ngat. Tu dong ket noi lai ngrok trong 3 giây..." -ForegroundColor Red
    Start-Sleep -Seconds 3
}

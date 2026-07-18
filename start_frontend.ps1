# Start Frontend AI Traffic Control System
# Run from project root: .\start_frontend.ps1

Write-Host "Starting AI Traffic Control Frontend..." -ForegroundColor Cyan

Set-Location frontend

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing npm packages..." -ForegroundColor Yellow
    npm install
}

Write-Host ""
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host ""

npm run dev

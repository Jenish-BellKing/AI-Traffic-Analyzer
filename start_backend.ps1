# Start Backend AI Traffic Control System
# Run from project root: .\start_backend.ps1

Write-Host "Starting AI Traffic Control Backend..." -ForegroundColor Cyan

# Activate venv
$venvPath = Join-Path $PSScriptRoot "venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    & $venvPath
    Write-Host "Virtual environment activated" -ForegroundColor Green
} else {
    Write-Host "venv not found using system Python" -ForegroundColor Yellow
}

# Check if requirements are installed
try {
    python -c "import fastapi, uvicorn, cv2" 2>$null
    Write-Host "Dependencies found" -ForegroundColor Green
} catch {
    Write-Host "Installing requirements..." -ForegroundColor Yellow
    pip install -r backend\requirements.txt
}

Write-Host ""
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""

# Start uvicorn
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# AI Dynamic Traffic Signal Control System

<p align="center">
  <img src="https://img.shields.io/badge/YOLOv8-Detection-00ff88?style=for-the-badge" />
  <img src="https://img.shields.io/badge/FastAPI-Backend-00d4ff?style=for-the-badge" />
  <img src="https://img.shields.io/badge/React-Frontend-aa44ff?style=for-the-badge" />
</p>

Real-time AI-powered traffic signal management with YOLO vehicle detection, ByteTrack multi-object tracking, and an intelligent adaptive signal timing engine.

---

## Quick Start

### 1. Install Backend Dependencies

```powershell
cd d:\Career\Hackathons\Makeathon

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install Python packages
pip install -r backend\requirements.txt
```

### 2. Start Backend

```powershell
# From project root (with venv activated)
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: **http://localhost:8000**  
API docs: **http://localhost:8000/docs**

### 3. Install & Start Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:3000**

---

## Features

| Module | Description |
|--------|-------------|
| **Live Camera Input** | MP4 upload, RTSP streams, built-in simulation |
| **YOLO Analyzer** | YOLOv8n detection + ByteTrack tracking |
| **AI Decision Engine** | Weighted traffic score → dynamic green time |
| **Traffic Signal** | Animated 3-light with glow + countdown timer |
| **Dashboard** | 8 stat cards, 4 Recharts panels, detection table |

## Architecture

```
Frontend (React 3000) ←→ WebSocket ←→ Backend (FastAPI 8000)
                                           ↓
                                    YOLO Detector
                                    Traffic Analyzer  
                                    Signal Controller
                                    Mock Simulation
                                    SQLite Database
```

## Algorithm

```
Traffic Score = 0.35 × Vehicle Count
              + 0.25 × Queue Length
              + 0.20 × Density
              + 0.10 × Waiting Time
              + 0.10 × Emergency Priority

Green Time = clamp(20 + Score × 100, 20s, 120s)
```

## Emergency Override

When an emergency vehicle is detected:
- Current lane immediately switches to **GREEN**
- All other directions held **RED**
- Minimum 45-second green duration
- Dashboard flashes red emergency banner

## Project Structure

```
Makeathon/
├── backend/
│   ├── main.py                  ← FastAPI app
│   ├── models/
│   │   ├── yolo_detector.py     ← YOLO + ByteTrack
│   │   ├── traffic_analyzer.py  ← Metrics extraction
│   │   └── schemas.py           ← Pydantic models
│   ├── services/
│   │   ├── signal_controller.py ← AI decision engine
│   │   └── video_stream.py      ← Frame processing loop
│   ├── simulation/
│   │   └── mock_simulation.py   ← Synthetic traffic
│   └── database/                ← SQLite via SQLAlchemy
├── frontend/
│   ├── src/
│   │   ├── components/          ← React components
│   │   ├── pages/               ← Dashboard page
│   │   ├── hooks/               ← WebSocket hook
│   │   └── services/            ← API layer
│   └── index.html
└── README.md
```

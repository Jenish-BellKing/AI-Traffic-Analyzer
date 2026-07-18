"""
FastAPI main application.
Entry point for the AI Dynamic Traffic Signal Control System backend.
"""

import asyncio
import logging
import os
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from backend.database.db import init_db
from backend.api.websocket_manager import manager as ws_manager
from backend.api.routes.video import router as video_router
from backend.api.routes.signal import router as signal_router
from backend.services.video_stream import stream_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: startup / shutdown
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initialising database...")
    await init_db()

    # Store the running event loop so background threads can schedule coroutines
    app.state.event_loop = asyncio.get_event_loop()

    # Auto-start simulation/video wall so the dashboard is live immediately with 4 cameras
    logger.info("Auto-starting 4-way CCTV Monitoring feeds...")
    stream_service.start_simulation({}, app.state.event_loop)

    logger.info("🚦 AI Traffic System ready.")
    yield

    # Shutdown
    logger.info("Shutting down...")
    stream_service.stop()


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="AI Dynamic Traffic Signal Control",
    description="YOLO v26-powered real-time traffic management system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(video_router)
app.include_router(signal_router)


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    client_id = str(uuid.uuid4())
    await ws_manager.connect(client_id, ws)
    try:
        while True:
            # Keep connection alive; we only send data server→client
            data = await ws.receive_text()
            # Handle client commands if needed
            if data == "ping":
                await ws_manager.send_to(client_id, {"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(client_id)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "AI Traffic Signal Control",
        "version": "1.0.0",
        "stream_status": stream_service.status,
        "ws_clients": ws_manager.count,
        "frames_processed": stream_service.frames_processed,
    }


@app.get("/api/system/info")
async def system_info():
    import platform
    try:
        import torch
        gpu = torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU only"
    except Exception:
        gpu = "CPU only"

    return {
        "python": platform.python_version(),
        "os": platform.system(),
        "gpu": gpu,
        "yolo_loaded": stream_service._detector._loaded,
        "session_id": stream_service.session_id,
    }

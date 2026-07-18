"""
Video upload and stream control API routes.
"""

import os
import shutil
import uuid
from pathlib import Path

import cv2
from fastapi import APIRouter, File, HTTPException, UploadFile, Request
from fastapi.responses import JSONResponse

from backend.models.schemas import SimulationConfig, SystemStatus, UploadResponse
from backend.services.video_stream import stream_service

router = APIRouter(prefix="/api/video", tags=["video"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/upload", response_model=UploadResponse)
async def upload_video(request: Request, file: UploadFile = File(...)):
    """Upload an MP4 video file for processing."""
    if not file.filename.lower().endswith((".mp4", ".avi", ".mkv", ".mov")):
        raise HTTPException(status_code=400, detail="Only video files are supported (mp4, avi, mkv, mov)")

    save_path = UPLOAD_DIR / f"{uuid.uuid4()}_{file.filename}"
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Probe video metadata
    cap = cv2.VideoCapture(str(save_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0
    cap.release()

    loop = request.app.state.event_loop
    stream_service.start_video(str(save_path), loop)

    return UploadResponse(
        session_id=stream_service.session_id,
        filename=file.filename,
        duration_sec=round(duration, 2),
        fps=round(fps, 2),
        resolution=[width, height],
        message="Video processing started successfully.",
    )


@router.post("/start-simulation")
async def start_simulation(request: Request, config: SimulationConfig = None):
    """Start the mock traffic simulation."""
    cfg = config.model_dump() if config else {}
    loop = request.app.state.event_loop
    stream_service.start_simulation(cfg, loop)
    return {"message": "Simulation started", "session_id": stream_service.session_id}


@router.post("/pause")
async def pause_stream():
    stream_service.pause()
    return {"status": stream_service.status}


@router.post("/resume")
async def resume_stream():
    stream_service.resume()
    return {"status": stream_service.status}


@router.post("/stop")
async def stop_stream():
    stream_service.stop()
    return {"status": "stopped"}


@router.post("/reset")
async def reset_stream():
    stream_service.reset()
    return {"status": "idle"}


@router.get("/status", response_model=SystemStatus)
async def get_status():
    from backend.api.websocket_manager import manager as ws_manager
    return SystemStatus(
        status=stream_service.status,
        session_id=stream_service.session_id,
        source=stream_service.source,
        uptime_sec=round(stream_service.uptime, 1),
        frames_processed=stream_service.frames_processed,
        connected_clients=ws_manager.count,
    )

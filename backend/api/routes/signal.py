"""
Signal and metrics REST API routes.
Provides snapshot access to current signal state and historical data.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.db import get_db
from backend.database.crud import get_recent_records
from backend.models.schemas import SignalPhase, TrafficMetrics
from backend.services.video_stream import stream_service

router = APIRouter(prefix="/api/signal", tags=["signal"])


@router.get("/current", response_model=SignalPhase)
async def get_current_signal():
    """Return the current signal state."""
    if stream_service.last_signal:
        return stream_service.last_signal
    return SignalPhase()


@router.get("/metrics", response_model=TrafficMetrics)
async def get_current_metrics():
    """Return the latest traffic metrics snapshot."""
    if stream_service.last_metrics:
        return stream_service.last_metrics
    return TrafficMetrics()


@router.get("/history")
async def get_history(
    session_id: str = None,
    limit: int = 200,
    db: AsyncSession = Depends(get_db),
):
    """Return historical traffic records for chart rendering."""
    records = await get_recent_records(db, session_id=session_id, limit=limit)
    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "vehicle_count": r.vehicle_count_total,
            "congestion_index": r.congestion_index,
            "avg_speed": r.avg_speed_kmh,
            "signal_phase": r.signal_phase,
            "green_time": r.green_time,
            "traffic_score": r.traffic_score,
        }
        for r in records
    ]

"""
CRUD operations for traffic records.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.database.db_models import TrafficRecord, SessionLog
from backend.models.schemas import TrafficMetrics, SignalPhase
from datetime import datetime
from typing import List, Optional


async def save_traffic_record(
    db: AsyncSession,
    session_id: str,
    metrics: TrafficMetrics,
    signal: SignalPhase,
) -> TrafficRecord:
    record = TrafficRecord(
        session_id=session_id,
        vehicle_count_total=metrics.vehicle_count.total,
        cars=metrics.vehicle_count.cars,
        bikes=metrics.vehicle_count.bikes,
        buses=metrics.vehicle_count.buses,
        trucks=metrics.vehicle_count.trucks,
        pedestrians=metrics.vehicle_count.pedestrians,
        emergency_vehicles=metrics.vehicle_count.emergency_vehicles,
        avg_speed_kmh=metrics.vehicle_speed.average_kmh,
        congestion_index=metrics.congestion.congestion_index,
        road_utilization_pct=metrics.congestion.road_utilization_pct,
        signal_phase=signal.phase,
        green_time=signal.recommended_green_time,
        traffic_score=signal.traffic_score,
        emergency_override=signal.emergency_override,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_recent_records(
    db: AsyncSession,
    session_id: Optional[str] = None,
    limit: int = 100,
) -> List[TrafficRecord]:
    q = select(TrafficRecord).order_by(desc(TrafficRecord.timestamp)).limit(limit)
    if session_id:
        q = q.where(TrafficRecord.session_id == session_id)
    result = await db.execute(q)
    return result.scalars().all()


async def create_session(
    db: AsyncSession,
    session_id: str,
    source: str,
    filename: Optional[str] = None,
) -> SessionLog:
    log = SessionLog(session_id=session_id, source=source, filename=filename)
    db.add(log)
    await db.commit()
    await db.refresh(log)
    return log


async def close_session(
    db: AsyncSession,
    session_id: str,
    frames_processed: int,
) -> None:
    result = await db.execute(select(SessionLog).where(SessionLog.session_id == session_id))
    log = result.scalar_one_or_none()
    if log:
        log.ended_at = datetime.utcnow()
        log.frames_processed = frames_processed
        await db.commit()

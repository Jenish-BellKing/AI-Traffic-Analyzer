"""
SQLAlchemy ORM models for traffic data persistence.
"""

from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from backend.database.db import Base


class TrafficRecord(Base):
    """One record per processed frame (sampled, not every frame)."""
    __tablename__ = "traffic_records"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    # Vehicle counts
    vehicle_count_total = Column(Integer, default=0)
    cars = Column(Integer, default=0)
    bikes = Column(Integer, default=0)
    buses = Column(Integer, default=0)
    trucks = Column(Integer, default=0)
    pedestrians = Column(Integer, default=0)
    emergency_vehicles = Column(Integer, default=0)

    # Speed
    avg_speed_kmh = Column(Float, default=0.0)

    # Congestion
    congestion_index = Column(Float, default=0.0)
    road_utilization_pct = Column(Float, default=0.0)

    # Signal
    signal_phase = Column(String(16), default="red")
    green_time = Column(Float, default=30.0)
    traffic_score = Column(Float, default=0.0)

    # Priority
    emergency_override = Column(Boolean, default=False)


class SessionLog(Base):
    """One record per detection session."""
    __tablename__ = "session_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(64), unique=True, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)
    source = Column(String(32), default="simulation")
    filename = Column(String(256), nullable=True)
    frames_processed = Column(Integer, default=0)
    summary = Column(Text, nullable=True)

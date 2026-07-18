"""
Pydantic schemas for AI Traffic Signal Control System.
Defines the complete data contract for WebSocket messages.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Dict
from datetime import datetime
import uuid


# ---------------------------------------------------------------------------
# Detection schemas
# ---------------------------------------------------------------------------

class Detection(BaseModel):
    track_id: int
    class_name: str
    confidence: float
    bbox: List[float]          # [x, y, width, height] normalized 0-1
    speed_kmh: Optional[float] = 0.0
    lane_id: Optional[int] = 0


# ---------------------------------------------------------------------------
# Metric sub-schemas
# ---------------------------------------------------------------------------

class VehicleCount(BaseModel):
    total: int = 0
    cars: int = 0
    bikes: int = 0
    buses: int = 0
    trucks: int = 0
    autos: int = 0
    emergency_vehicles: int = 0
    pedestrians: int = 0


class LaneDensity(BaseModel):
    vehicles_per_lane: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    lane_occupancy_pct: List[float] = Field(default_factory=lambda: [0.0, 0.0, 0.0, 0.0])
    avg_queue_length: float = 0.0
    max_queue_length: float = 0.0


class VehicleSpeed(BaseModel):
    average_kmh: float = 0.0
    min_kmh: float = 0.0
    max_kmh: float = 0.0
    stopped_count: int = 0
    moving_count: int = 0


class TrafficFlow(BaseModel):
    vehicles_per_minute: float = 0.0
    arrival_rate: float = 0.0
    departure_rate: float = 0.0
    headway_sec: float = 0.0
    time_gap_sec: float = 0.0


class Congestion(BaseModel):
    congestion_index: float = 0.0       # 0.0 – 1.0
    road_utilization_pct: float = 0.0
    traffic_density: float = 0.0        # vehicles / km
    waiting_time_sec: float = 0.0
    average_delay_sec: float = 0.0


class SignalMetrics(BaseModel):
    green_time_remaining: float = 0.0
    red_time_remaining: float = 0.0
    estimated_clearance_time: float = 0.0
    required_green_time: float = 30.0


class PriorityDetection(BaseModel):
    emergency_vehicle_present: bool = False
    public_bus_present: bool = False
    vip_convoy: bool = False
    pedestrian_crossing_demand: int = 0


class WeatherCondition(BaseModel):
    condition: Literal["sunny", "rain", "fog", "night", "cloudy"] = "sunny"
    visibility: float = 1.0             # 0.0 – 1.0
    rain: bool = False
    fog: bool = False
    night: bool = False


class TrafficMetrics(BaseModel):
    vehicle_count: VehicleCount = Field(default_factory=VehicleCount)
    lane_density: LaneDensity = Field(default_factory=LaneDensity)
    vehicle_speed: VehicleSpeed = Field(default_factory=VehicleSpeed)
    traffic_flow: TrafficFlow = Field(default_factory=TrafficFlow)
    congestion: Congestion = Field(default_factory=Congestion)
    signal: SignalMetrics = Field(default_factory=SignalMetrics)
    priority: PriorityDetection = Field(default_factory=PriorityDetection)
    weather: WeatherCondition = Field(default_factory=WeatherCondition)


# ---------------------------------------------------------------------------
# Signal state schema
# ---------------------------------------------------------------------------

class SignalPhase(BaseModel):
    phase: Literal["green", "yellow", "red"] = "red"
    countdown: float = 30.0
    recommended_green_time: float = 30.0
    traffic_score: float = 0.0
    confidence: float = 0.0
    reasoning: str = "Awaiting detection data..."
    emergency_override: bool = False
    bus_priority: bool = False


# ---------------------------------------------------------------------------
# Camera stream schema
# ---------------------------------------------------------------------------

class CameraFrameData(BaseModel):
    frame_base64: Optional[str] = None
    detections: List[Detection] = Field(default_factory=list)
    metrics: TrafficMetrics = Field(default_factory=TrafficMetrics)
    signal_state: SignalPhase = Field(default_factory=SignalPhase)
    name: str = ""


# ---------------------------------------------------------------------------
# Full WebSocket frame message
# ---------------------------------------------------------------------------

class FrameData(BaseModel):
    type: str = "traffic_update"
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    frame_base64: Optional[str] = None     # JPEG frame as base64 string
    fps: float = 0.0
    resolution: List[int] = Field(default_factory=lambda: [1280, 720])
    metrics: TrafficMetrics = Field(default_factory=TrafficMetrics)
    signal_state: SignalPhase = Field(default_factory=SignalPhase)
    detections: List[Detection] = Field(default_factory=list)
    source: Literal["video", "rtsp", "simulation"] = "simulation"
    cameras: Optional[Dict[str, CameraFrameData]] = None


# ---------------------------------------------------------------------------
# API request/response schemas
# ---------------------------------------------------------------------------

class UploadResponse(BaseModel):
    session_id: str
    filename: str
    duration_sec: float
    fps: float
    resolution: List[int]
    message: str


class SimulationConfig(BaseModel):
    lanes: int = 4
    duration_sec: int = 300
    vehicle_density: float = 0.5
    emergency_frequency: float = 0.05
    weather: str = "sunny"


class SystemStatus(BaseModel):
    status: Literal["idle", "running", "paused", "stopped"] = "idle"
    session_id: Optional[str] = None
    source: Optional[str] = None
    uptime_sec: float = 0.0
    frames_processed: int = 0
    connected_clients: int = 0


class HistoricalRecord(BaseModel):
    id: int
    session_id: str
    timestamp: str
    vehicle_count: int
    congestion_index: float
    avg_speed: float
    signal_phase: str
    green_time: float
    traffic_score: float

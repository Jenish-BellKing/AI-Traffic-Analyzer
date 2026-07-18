"""
Traffic parameter extractor. Aggregates per-frame detections into
all the metrics defined in schemas.py.
"""

import math
import time
from collections import deque
from typing import Dict, List

from backend.models.schemas import (
    Congestion, LaneDensity, PriorityDetection, SignalMetrics,
    TrafficFlow, TrafficMetrics, VehicleCount, VehicleSpeed, WeatherCondition,
)


class TrafficAnalyzer:
    """
    Stateful traffic analyzer: maintains rolling windows so metrics
    smoothly reflect recent history rather than just one frame.
    """

    # Rolling window sizes
    SPEED_WINDOW = 30       # frames for speed smoothing
    FLOW_WINDOW = 60        # frames (~2s at 30fps) for flow rate
    COUNT_HISTORY = 300     # frames of vehicle count history

    def __init__(self, num_lanes: int = 4, fps: float = 25.0):
        self.num_lanes = num_lanes
        self.fps = fps

        self._speed_history: deque = deque(maxlen=self.SPEED_WINDOW)
        self._count_history: deque = deque(maxlen=self.COUNT_HISTORY)
        self._flow_timestamps: deque = deque(maxlen=self.FLOW_WINDOW * 60)

        # Per-lane queues
        self._lane_counts: List[deque] = [
            deque(maxlen=self.SPEED_WINDOW) for _ in range(num_lanes)
        ]

        self._frame_count = 0
        self._start_time = time.time()

        # Congestion rolling average
        self._congestion_history: deque = deque(maxlen=self.SPEED_WINDOW)

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    def analyze(
        self,
        detections: List[dict],
        frame_width: int = 1280,
        frame_height: int = 720,
    ) -> TrafficMetrics:
        self._frame_count += 1
        ts = time.time()

        vehicle_count = self._count_vehicles(detections)
        lane_density = self._compute_lane_density(detections, frame_width, num_lanes=self.num_lanes)
        vehicle_speed = self._compute_speed(detections)
        traffic_flow = self._compute_flow(detections, ts)
        congestion = self._compute_congestion(vehicle_count, lane_density, vehicle_speed)
        signal_metrics = self._compute_signal_metrics(congestion, vehicle_count)
        priority = self._compute_priority(detections, vehicle_count)
        weather = self._detect_weather()  # brightness-based heuristic

        return TrafficMetrics(
            vehicle_count=vehicle_count,
            lane_density=lane_density,
            vehicle_speed=vehicle_speed,
            traffic_flow=traffic_flow,
            congestion=congestion,
            signal=signal_metrics,
            priority=priority,
            weather=weather,
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _count_vehicles(detections: List[dict]) -> VehicleCount:
        counts: Dict[str, int] = {
            "car": 0, "bus": 0, "truck": 0,
            "motorcycle": 0, "bicycle": 0,
            "pedestrian": 0, "emergency": 0, "auto": 0,
        }
        for d in detections:
            cls = d.get("class_name", "car")
            if cls in counts:
                counts[cls] += 1
            elif cls in ("motorcycle",):
                counts["motorcycle"] += 1

        return VehicleCount(
            total=len(detections),
            cars=counts["car"],
            bikes=counts["motorcycle"] + counts["bicycle"],
            buses=counts["bus"],
            trucks=counts["truck"],
            autos=counts["auto"],
            emergency_vehicles=counts["emergency"],
            pedestrians=counts["pedestrian"],
        )

    def _compute_lane_density(
        self, detections: List[dict], frame_width: int, num_lanes: int = 4
    ) -> LaneDensity:
        lane_counts = [0] * num_lanes
        for d in detections:
            lid = min(int(d.get("lane_id", 0)), num_lanes - 1)
            lane_counts[lid] += 1

        # Update rolling average
        for i, cnt in enumerate(lane_counts):
            self._lane_counts[i].append(cnt)

        # Smooth by rolling average
        smooth_counts = [
            sum(self._lane_counts[i]) / max(len(self._lane_counts[i]), 1)
            for i in range(num_lanes)
        ]

        total = max(sum(smooth_counts), 1)
        lane_occ = [min(c / 15.0 * 100, 100.0) for c in smooth_counts]  # 15 veh = 100% occupancy

        avg_q = sum(smooth_counts) / num_lanes
        max_q = max(smooth_counts)

        return LaneDensity(
            vehicles_per_lane=[round(c, 2) for c in smooth_counts],
            lane_occupancy_pct=[round(o, 1) for o in lane_occ],
            avg_queue_length=round(avg_q, 2),
            max_queue_length=round(max_q, 2),
        )

    def _compute_speed(self, detections: List[dict]) -> VehicleSpeed:
        speeds = [d.get("speed_kmh", 0.0) for d in detections if d.get("class_name") != "pedestrian"]
        if speeds:
            self._speed_history.append(sum(speeds) / len(speeds))
        else:
            self._speed_history.append(0.0)

        avg = sum(self._speed_history) / max(len(self._speed_history), 1)
        stopped = sum(1 for s in speeds if s < 3.0)
        moving = len(speeds) - stopped

        return VehicleSpeed(
            average_kmh=round(avg, 1),
            min_kmh=round(min(speeds, default=0.0), 1),
            max_kmh=round(max(speeds, default=0.0), 1),
            stopped_count=stopped,
            moving_count=moving,
        )

    def _compute_flow(self, detections: List[dict], ts: float) -> TrafficFlow:
        # Record arrival timestamps (proxy: one entry per detected vehicle)
        for _ in detections:
            self._flow_timestamps.append(ts)

        # Count arrivals in last 60 seconds
        cutoff = ts - 60.0
        recent = [t for t in self._flow_timestamps if t >= cutoff]
        vpm = len(recent) / 60.0 * 60  # vehicles per minute

        # Arrival / departure rate (vehicles/sec)
        arrival = len(recent) / max(ts - self._start_time, 1)
        departure = arrival * 0.92  # simulated departure slightly lower

        headway = 60.0 / max(vpm, 1) if vpm > 0 else 999.0
        time_gap = headway * 0.85

        return TrafficFlow(
            vehicles_per_minute=round(vpm, 1),
            arrival_rate=round(arrival, 4),
            departure_rate=round(departure, 4),
            headway_sec=round(headway, 2),
            time_gap_sec=round(time_gap, 2),
        )

    def _compute_congestion(
        self,
        vc: VehicleCount,
        ld: LaneDensity,
        vs: VehicleSpeed,
    ) -> Congestion:
        # Congestion index: weighted blend of occupancy, speed factor, density
        avg_occ = sum(ld.lane_occupancy_pct) / max(len(ld.lane_occupancy_pct), 1) / 100.0
        speed_factor = 1.0 - min(vs.average_kmh / 60.0, 1.0)  # higher speed = lower congestion
        density_factor = min(vc.total / 50.0, 1.0)

        ci = 0.4 * avg_occ + 0.35 * speed_factor + 0.25 * density_factor
        ci = max(0.0, min(1.0, ci))
        self._congestion_history.append(ci)
        smooth_ci = sum(self._congestion_history) / len(self._congestion_history)

        road_util = avg_occ * 100
        traffic_density = vc.total / max(sum(ld.lane_occupancy_pct) / 100 + 0.1, 0.1)

        # Waiting time heuristic: higher congestion = longer wait
        waiting = smooth_ci * 120.0
        avg_delay = waiting * 0.75

        return Congestion(
            congestion_index=round(smooth_ci, 4),
            road_utilization_pct=round(road_util, 1),
            traffic_density=round(traffic_density, 2),
            waiting_time_sec=round(waiting, 1),
            average_delay_sec=round(avg_delay, 1),
        )

    @staticmethod
    def _compute_signal_metrics(congestion: Congestion, vc: VehicleCount) -> SignalMetrics:
        # Required green time based on congestion and queue
        base = 20.0
        required = base + congestion.congestion_index * 80 + vc.total * 0.8
        required = max(20.0, min(120.0, required))

        clearance = required * 1.15  # add buffer

        return SignalMetrics(
            green_time_remaining=0.0,   # filled in by signal controller
            red_time_remaining=0.0,
            estimated_clearance_time=round(clearance, 1),
            required_green_time=round(required, 1),
        )

    @staticmethod
    def _compute_priority(detections: List[dict], vc: VehicleCount) -> PriorityDetection:
        emergency_present = any(d.get("class_name") == "emergency" for d in detections)
        bus_present = vc.buses > 0
        pedestrian_demand = vc.pedestrians

        return PriorityDetection(
            emergency_vehicle_present=emergency_present,
            public_bus_present=bus_present,
            vip_convoy=False,
            pedestrian_crossing_demand=pedestrian_demand,
        )

    @staticmethod
    def _detect_weather() -> WeatherCondition:
        """
        In production: analyze frame brightness/saturation.
        For demo: returns sunny with full visibility.
        """
        return WeatherCondition(
            condition="sunny",
            visibility=1.0,
            rain=False,
            fog=False,
            night=False,
        )

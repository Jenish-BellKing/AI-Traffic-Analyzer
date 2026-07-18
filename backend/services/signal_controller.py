"""
AI Decision Engine for dynamic traffic signal timing.
Implements the weighted traffic score formula and manages 4-phase signal cycling.
"""

import math
import time
import logging
from typing import Optional, Dict

from backend.models.schemas import SignalPhase, TrafficMetrics

logger = logging.getLogger(__name__)

# Timing bounds (seconds)
MIN_GREEN = 20.0
MAX_GREEN = 120.0
YELLOW_DURATION = 4.0
MIN_RED = 15.0

# Emergency override settings
EMERGENCY_GREEN_DURATION = 45.0
EMERGENCY_HOLD = True


class SignalController:
    """
    Manages a 4-phase traffic signal junction.
    Cycle: North → East → South → West
    """

    def __init__(self):
        self.phases = ["north", "east", "south", "west"]
        self.active_index = 0  # Starts with North Green
        self.current_state = "green"  # green | yellow
        self.phase_start: float = time.time()
        self.phase_duration: float = 30.0
        
        # Recommended timings
        self.recommended_green: float = 30.0
        self.traffic_score: float = 0.0
        self.confidence: float = 0.0
        self.reasoning: str = "System initializing..."
        self.emergency_override: bool = False
        self.emergency_direction: Optional[str] = None
        self.bus_priority: bool = False

        # Keep track of decision history
        self.decision_logs = []
        self._last_log_time = 0.0

    def update_junction(self, camera_metrics: Dict[str, TrafficMetrics]) -> Dict[str, SignalPhase]:
        """
        Called every frame. Computes signal states for all 4 directions.
        Returns a dict mapping direction name to its SignalPhase.
        """
        now = time.time()
        elapsed = now - self.phase_start

        # Calculate scores for all directions
        scores = {}
        for direction, metrics in camera_metrics.items():
            scores[direction] = self._compute_direction_score(metrics, direction)

        # Active direction
        active_direction = self.phases[self.active_index]
        active_metrics = camera_metrics.get(active_direction, TrafficMetrics())
        active_score_data = scores.get(active_direction, (0.0, "Normal", 0.9))

        self.traffic_score = active_score_data[0]
        self.confidence = active_score_data[2]
        self.bus_priority = active_metrics.priority.public_bus_present

        # Compute dynamic green duration for active direction based on its score
        rec_green = self._score_to_green_time(self.traffic_score, active_metrics)
        self.recommended_green = rec_green

        # Check for emergency on any direction
        emergency_detected = False
        emergency_dir = None
        for direction, metrics in camera_metrics.items():
            if metrics.priority.emergency_vehicle_present:
                emergency_detected = True
                emergency_dir = direction
                break

        # Emergency override logic
        if emergency_detected and not self.emergency_override:
            self.emergency_override = True
            self.emergency_direction = emergency_dir
            # Switch signal immediately to green for the emergency direction
            if emergency_dir in self.phases:
                self.active_index = self.phases.index(emergency_dir)
            self.current_state = "green"
            self.phase_start = now
            self.phase_duration = EMERGENCY_GREEN_DURATION
            self.reasoning = (
                f"🚨 EMERGENCY OVERRIDE: Emergency vehicle detected on {emergency_dir.upper()} Road! "
                f"Forced Green path active. All other intersections held RED."
            )
            self._add_log(self.reasoning)
            logger.warning(f"Emergency override activated for {emergency_dir}.")

        elif self.emergency_override and not emergency_detected:
            self.emergency_override = False
            self.emergency_direction = None
            self.reasoning = "Emergency cleared. Resuming normal automated signal cycle."
            self._add_log(self.reasoning)
            # Advance phase immediately
            self._advance_phase(rec_green)

        # Normal phase transition logic
        if not self.emergency_override and elapsed >= self.phase_duration:
            self._advance_phase(rec_green)
            active_direction = self.phases[self.active_index]
            active_metrics = camera_metrics.get(active_direction, TrafficMetrics())
            active_score_data = scores.get(active_direction, (0.0, "Normal", 0.9))
            self.traffic_score = active_score_data[0]
            self.confidence = active_score_data[2]
            rec_green = self._score_to_green_time(self.traffic_score, active_metrics)
            self.recommended_green = rec_green

        # Calculate remaining time
        remaining = max(0.0, self.phase_duration - elapsed)

        # Log periodic updates or changes in conditions
        if not self.emergency_override and now - self._last_log_time > 15.0:
            active_name = active_direction.upper()
            if self.traffic_score > 0.65:
                log_msg = f"Congestion elevated on {active_name} Road (Score: {self.traffic_score:.2f}). Green extended to {self.recommended_green:.0f}s."
            else:
                log_msg = f"Traffic stable. {active_name} Phase running normally. Next: {self.phases[(self.active_index + 1) % 4].upper()} Road."
            self._add_log(log_msg)
            self._last_log_time = now

        # Build signal phase objects for all directions
        results = {}
        for direction in self.phases:
            is_active = (direction == active_direction)
            phase_type = "red"
            
            if is_active:
                phase_type = "green" if self.current_state == "green" else "yellow"

            dir_metrics = camera_metrics.get(direction, TrafficMetrics())
            dir_score, dir_reasoning, dir_conf = scores.get(direction, (0.0, "Normal", 0.9))

            # Populate countdowns in metrics
            if phase_type == "green":
                dir_metrics.signal.green_time_remaining = round(remaining, 1)
                dir_metrics.signal.red_time_remaining = 0.0
            else:
                dir_metrics.signal.red_time_remaining = round(remaining, 1)
                dir_metrics.signal.green_time_remaining = 0.0
            
            dir_metrics.signal.required_green_time = round(rec_green, 1)

            results[direction] = SignalPhase(
                phase=phase_type,
                countdown=round(remaining, 1),
                recommended_green_time=round(self.recommended_green, 1),
                traffic_score=round(dir_score, 4),
                confidence=round(dir_conf, 4),
                reasoning=dir_reasoning if is_active else f"Waiting queue. Current pressure: {dir_score:.2f}",
                emergency_override=self.emergency_override and (self.emergency_direction == direction),
                bus_priority=dir_metrics.priority.public_bus_present,
            )

        return results

    def _advance_phase(self, rec_green: float):
        """Cycle: Green -> Yellow -> Red (Move to next direction Green)."""
        if self.current_state == "green":
            self.current_state = "yellow"
            self.phase_duration = YELLOW_DURATION
            self.reasoning = f"⚠️ Phase transitioning. Clearing {self.phases[self.active_index].upper()} intersection."
        else:
            self.current_state = "green"
            self.active_index = (self.active_index + 1) % len(self.phases)
            self.phase_duration = rec_green
            active_name = self.phases[self.active_index].upper()
            self.reasoning = f"🚦 AI Decision: Active green switched to {active_name} Road for {rec_green:.0f} seconds."
            self._add_log(self.reasoning)

        self.phase_start = time.time()
        logger.info(f"Signal Phase Switch: {self.phases[self.active_index]} is {self.current_state} for {self.phase_duration:.1f}s")

    def _compute_direction_score(self, metrics: TrafficMetrics, direction: str):
        """
        Traffic Pressure = 0.30 * Queue Length + 0.25 * Lane Occupancy + 0.20 * Vehicle Count + 0.15 * Waiting Time + 0.10 * Emergency Priority
        Values are normalized relative to typical peak levels:
        - Queue Length: max queue normalized to 20
        - Lane Occupancy: percentage normalized 0-100%
        - Vehicle Count: total vehicles normalized to 50
        - Waiting Time: average wait time normalized to 120s
        - Emergency Priority: binary 1 or 0
        """
        vc = metrics.vehicle_count
        ld = metrics.lane_density
        cg = metrics.congestion
        pr = metrics.priority

        # Normalize components for score matching [0, 1] range
        queue_val = min(ld.max_queue_length / 20.0, 1.0)
        occupancy_val = min(sum(ld.lane_occupancy_pct) / max(len(ld.lane_occupancy_pct) * 100.0, 1.0), 1.0)
        count_val = min(vc.total / 50.0, 1.0)
        waiting_val = min(cg.waiting_time_sec / 120.0, 1.0)
        emergency_val = 1.0 if pr.emergency_vehicle_present else 0.0

        # Weighted calculation
        score = (
            0.30 * queue_val
            + 0.25 * occupancy_val
            + 0.20 * count_val
            + 0.15 * waiting_val
            + 0.10 * emergency_val
        )
        score = max(0.0, min(1.0, score))

        # Confidence metric
        confidence = 0.8 + 0.2 * count_val

        # Reasoning details
        reasons = []
        if pr.emergency_vehicle_present:
            reasons.append("🚨 Emergency vehicle priority activated")
        elif pr.public_bus_present:
            reasons.append("🚌 Public transit priority applied")
        
        if queue_val > 0.6:
            reasons.append(f"High queue length ({ld.max_queue_length:.0f} vehicles)")
        if occupancy_val > 0.6:
            reasons.append("Lane occupancy exceeding critical limit")
        if waiting_val > 0.5:
            reasons.append(f"Waiting delay {cg.waiting_time_sec:.0f}s is elevated")

        reasoning = ", ".join(reasons) if reasons else f"Flow stable. Pressure index {score:.2f}."

        return score, reasoning, confidence

    def _score_to_green_time(self, score: float, metrics: TrafficMetrics) -> float:
        """Map traffic score [0,1] to green duration [20, 120] seconds."""
        base_green = MIN_GREEN + score * (MAX_GREEN - MIN_GREEN)

        if metrics.priority.public_bus_present:
            base_green *= 1.15  # Bus priority bonus

        # Weather factors
        wc = metrics.weather
        if wc.fog:
            base_green *= 0.85
        elif wc.rain:
            base_green *= 0.90

        return max(MIN_GREEN, min(MAX_GREEN, base_green))

    def _add_log(self, text: str):
        ts = time.strftime("%H:%M:%S")
        self.decision_logs.append({"time": ts, "message": text})
        # Limit logs to latest 40 entries
        if len(self.decision_logs) > 40:
            self.decision_logs.pop(0)

    # Legacy method compatibility
    def update(self, metrics: TrafficMetrics) -> SignalPhase:
        """Single-camera fallback method."""
        # Create a mock camera metrics set to reuse the upgraded logic
        dummy_metrics = {"north": metrics, "south": TrafficMetrics(), "east": TrafficMetrics(), "west": TrafficMetrics()}
        results = self.update_junction(dummy_metrics)
        return results["north"]

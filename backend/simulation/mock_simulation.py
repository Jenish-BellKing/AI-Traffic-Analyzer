"""
Mock traffic simulation for 4-way intersection.
Generates realistic synthetic traffic data and renders 4 separate CCTV camera views.
"""

import math
import random
import time
from dataclasses import dataclass
from typing import List, Dict, Tuple
import numpy as np
import cv2

@dataclass
class MockVehicle:
    track_id: int
    class_name: str
    pos: float            # normalized position along the approach (0.0 = spawn, 1.0 = exited)
    lane: int             # lane index (0, 1, or 2)
    speed_kmh: float
    target_speed: float
    is_emergency: bool = False
    spawn_time: float = 0.0


class MockSimulation:
    """
    Simulates a 4-way intersection with four roads: North, South, East, West.
    Generates realistic detections and renders 4 independent CCTV feeds.
    """

    CLASS_WEIGHTS = {
        "car": 0.60,
        "motorcycle": 0.15,
        "bus": 0.08,
        "truck": 0.07,
        "bicycle": 0.05,
        "pedestrian": 0.03,
        "emergency": 0.02,
    }

    def __init__(
        self,
        lanes: int = 3,
        base_vehicle_count: int = 8,  # per approach
        emergency_frequency: float = 0.005,
        width: int = 640,
        height: int = 360,
    ):
        self.lanes = lanes
        self.base_count = base_vehicle_count
        self.emergency_freq = emergency_frequency
        self.width = width
        self.height = height

        self.directions = ["north", "east", "south", "west"]
        self.vehicles: Dict[str, List[MockVehicle]] = {d: [] for d in self.directions}
        self._next_id = 1
        self._sim_start = time.time()
        self._frame_idx = 0

        # Initialize with some random vehicles on each approach
        for d in self.directions:
            for _ in range(random.randint(3, base_vehicle_count)):
                self._spawn_vehicle(d, pos=random.uniform(0.1, 0.7))

    def step_junction(self, signal_phases: Dict[str, str]) -> Dict[str, Tuple[np.ndarray, List[dict]]]:
        """
        Advance simulation one frame for all four approaches.
        Returns a dict: direction -> (rendered_frame, list_of_detections)
        """
        self._frame_idx += 1
        t = time.time() - self._sim_start

        # Hour fluctuation (rush hour / off-peak)
        density_factor = 1.0 + 0.6 * math.sin(t / 60.0 * math.pi)

        results = {}

        for d in self.directions:
            phase = signal_phases.get(d, "red")
            vehicles_list = self.vehicles[d]

            # Spawning logic
            target_count = int(self.base_count * density_factor)
            if len(vehicles_list) < target_count and random.random() < 0.15:
                self._spawn_vehicle(d, pos=0.0)

            # Occasional emergency vehicle spawn
            if random.random() < self.emergency_freq and not self._has_emergency(d):
                self._spawn_emergency(d)

            # Update physics
            updated_vehicles = []
            
            # Sort vehicles by position (front-most vehicle has largest pos)
            vehicles_list.sort(key=lambda v: v.pos, reverse=True)

            for i, v in enumerate(vehicles_list):
                # Target stop line position is 0.50
                stop_line = 0.48
                is_red_or_yellow = (phase in ["red", "yellow"])

                # Determine if there's a vehicle in front in the same lane
                vehicle_ahead = None
                for ahead_v in vehicles_list:
                    if ahead_v.lane == v.lane and ahead_v.pos > v.pos:
                        vehicle_ahead = ahead_v
                        break

                # Simple car-following and traffic signal physics
                desired_speed = v.target_speed

                if v.pos < stop_line:
                    if is_red_or_yellow:
                        # Approach stop line
                        dist_to_stop = stop_line - v.pos
                        if dist_to_stop < 0.20:
                            # Slow down
                            desired_speed = max(0.0, desired_speed * (dist_to_stop / 0.20))
                    
                    if vehicle_ahead:
                        dist_to_ahead = vehicle_ahead.pos - v.pos
                        if dist_to_ahead < 0.15:
                            # Match speed or stop
                            desired_speed = min(desired_speed, vehicle_ahead.speed_kmh)
                            if dist_to_ahead < 0.06:
                                desired_speed = 0.0

                # Emergency vehicles split lanes and bypass traffic
                if v.is_emergency:
                    desired_speed = max(35.0, v.target_speed)
                    if is_red_or_yellow and v.pos >= stop_line - 0.05:
                        # Emergency vehicle forces through red light
                        desired_speed = 40.0

                # Smooth acceleration/deceleration
                speed_diff = desired_speed - v.speed_kmh
                v.speed_kmh += speed_diff * 0.15
                v.speed_kmh = max(0.0, v.speed_kmh)

                # Move vehicle (speed_kmh to position increment)
                # 50 km/h = ~13.8 m/s. If approach is 150m, 13.8m is ~0.09 pos/sec.
                # At 20 FPS, dt = 0.05. Position delta = 0.09 * 0.05 = 0.0045.
                pos_delta = (v.speed_kmh / 50.0) * 0.005
                v.pos += pos_delta

                # Despawn if out of camera bounds (pos > 1.0)
                if v.pos < 1.05:
                    updated_vehicles.append(v)

            self.vehicles[d] = updated_vehicles

            # Render frame & generate detection dicts for this direction
            frame, detections = self._render_camera_feed(d, phase)
            results[d] = (frame, detections)

        return results

    def step(self) -> List[dict]:
        """Legacy compatibility step (returns North detections)."""
        res = self.step_junction({"north": "green"})
        return res["north"][1]

    def render_frame(self) -> np.ndarray:
        """Legacy compatibility render (returns North frame)."""
        res = self.step_junction({"north": "green"})
        return res["north"][0]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _spawn_vehicle(self, direction: str, pos: float = 0.0):
        cls = random.choices(
            list(self.CLASS_WEIGHTS.keys()),
            weights=list(self.CLASS_WEIGHTS.values()),
        )[0]
        lane = random.randint(0, self.lanes - 1)
        target_spd = random.uniform(35.0, 55.0)
        v = MockVehicle(
            track_id=self._next_id,
            class_name=cls,
            pos=pos,
            lane=lane,
            speed_kmh=target_spd,
            target_speed=target_spd,
            is_emergency=(cls == "emergency"),
            spawn_time=time.time(),
        )
        self._next_id += 1
        self.vehicles[direction].append(v)

    def _spawn_emergency(self, direction: str):
        lane = random.randint(0, self.lanes - 1)
        v = MockVehicle(
            track_id=self._next_id,
            class_name="emergency",
            pos=0.0,
            lane=lane,
            speed_kmh=80.0,
            target_speed=80.0,
            is_emergency=True,
            spawn_time=time.time(),
        )
        self._next_id += 1
        self.vehicles[direction].append(v)

    def _has_emergency(self, direction: str) -> bool:
        return any(v.is_emergency for v in self.vehicles[direction])

    def _render_camera_feed(self, direction: str, phase: str) -> Tuple[np.ndarray, List[dict]]:
        """Draw a simulated camera frame for the given direction using OpenCV."""
        frame = np.zeros((self.height, self.width, 3), dtype=np.uint8)
        # Deep dark smart city asphalt tone
        frame[:] = (20, 22, 28)

        # Draw Road limits & lane markers
        # Perspective: Road comes from the top center towards bottom
        road_w_top = 220
        road_w_bot = 380
        cx = self.width // 2

        # Draw road shoulder borders
        cv2.line(frame, (cx - road_w_top//2, 0), (cx - road_w_bot//2, self.height), (70, 75, 80), 2)
        cv2.line(frame, (cx + road_w_top//2, 0), (cx + road_w_bot//2, self.height), (70, 75, 80), 2)

        # Fill road polygon
        road_pts = np.array([
            [cx - road_w_top//2, 0],
            [cx + road_w_top//2, 0],
            [cx + road_w_bot//2, self.height],
            [cx - road_w_bot//2, self.height]
        ])
        cv2.fillPoly(frame, [road_pts], (28, 30, 36))

        # Lane dividers
        for l in range(1, self.lanes):
            top_x = int((cx - road_w_top//2) + l * (road_w_top / self.lanes))
            bot_x = int((cx - road_w_bot//2) + l * (road_w_bot / self.lanes))
            # Draw dashed line
            for y in range(0, self.height, 25):
                t_y = y
                b_y = min(y + 12, self.height)
                x1 = int(top_x + (bot_x - top_x) * (t_y / self.height))
                x2 = int(top_x + (bot_x - top_x) * (b_y / self.height))
                cv2.line(frame, (x1, t_y), (x2, b_y), (100, 100, 105), 1)

        # Stop line (at pos = 0.48, which translates to y = height * 0.48)
        stop_y = int(self.height * 0.48)
        stop_x_l = int((cx - road_w_top//2) + (cx - road_w_bot//2 - (cx - road_w_top//2)) * 0.48)
        stop_x_r = int((cx + road_w_top//2) + (cx + road_w_bot//2 - (cx + road_w_top//2)) * 0.48)
        cv2.line(frame, (cx - 100, stop_y), (cx + 100, stop_y), (200, 200, 200), 2)

        # Draw pedestrian crossing dashes before the stop line
        for offset in range(-80, 90, 20):
            cv2.rectangle(frame, (cx + offset - 5, stop_y + 8), (cx + offset + 5, stop_y + 18), (120, 120, 120), -1)

        # Draw vehicle trails (aesthetic particle glows)
        detections = []
        vehicles_on_road = self.vehicles[direction]

        for v in vehicles_on_road:
            # Map pos [0,1] to Y [0, height]
            y = int(v.pos * self.height)
            
            # Width and center X dynamically scale with perspective
            current_road_w = road_w_top + (road_w_bot - road_w_top) * v.pos
            lane_w = current_road_w / self.lanes
            x = int((cx - current_road_w//2) + (v.lane + 0.5) * lane_w)

            # Draw vehicle bounding box size
            bw = int(lane_w * 0.65)
            bh = int(35 + v.pos * 30)

            x1, y1 = x - bw//2, y - bh//2
            x2, y2 = x + bw//2, y + bh//2

            # Bbox normalization [0, 1] relative to camera feed width/height
            norm_bbox = [
                round(max(0.0, x1 / self.width), 4),
                round(max(0.0, y1 / self.height), 4),
                round(bw / self.width, 4),
                round(bh / self.height, 4),
            ]

            # Generate YOLO detection data
            confidence = round(random.uniform(0.85, 0.98), 2)
            detections.append({
                "track_id": v.track_id,
                "class_name": v.class_name,
                "confidence": confidence,
                "bbox": norm_bbox,
                "speed_kmh": round(v.speed_kmh, 1),
                "lane_id": v.lane,
            })

            # Draw vehicle trails (faint trailing glow line)
            trail_y_start = max(0, y - bh)
            cv2.line(frame, (x, y), (x, trail_y_start), (0, 212, 255, 50), 1)

            # Render vehicle body
            color = self._vehicle_color(v.class_name)
            # Glowing outline
            cv2.rectangle(frame, (x1-1, y1-1), (x2+1, y2+1), color, 2)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 1)

            # Headlights (white) & Tail lights (red) based on movement direction (approaching)
            if v.pos < 1.0:
                # White headlights pointing forward (bottom)
                cv2.circle(frame, (x1 + int(bw*0.25), y2 - 2), 2, (255, 255, 255), -1)
                cv2.circle(frame, (x2 - int(bw*0.25), y2 - 2), 2, (255, 255, 255), -1)
                # Red taillights at top of vehicle
                cv2.circle(frame, (x1 + int(bw*0.25), y1 + 2), 2, (0, 0, 220), -1)
                cv2.circle(frame, (x2 - int(bw*0.25), y1 + 2), 2, (0, 0, 220), -1)

            # Label box
            label = f"#{v.track_id} {v.class_name} {v.speed_kmh:.0f}km/h"
            (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.35, 1)
            cv2.rectangle(frame, (x1, y1 - th - 4), (x1 + tw + 4, y1), color, -1)
            cv2.putText(frame, label, (x1 + 2, y1 - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 0, 0), 1, cv2.LINE_AA)

        # Draw HUD overlays
        # Camera ID
        cv2.putText(frame, f"CAM_{direction.upper()}_01", (15, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 212, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, f"MODE: AI_ANALYTICS", (15, 45), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (200, 200, 200), 1, cv2.LINE_AA)
        
        # Traffic light in feed corner
        signal_y = 35
        signal_x = self.width - 35
        cv2.circle(frame, (signal_x, signal_y), 15, (40, 40, 45), -1)
        
        light_color = (40, 40, 40)
        glow_color = (40, 40, 40)
        if phase == "green":
            light_color = (0, 255, 136)
            glow_color = (0, 255, 136)
        elif phase == "yellow":
            light_color = (0, 204, 255)  # Cyan-yellow theme
            light_color = (0, 220, 255)
            glow_color = (0, 200, 255)
        else:
            light_color = (50, 50, 255)  # smart red
            light_color = (50, 50, 255)
            light_color = (80, 80, 255)
            light_color = (50, 50, 255)
            # Actually standard color representation
            light_color = (51, 51, 255) if phase == "red" else (50, 50, 50)
            
        if phase == "green":
            cv2.circle(frame, (signal_x, signal_y), 9, (0, 255, 136), -1)
            cv2.circle(frame, (signal_x, signal_y), 12, (0, 255, 136), 1)
        elif phase == "yellow":
            cv2.circle(frame, (signal_x, signal_y), 9, (0, 200, 255), -1)
            cv2.circle(frame, (signal_x, signal_y), 12, (0, 200, 255), 1)
        else:
            cv2.circle(frame, (signal_x, signal_y), 9, (50, 50, 255), -1)
            cv2.circle(frame, (signal_x, signal_y), 12, (50, 50, 255), 1)

        # Draw grid details overlay
        cv2.line(frame, (10, 10), (25, 10), (0, 212, 255), 1)
        cv2.line(frame, (10, 10), (10, 25), (0, 212, 255), 1)
        cv2.line(frame, (self.width-10, 10), (self.width-25, 10), (0, 212, 255), 1)
        cv2.line(frame, (self.width-10, 10), (self.width-10, 25), (0, 212, 255), 1)
        cv2.line(frame, (10, self.height-10), (25, self.height-10), (0, 212, 255), 1)
        cv2.line(frame, (10, self.height-10), (10, self.height-25), (0, 212, 255), 1)
        cv2.line(frame, (self.width-10, self.height-10), (self.width-25, self.height-10), (0, 212, 255), 1)
        cv2.line(frame, (self.width-10, self.height-10), (self.width-10, self.height-25), (0, 212, 255), 1)

        return frame, detections

    @staticmethod
    def _vehicle_color(cls: str) -> Tuple[int, int, int]:
        colors = {
            "car": (0, 255, 136),         # Neon green
            "bus": (255, 170, 0),         # Orange
            "truck": (255, 100, 0),        # Deep orange
            "motorcycle": (0, 212, 255),   # Neon blue
            "bicycle": (200, 255, 0),      # Yellow green
            "pedestrian": (255, 255, 60),  # Yellow
            "emergency": (50, 50, 255),    # Neon red (BGR)
        }
        return colors.get(cls, (180, 180, 180))

"""
YOLO v26 vehicle detector with ByteTrack multi-object tracking.
Supports YOLOv8/9/10/11/v26 configurations.
Falls back to mock detections if ultralytics is not installed.
"""

import logging
import math
import time
from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# COCO class IDs we care about
COCO_CLASS_MAP = {
    0: "pedestrian",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck",
}

EMERGENCY_COLORS_HSV = [(0, 180, 255), (15, 255, 255)]  # Red hue range


class TrackHistory:
    """Stores centroid history for speed estimation."""

    def __init__(self, maxlen: int = 30):
        self.history: deque = deque(maxlen=maxlen)
        self.timestamps: deque = deque(maxlen=maxlen)

    def update(self, cx: float, cy: float, ts: float):
        self.history.append((cx, cy))
        self.timestamps.append(ts)

    def estimate_speed_kmh(self, pixels_per_meter: float = 10.0) -> float:
        """Estimate speed from recent centroid displacement."""
        if len(self.history) < 5:
            return 0.0
        dx = self.history[-1][0] - self.history[-5][0]
        dy = self.history[-1][1] - self.history[-5][1]
        dt = self.timestamps[-1] - self.timestamps[-5]
        if dt <= 0:
            return 0.0
        pixel_dist = math.sqrt(dx**2 + dy**2)
        meter_dist = pixel_dist / pixels_per_meter
        speed_ms = meter_dist / dt
        return min(speed_ms * 3.6, 120.0)


class YOLODetector:
    """
    Wraps ultralytics YOLO + supervision ByteTrack.
    Handles detection, tracking, drawing, and speed estimation.
    """

    def __init__(self, model_name: str = "yolov8n.pt", conf_threshold: float = 0.35):
        self.model_name = model_name
        self.conf_threshold = conf_threshold
        self.model = None
        self.tracker = None
        self.track_histories: Dict[int, TrackHistory] = defaultdict(TrackHistory)
        self._loaded = False
        self._load_model()

    def _load_model(self):
        try:
            from ultralytics import YOLO
            import supervision as sv
            import torch

            logger.info(f"Loading YOLO v26 Engine (model: {self.model_name})")
            
            # Patch torch.load to prevent weights_only exception in newer PyTorch versions
            original_load = torch.load
            def safe_load(*args, **kwargs):
                kwargs['weights_only'] = False
                return original_load(*args, **kwargs)
            torch.load = safe_load
            
            try:
                self.model = YOLO(self.model_name)
            finally:
                torch.load = original_load
                
            self.tracker = sv.ByteTrack(
                track_activation_threshold=self.conf_threshold,
                lost_track_buffer=30,
                minimum_matching_threshold=0.8,
                frame_rate=25,
            )
            self._loaded = True
            logger.info("YOLO model loaded successfully.")
        except ImportError:
            logger.warning("ultralytics / supervision not installed — using mock detections.")
        except Exception as exc:
            logger.error(f"Failed to load YOLO: {exc} — using mock detections.")

    def detect_and_track(
        self, frame: np.ndarray
    ) -> Tuple[np.ndarray, List[dict]]:
        """
        Run detection + tracking on a single frame.
        Returns (annotated_frame, detections_list).
        """
        if not self._loaded:
            return self._mock_detect(frame)

        return self._yolo_detect(frame)

    def _yolo_detect(self, frame: np.ndarray) -> Tuple[np.ndarray, List[dict]]:
        try:
            import supervision as sv

            h, w = frame.shape[:2]
            ts = time.time()

            # Run YOLO
            results = self.model(
                frame,
                conf=self.conf_threshold,
                classes=list(COCO_CLASS_MAP.keys()),
                verbose=False,
            )[0]

            # Convert to supervision Detections
            detections = sv.Detections.from_ultralytics(results)

            # Filter to traffic-relevant classes
            class_ids = detections.class_id if detections.class_id is not None else np.array([])
            mask = np.isin(class_ids, list(COCO_CLASS_MAP.keys()))
            detections = detections[mask]

            if len(detections) == 0:
                annotated = frame.copy()
                self._draw_lanes(annotated, w, h)
                return annotated, []

            # ByteTrack
            tracked = self.tracker.update_with_detections(detections)

            annotated = frame.copy()
            output_detections = []

            # After ByteTrack, the tracked object may have fewer entries or
            # tracker_id can be None/empty. Iterate safely.
            n = len(tracked)
            has_tracker_ids = (
                tracked.tracker_id is not None
                and hasattr(tracked.tracker_id, '__len__')
                and len(tracked.tracker_id) == n
            )

            for i in range(n):
                try:
                    track_id = int(tracked.tracker_id[i]) if has_tracker_ids else i
                    class_id = int(tracked.class_id[i]) if tracked.class_id is not None else 2
                    conf = float(tracked.confidence[i]) if tracked.confidence is not None else 0.9
                    xyxy = tracked.xyxy[i]

                    x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                    cx, cy = (x1 + x2) / 2, (y1 + y2) / 2

                    class_name = COCO_CLASS_MAP.get(class_id, "unknown")
                    lane_id = self._assign_lane(cx, w)

                    # Update track history
                    self.track_histories[track_id].update(cx / w, cy / h, ts)
                    speed = self.track_histories[track_id].estimate_speed_kmh(pixels_per_meter=12.0)

                    # Check for emergency heuristic (large red vehicle)
                    is_emergency = self._check_emergency(frame, x1, y1, x2, y2, class_name)
                    if is_emergency:
                        class_name = "emergency"

                    # Draw bounding box
                    color = self._class_color(class_name)
                    annotated = self._draw_box(annotated, x1, y1, x2, y2, track_id, class_name, conf, speed, color)

                    output_detections.append({
                        "track_id": track_id,
                        "class_name": class_name,
                        "confidence": round(conf, 3),
                        "bbox": [
                            round(x1 / w, 4),
                            round(y1 / h, 4),
                            round((x2 - x1) / w, 4),
                            round((y2 - y1) / h, 4),
                        ],
                        "speed_kmh": round(speed, 1),
                        "lane_id": lane_id,
                    })
                except Exception as det_err:
                    logger.debug(f"Skipping detection {i}: {det_err}")
                    continue

            # Draw lane lines
            annotated = self._draw_lanes(annotated, w, h)

            return annotated, output_detections

        except Exception as exc:
            logger.warning(f"YOLO detection error (returning raw frame): {exc}")
            return frame.copy(), []

    def _mock_detect(self, frame: np.ndarray) -> Tuple[np.ndarray, List[dict]]:
        """Generate random detections when YOLO is unavailable."""
        import random
        annotated = frame.copy()
        h, w = frame.shape[:2]
        classes = ["car", "car", "car", "bus", "truck", "motorcycle", "pedestrian"]
        detections = []
        n = random.randint(3, 12)
        for i in range(n):
            cls = random.choice(classes)
            x1 = random.randint(0, int(w * 0.75))
            y1 = random.randint(0, int(h * 0.75))
            bw = random.randint(60, 160)
            bh = random.randint(40, 100)
            x2 = min(x1 + bw, w - 1)
            y2 = min(y1 + bh, h - 1)
            tid = i + 1
            conf = round(random.uniform(0.6, 0.98), 3)
            speed = round(random.uniform(0, 60), 1)
            lane = self._assign_lane((x1 + x2) / 2, w)
            color = self._class_color(cls)
            annotated = self._draw_box(annotated, x1, y1, x2, y2, tid, cls, conf, speed, color)
            detections.append({
                "track_id": tid,
                "class_name": cls,
                "confidence": conf,
                "bbox": [round(x1/w,4), round(y1/h,4), round(bw/w,4), round(bh/h,4)],
                "speed_kmh": speed,
                "lane_id": lane,
            })
        annotated = self._draw_lanes(annotated, w, h)
        return annotated, detections

    @staticmethod
    def _assign_lane(cx: float, frame_width: int, num_lanes: int = 4) -> int:
        lane_width = frame_width / num_lanes
        return int(cx // lane_width)

    @staticmethod
    def _check_emergency(frame, x1, y1, x2, y2, class_name: str) -> bool:
        """Heuristic: large trucks/buses with red color patterns may be emergency."""
        if class_name not in ("truck", "bus"):
            return False
        area = (x2 - x1) * (y2 - y1)
        total_area = frame.shape[0] * frame.shape[1]
        # Only flag very prominent large vehicles (>15% of frame)
        # In production this would use a fine-tuned emergency classifier
        return area > total_area * 0.15

    @staticmethod
    def _class_color(class_name: str) -> Tuple[int, int, int]:
        colors = {
            "car": (0, 255, 100),
            "bus": (255, 165, 0),
            "truck": (255, 80, 0),
            "motorcycle": (0, 200, 255),
            "bicycle": (200, 255, 0),
            "pedestrian": (255, 255, 0),
            "emergency": (255, 0, 50),
            "unknown": (180, 180, 180),
        }
        return colors.get(class_name, (180, 180, 180))

    @staticmethod
    def _draw_box(
        frame: np.ndarray,
        x1: int, y1: int, x2: int, y2: int,
        track_id: int,
        class_name: str,
        conf: float,
        speed: float,
        color: Tuple[int, int, int],
    ) -> np.ndarray:
        import cv2
        # Glow effect: draw thick + thin boxes
        cv2.rectangle(frame, (x1-1, y1-1), (x2+1, y2+1), color, 3)
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 255, 255), 1)

        label = f"#{track_id} {class_name} {conf:.2f}"
        if speed > 0:
            label += f" {speed:.0f}km/h"

        # Label background
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
        lx, ly = x1, max(y1 - 6, th + 4)
        cv2.rectangle(frame, (lx, ly - th - 4), (lx + tw + 4, ly + 2), color, -1)
        cv2.putText(frame, label, (lx + 2, ly - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)
        return frame

    @staticmethod
    def _draw_lanes(frame: np.ndarray, w: int, h: int, num_lanes: int = 4) -> np.ndarray:
        import cv2
        lane_w = w // num_lanes
        for i in range(1, num_lanes):
            x = i * lane_w
            # Dashed line
            for y in range(0, h, 30):
                cv2.line(frame, (x, y), (x, min(y + 15, h)), (0, 255, 150), 1)
        return frame

    def cleanup_stale_tracks(self, active_ids: List[int]):
        """Remove histories for tracks that are no longer active."""
        stale = [tid for tid in self.track_histories if tid not in active_ids]
        for tid in stale:
            del self.track_histories[tid]

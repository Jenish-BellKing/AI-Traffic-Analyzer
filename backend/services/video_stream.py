"""
Video stream service: reads frames from video file, RTSP, or simulation,
runs YOLO detection, computes metrics, and broadcasts via WebSocket.
"""

import asyncio
import base64
import logging
import threading
import time
import uuid
from typing import Optional, Dict

import cv2
import numpy as np

from backend.api.websocket_manager import manager as ws_manager
from backend.models.schemas import FrameData, TrafficMetrics, SignalPhase, CameraFrameData, Detection
from backend.models.yolo_detector import YOLODetector
from backend.models.traffic_analyzer import TrafficAnalyzer
from backend.services.signal_controller import SignalController
from backend.simulation.mock_simulation import MockSimulation

logger = logging.getLogger(__name__)

PROCESS_EVERY_N_FRAMES = 1    # Process all frames in simulation for maximum smoothness
JPEG_QUALITY = 65              # JPEG compression quality (lower = faster)
TARGET_FPS = 15                # Max broadcast FPS (optimized for network bandwidth)


class VideoStreamService:
    """
    Manages a single active processing session.
    Runs in a background thread, broadcasts via asyncio event loop.
    """

    def __init__(self):
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._pause_event = threading.Event()
        self._pause_event.set()  # not paused initially

        self.session_id: Optional[str] = None
        self.source: str = "simulation"
        self.status: str = "idle"   # idle | running | paused | stopped

        self.frames_processed: int = 0
        self._start_time: Optional[float] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None

        # Core components
        self._detector = YOLODetector()
        
        # 4 analyzers for 4 approaches
        self._analyzers = {
            "north": TrafficAnalyzer(num_lanes=3),
            "east": TrafficAnalyzer(num_lanes=3),
            "south": TrafficAnalyzer(num_lanes=3),
            "west": TrafficAnalyzer(num_lanes=3),
        }
        
        self._signal_ctrl = SignalController()
        self._sim: Optional[MockSimulation] = None

        # Last broadcast states
        self.last_metrics: Optional[TrafficMetrics] = None
        self.last_signal: Optional[SignalPhase] = None

    # ------------------------------------------------------------------
    # Control API
    # ------------------------------------------------------------------

    def start_simulation(self, config: dict, loop: asyncio.AbstractEventLoop):
        self._stop()
        self.session_id = str(uuid.uuid4())
        self.source = "simulation"
        self._sim = MockSimulation(
            lanes=3,
            base_vehicle_count=int(config.get("vehicle_density", 0.5) * 12) + 3,
            emergency_frequency=config.get("emergency_frequency", 0.005),
        )
        self._loop = loop
        self._start_thread(self._run_simulation)

    def start_video(self, filepath: str, loop: asyncio.AbstractEventLoop):
        self._stop()
        self.session_id = str(uuid.uuid4())
        self.source = "video"
        self._loop = loop
        self._start_thread(self._run_video, filepath)

    def pause(self):
        if self.status == "running":
            self._pause_event.clear()
            self.status = "paused"

    def resume(self):
        if self.status == "paused":
            self._pause_event.set()
            self.status = "running"

    def stop(self):
        self._stop()
        self.status = "stopped"

    def reset(self):
        self._stop()
        self._detector = YOLODetector()
        self._analyzers = {
            "north": TrafficAnalyzer(num_lanes=3),
            "east": TrafficAnalyzer(num_lanes=3),
            "south": TrafficAnalyzer(num_lanes=3),
            "west": TrafficAnalyzer(num_lanes=3),
        }
        self._signal_ctrl = SignalController()
        self.frames_processed = 0
        self.session_id = None
        self.status = "idle"

    @property
    def uptime(self) -> float:
        if self._start_time is None:
            return 0.0
        return time.time() - self._start_time

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _start_thread(self, target, *args):
        self._stop_event.clear()
        self._pause_event.set()
        self.status = "running"
        self.frames_processed = 0
        self._start_time = time.time()
        self._thread = threading.Thread(target=target, args=args, daemon=True)
        self._thread.start()

    def _stop(self):
        if self._thread and self._thread.is_alive():
            self._stop_event.set()
            self._pause_event.set()
            self._thread.join(timeout=3)
        self.status = "idle"

    # ------------------------------------------------------------------
    # Processing loops
    # ------------------------------------------------------------------

    def _run_simulation(self):
        """Stream 4 real video files as live CCTV feeds with YOLO v26 processing."""
        import os
        logger.info(f"Video Wall started: {self.session_id}")
        
        # Resolve video paths - try multiple locations
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
        project_root = os.path.dirname(base_dir)  # Makeathon/
        
        video_map = {
            "north": "Sample1.mp4",
            "south": "Sample2.mp4",
            "east":  "Sample3.mp4",
            "west":  "Sample4.mp4",
        }
        
        caps = {}
        for direction, filename in video_map.items():
            cap = None
            # Try multiple path resolutions
            candidates = [
                os.path.join(base_dir, filename),           # backend/Sample1.mp4
                os.path.join(project_root, "backend", filename),  # Makeathon/backend/Sample1.mp4
                os.path.join(project_root, filename),       # Makeathon/Sample1.mp4
                f"backend/{filename}",                      # relative from CWD
                filename,                                   # just filename
            ]
            for path in candidates:
                test_cap = cv2.VideoCapture(path)
                if test_cap.isOpened():
                    cap = test_cap
                    logger.info(f"✅ Camera {direction.upper()} opened: {path} "
                               f"({int(test_cap.get(cv2.CAP_PROP_FRAME_COUNT))} frames, "
                               f"{test_cap.get(cv2.CAP_PROP_FPS):.1f} fps)")
                    break
                else:
                    test_cap.release()
            
            if cap is None:
                logger.error(f"❌ Camera {direction.upper()} FAILED - tried: {candidates}")
            caps[direction] = cap

        frame_interval = 1.0 / TARGET_FPS
        frame_idx = 0

        # Initialize phases map
        phases_map = {d: "red" for d in self._analyzers.keys()}
        phases_map["north"] = "green"  # Initial state

        while not self._stop_event.is_set():
            t0 = time.time()
            self._pause_event.wait()

            try:
                camera_metrics = {}
                cameras_payload = {}
                
                for direction, cap in caps.items():
                    ret, frame = (False, None)
                    if cap and cap.isOpened():
                        ret, frame = cap.read()
                        if not ret:
                            # Loop video seamlessly
                            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                            ret, frame = cap.read()
                    
                    if not ret or frame is None:
                        # Create black frame as fallback
                        frame = np.zeros((360, 640, 3), dtype=np.uint8)
                        cv2.putText(frame, f"CCTV {direction.upper()} OFFLINE",
                                    (50, 180), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                        detections = []
                        annotated = frame
                    else:
                        # Resize to 640 width if larger
                        h, w = frame.shape[:2]
                        if w > 640:
                            scale = 640 / w
                            frame = cv2.resize(frame, (640, int(h * scale)))
                        
                        # Run YOLO v26 detector (wrapped in try/except inside detector)
                        annotated, detections = self._detector.detect_and_track(frame)
                    
                    h, w = annotated.shape[:2]
                    
                    # Analyze metrics
                    analyzer = self._analyzers[direction]
                    camera_metrics[direction] = analyzer.analyze(detections, frame_width=w, frame_height=h)

                    # Encode frame as JPEG base64
                    _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                    frame_b64 = base64.b64encode(buf).decode("utf-8")
                    
                    cameras_payload[direction] = {
                        "frame_base64": frame_b64,
                        "name": direction.upper(),
                        "metrics": camera_metrics[direction],
                        "detections": detections
                    }

                # Update signal phases from AI controller
                signal_states = self._signal_ctrl.update_junction(camera_metrics)
                phases_map = {d: signal_states[d].phase for d in signal_states}

                # Map the signal phase back into the camera payload
                for direction in cameras_payload:
                    cameras_payload[direction]["signal_state"] = signal_states[direction]

                self.last_metrics = camera_metrics["north"]
                self.last_signal = signal_states["north"]
                self.frames_processed += 1

                # Build full CameraFrameData objects
                cameras_data = {}
                for direction, cam_data in cameras_payload.items():
                    cameras_data[direction] = CameraFrameData(
                        frame_base64=cam_data["frame_base64"],
                        name=cam_data["name"],
                        metrics=cam_data["metrics"],
                        signal_state=cam_data["signal_state"],
                        detections=[
                            Detection(
                                track_id=d["track_id"],
                                class_name=d["class_name"],
                                confidence=d["confidence"],
                                bbox=d["bbox"],
                                speed_kmh=d.get("speed_kmh", 0.0),
                                lane_id=d.get("lane_id", 0),
                            )
                            for d in cam_data["detections"]
                        ]
                    )

                # Assemble full payload
                payload = FrameData(
                    type="traffic_update",
                    session_id=self.session_id or "demo",
                    fps=float(TARGET_FPS),
                    resolution=[640, 360],
                    metrics=camera_metrics["north"],
                    signal_state=signal_states["north"],
                    detections=cameras_data["north"].detections,
                    source="video",
                    cameras=cameras_data
                )

                # Add decision logs
                payload_dict = payload.model_dump()
                payload_dict["decision_logs"] = self._signal_ctrl.decision_logs

                # Broadcast to all connected WebSocket clients
                if self._loop and self._loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        ws_manager.broadcast(payload_dict),
                        self._loop,
                    )

                frame_idx += 1

                # Periodic status log
                if frame_idx % 150 == 0:
                    logger.info(f"📡 Streaming frame #{frame_idx} | WS clients: {ws_manager.count}")

            except Exception as exc:
                logger.error(f"Frame processing error (continuing): {exc}", exc_info=False)

            elapsed = time.time() - t0
            sleep_time = max(0.0, frame_interval - elapsed)
            time.sleep(sleep_time)

        for cap in caps.values():
            if cap:
                cap.release()
        logger.info(f"Video Wall stopped: {self.session_id}")

    def _run_video(self, filepath: str):
        logger.info(f"Video processing started: {filepath}")
        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            logger.error(f"Cannot open video: {filepath}")
            self.status = "stopped"
            return

        video_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_interval = 1.0 / min(video_fps, TARGET_FPS)
        frame_idx = 0
        actual_fps = video_fps

        while not self._stop_event.is_set():
            self._pause_event.wait()

            t0 = time.time()
            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            frame_idx += 1

            if frame_idx % PROCESS_EVERY_N_FRAMES == 0:
                h, w = frame.shape[:2]
                if w > 640:
                    scale = 640 / w
                    frame = cv2.resize(frame, (640, int(h * scale)))

                annotated, detections = self._detector.detect_and_track(frame)
                
                # Single-feed video mode creates mock fields for remaining directions
                h, w = frame.shape[:2]
                metrics = self._analyzers["north"].analyze(detections, frame_width=w, frame_height=h)
                signal_state = self._signal_ctrl.update(metrics)

                self.last_metrics = metrics
                self.last_signal = signal_state
                self.frames_processed += 1

                # Encode frame
                _, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
                frame_b64 = base64.b64encode(buf).decode("utf-8")

                detections_list = [
                    Detection(
                        track_id=d["track_id"],
                        class_name=d["class_name"],
                        confidence=d["confidence"],
                        bbox=d["bbox"],
                        speed_kmh=d.get("speed_kmh", 0.0),
                        lane_id=d.get("lane_id", 0),
                    )
                    for d in detections
                ]

                # Create 1-camera mock array
                cameras_payload = {}
                for direction in ["north", "east", "south", "west"]:
                    is_main = (direction == "north")
                    cameras_payload[direction] = CameraFrameData(
                        frame_base64=frame_b64 if is_main else None,
                        name=direction.upper(),
                        metrics=metrics if is_main else TrafficMetrics(),
                        signal_state=signal_state if is_main else SignalPhase(phase="red"),
                        detections=detections_list if is_main else []
                    )

                payload = FrameData(
                    type="traffic_update",
                    session_id=self.session_id or "demo",
                    fps=round(actual_fps, 1),
                    resolution=[w, h],
                    metrics=metrics,
                    signal_state=signal_state,
                    detections=detections_list,
                    source="video",
                    cameras=cameras_payload
                )

                payload_dict = payload.model_dump()
                payload_dict["decision_logs"] = self._signal_ctrl.decision_logs

                if self._loop and self._loop.is_running():
                    asyncio.run_coroutine_threadsafe(
                        ws_manager.broadcast(payload_dict),
                        self._loop,
                    )

            elapsed = time.time() - t0
            time.sleep(max(0.0, frame_interval - elapsed))

        cap.release()
        logger.info(f"Video processing stopped.")


# Singleton instance
stream_service = VideoStreamService()


"""
Face Tracker Backend

This script captures camera frames, detects faces using MediaPipe Face Detection,
smooths the detected face coordinates, and broadcasts face data via a WebSocket
server so a game engine can consume it in real-time.

Outputs (JSON):
 - center_x: float (normalized 0..1)
 - center_y: float (normalized 0..1)
 - width: float (normalized 0..1)
 - height: float (normalized 0..1)
 - confidence: float (0..1)
 - timestamp: float (epoch seconds)
 - status: "ok" | "no_face" | "camera_error"

Major sections:
 - Camera capture: `CameraCapture` class
 - Detection: `FaceDetector` class (MediaPipe)
 - Smoothing/tracking: `FaceTracker` class (EMA smoothing)
 - WebSocket broadcasting: `FaceServer` class

Run: python face_tracker.py
"""

import asyncio
import json
import time
from collections import deque
from dataclasses import dataclass
from typing import Optional, Tuple

# Optional imports: wrap them to allow the server to start even if cv2/mediapipe are missing
try:
    import cv2
    HAVE_CV2 = True
except Exception:
    cv2 = None
    HAVE_CV2 = False

try:
    import mediapipe as mp
    HAVE_MEDIAPIPE = True
except Exception:
    mp = None
    HAVE_MEDIAPIPE = False

try:
    import numpy as np
    HAVE_NUMPY = True
except Exception:
    np = None
    HAVE_NUMPY = False
import websockets


@dataclass
class FaceData:
    center_x: float
    center_y: float
    width: float
    height: float
    confidence: float
    timestamp: float
    status: str = "ok"


class CameraCapture:
    """Encapsulate camera access and frame capture."""

    def __init__(self, camera_index: int = 0, width: int = 640, height: int = 480):
        self.camera_index = camera_index
        self.width = width
        self.height = height
        self.cap = None

    def open(self) -> bool:
        if not HAVE_CV2:
            # OpenCV not available; cannot open camera
            return False
        # Use DirectShow backend on Windows when available
        try:
            self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        except Exception:
            # fallback to default
            self.cap = cv2.VideoCapture(self.camera_index)
        if not self.cap or not self.cap.isOpened():
            return False
        # try to set resolution
        try:
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        except Exception:
            pass
        return True

    def read(self) -> Optional[np.ndarray]:
        if self.cap is None:
            return None
        try:
            ret, frame = self.cap.read()
        except Exception:
            return None
        if not ret:
            return None
        return frame

    def release(self):
        if self.cap is not None:
            self.cap.release()


class FaceDetector:
    """MediaPipe Face Detection wrapper."""

    def __init__(self, model_selection: int = 0, min_detection_confidence: float = 0.5):
        self.available = HAVE_MEDIAPIPE and HAVE_NUMPY
        self.model_selection = model_selection
        self.confidence = min_detection_confidence
        if self.available:
            try:
                self.mp_face = mp.solutions.face_detection
                self._detector = self.mp_face.FaceDetection(model_selection=self.model_selection,
                                                            min_detection_confidence=self.confidence)
            except Exception:
                # media pipe failed to initialize
                self.available = False
                self._detector = None
        else:
            self._detector = None

    def detect(self, frame: np.ndarray):
        if not self.available or self._detector is None:
            # Detector not available on this system
            return None
        try:
            # expects BGR frame (OpenCV), convert to RGB
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self._detector.process(rgb)
            return results
        except Exception:
            return None


class FaceTracker:
    """Selects a face (closest) and smooths coordinates with EMA."""

    def __init__(self, smoothing=0.6):
        self.smoothing = smoothing
        self.ema = None  # stores last smoothed FaceData

    def _bbox_to_facedata(self, bbox, image_shape, score) -> FaceData:
        ih, iw = image_shape[:2]
        # MediaPipe returns relative bbox center in normalized coords or relative bounding box
        # We will compute center and size in normalized coordinates
        x_min = bbox.xmin
        y_min = bbox.ymin
        w = bbox.width
        h = bbox.height
        cx = x_min + w / 2.0
        cy = y_min + h / 2.0
        return FaceData(center_x=float(cx), center_y=float(cy), width=float(w), height=float(h), confidence=float(score), timestamp=time.time())

    def pick_closest(self, detections, image_shape) -> Optional[FaceData]:
        if detections is None or not detections.detections:
            return None
        # choose detection with largest area (closest face)
        best = None
        best_area = -1
        for det in detections.detections:
            bbox = det.location_data.relative_bounding_box
            area = bbox.width * bbox.height
            if area > best_area:
                best_area = area
                best = (bbox, det.score[0] if det.score else 0.0)
        if best is None:
            return None
        return self._bbox_to_facedata(best[0], image_shape, best[1])

    def smooth(self, new: Optional[FaceData]) -> FaceData:
        if new is None:
            # If face lost, gradually decay confidence to 0
            if self.ema is None:
                return FaceData(0.5, 0.5, 0.0, 0.0, 0.0, time.time(), status="no_face")
            # reduce confidence and keep position
            ema = self.ema
            ema.confidence *= 0.85
            ema.timestamp = time.time()
            if ema.confidence < 0.02:
                ema.status = "no_face"
            return ema

        if self.ema is None:
            self.ema = new
            return new

        # exponential moving average
        a = self.smoothing
        self.ema.center_x = a * self.ema.center_x + (1 - a) * new.center_x
        self.ema.center_y = a * self.ema.center_y + (1 - a) * new.center_y
        self.ema.width = a * self.ema.width + (1 - a) * new.width
        self.ema.height = a * self.ema.height + (1 - a) * new.height
        self.ema.confidence = max(self.ema.confidence, new.confidence)
        self.ema.timestamp = new.timestamp
        self.ema.status = "ok"
        return self.ema


class FaceServer:
    """WebSocket server broadcasting face data to connected clients."""

    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self.clients = set()

    async def _handler(self, websocket, path):
        self.clients.add(websocket)
        try:
            async for _ in websocket:  # simple echo-style keepalive if client sends
                pass
        finally:
            self.clients.remove(websocket)

    async def broadcast(self, data: dict):
        if not self.clients:
            return
        msg = json.dumps(data)
        await asyncio.gather(*(c.send(msg) for c in list(self.clients)))

    def start(self):
        return websockets.serve(self._handler, self.host, self.port)


async def main_loop(camera_index: int = 0, ws_port: int = 8765):
    cam = CameraCapture(camera_index=camera_index)
    cam_connected = cam.open()
    if not cam_connected:
        print("WARNING: Could not open camera at startup. Check permissions and device index.")
    if not HAVE_CV2:
        print("NOTE: OpenCV (cv2) not available in this Python environment. Camera capture will be disabled.")
    if not HAVE_MEDIAPIPE:
        print("NOTE: MediaPipe not available; face detection will be disabled.")
    # detector and tracker
    detector = FaceDetector(min_detection_confidence=0.4)
    tracker = FaceTracker(smoothing=0.75)
    server = FaceServer(port=ws_port)

    # Start the websocket server and ensure it's running for the lifetime of this loop.
    ws_server = await websockets.serve(server._handler, server.host, server.port)
    print(f"FaceTracker: WebSocket server running on ws://{server.host}:{server.port}")

    # Broadcast initial camera status
    try:
        await server.broadcast({"type": "camera_status", "connected": bool(cam_connected), "timestamp": time.time()})
    except Exception:
        # ignore if no clients
        pass

    prev_cam_connected = bool(cam_connected)

    try:
        while True:
            # Check camera availability
            cam_ok = cam.cap is not None and cam.cap.isOpened()
            if not cam_ok:
                # camera is not available/connected
                if prev_cam_connected:
                    prev_cam_connected = False
                    try:
                        await server.broadcast({"type": "camera_status", "connected": False, "timestamp": time.time()})
                    except Exception:
                        pass
                data = {"status": "camera_error", "timestamp": time.time()}
                try:
                    await server.broadcast(data)
                except Exception:
                    pass
                await asyncio.sleep(0.2)
                continue

            frame = cam.read()
            if frame is None:
                # read failed although camera open
                if prev_cam_connected:
                    prev_cam_connected = False
                    try:
                        await server.broadcast({"type": "camera_status", "connected": False, "timestamp": time.time()})
                    except Exception:
                        pass
                try:
                    await server.broadcast({"status": "camera_error", "timestamp": time.time()})
                except Exception:
                    pass
                await asyncio.sleep(0.1)
                continue

            # If we reach here and camera was previously disconnected, broadcast connected
            if not prev_cam_connected:
                prev_cam_connected = True
                try:
                    await server.broadcast({"type": "camera_status", "connected": True, "timestamp": time.time()})
                except Exception:
                    pass

            try:
                results = detector.detect(frame)
            except Exception as e:
                # Detector error (e.g., MediaPipe crash), broadcast error and continue
                err_msg = {"status": "detector_error", "error": str(e), "timestamp": time.time()}
                try:
                    await server.broadcast(err_msg)
                except Exception:
                    pass
                await asyncio.sleep(0.2)
                continue
            picked = tracker.pick_closest(results, frame.shape)
            smoothed = tracker.smooth(picked)

            out = {
                "center_x": smoothed.center_x,
                "center_y": smoothed.center_y,
                "width": smoothed.width,
                "height": smoothed.height,
                "confidence": smoothed.confidence,
                "timestamp": smoothed.timestamp,
                "status": smoothed.status,
            }

            try:
                await server.broadcast(out)
            except Exception:
                # ignore client send errors
                pass

            # small delay to yield to event loop and limit CPU usage
            await asyncio.sleep(0.01)

    except asyncio.CancelledError:
        pass
    finally:
        cam.release()
        # shut down websocket server gracefully
        try:
            ws_server.close()
            await ws_server.wait_closed()
        except Exception:
            pass


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run face tracker and broadcast via WebSocket.")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default 0)")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port (default 8765)")
    args = parser.parse_args()

    loop = asyncio.get_event_loop()
    try:
        loop.run_until_complete(main_loop(camera_index=args.camera, ws_port=args.port))
    except KeyboardInterrupt:
        print("Shutting down")

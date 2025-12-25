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
import base64
import json
import time
from collections import deque
from dataclasses import dataclass
from typing import Optional, Tuple

import cv2
import mediapipe as mp
import numpy as np
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
        self.cap = cv2.VideoCapture(self.camera_index, cv2.CAP_DSHOW)
        if not self.cap.isOpened():
            return False
        # try to set resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        return True

    def read(self) -> Optional[np.ndarray]:
        if self.cap is None:
            return None
        ret, frame = self.cap.read()
        if not ret:
            return None
        return frame

    def release(self):
        if self.cap is not None:
            self.cap.release()


class FaceDetector:
    """MediaPipe Face Detection wrapper."""

    def __init__(self, model_selection: int = 0, min_detection_confidence: float = 0.5):
        self.mp_face = mp.solutions.face_detection
        self.model_selection = model_selection
        self.confidence = min_detection_confidence
        self._detector = self.mp_face.FaceDetection(model_selection=self.model_selection,
                                                    min_detection_confidence=self.confidence)

    def detect(self, frame: np.ndarray):
        # expects BGR frame (OpenCV), convert to RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self._detector.process(rgb)
        return results


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
    """WebSocket server broadcasting face data to connected clients.

    Accepts simple JSON commands from clients to control the tracker:
      {"cmd": "pause"}
      {"cmd": "resume"}
      {"cmd": "slow_on"}
      {"cmd": "slow_off"}
      {"cmd": "frames_on"}
      {"cmd": "frames_off"}
      {"cmd": "log_on"}
      {"cmd": "log_off"}
    """

    def __init__(self, host: str = "0.0.0.0", port: int = 8765):
        self.host = host
        self.port = port
        self.clients = set()
        # control flags - toggled by admin clients
        self.pause = False
        self.slow_motion = False
        self.send_frames = False
        self.logging = False
        self.log_path = "face_log.jsonl"

    async def _handler(self, websocket, path):
        self.clients.add(websocket)
        try:
            async for message in websocket:
                # accept simple JSON commands
                try:
                    cmd = json.loads(message)
                except Exception:
                    # ignore non-json keepalives
                    continue
                c = cmd.get("cmd")
                if c == "pause":
                    self.pause = True
                elif c == "resume":
                    self.pause = False
                elif c == "slow_on":
                    self.slow_motion = True
                elif c == "slow_off":
                    self.slow_motion = False
                elif c == "frames_on":
                    self.send_frames = True
                elif c == "frames_off":
                    self.send_frames = False
                elif c == "log_on":
                    self.logging = True
                elif c == "log_off":
                    self.logging = False
                # any other commands ignored for now
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
    if not cam.open():
        print("ERROR: Could not open camera. Check permissions and device index.")
        # still start server to allow clients to connect and see errors
    detector = FaceDetector(min_detection_confidence=0.4)
    tracker = FaceTracker(smoothing=0.75)
    server = FaceServer(port=ws_port)

    ws_server = server.start()
    asyncio.ensure_future(ws_server)

    print(f"FaceTracker: WebSocket server running on ws://{server.host}:{server.port}")

    try:
        # FPS measurement
        frame_times = deque(maxlen=30)
        while True:
            start = time.time()
            frame = cam.read()
            if frame is None:
                # camera read failed or not opened
                data = {"status": "camera_error", "timestamp": time.time()}
                await server.broadcast(data)
                await asyncio.sleep(0.1)
                continue

            # If paused, skip detection but still send camera_error or no_face states
            results = None
            if not server.pause:
                results = detector.detect(frame)

            picked = tracker.pick_closest(results, frame.shape) if results is not None else None
            smoothed = tracker.smooth(picked)

            # compute FPS
            frame_times.append(time.time())
            fps = 0.0
            if len(frame_times) >= 2:
                fps = len(frame_times) / (frame_times[-1] - frame_times[0] + 1e-6)

            out = {
                "center_x": smoothed.center_x,
                "center_y": smoothed.center_y,
                "width": smoothed.width,
                "height": smoothed.height,
                "confidence": smoothed.confidence,
                "timestamp": smoothed.timestamp,
                "status": smoothed.status,
                "fps": fps,
            }

            # logging
            if server.logging:
                try:
                    with open(server.log_path, "a", encoding="utf-8") as f:
                        f.write(json.dumps(out) + "\n")
                except Exception:
                    pass

            # if frames requested, create an annotated JPEG and include as base64
            if server.send_frames:
                try:
                    vis = frame.copy()
                    ih, iw = vis.shape[:2]
                    if smoothed and smoothed.status == "ok":
                        # draw bounding box and center
                        cx = int(smoothed.center_x * iw)
                        cy = int(smoothed.center_y * ih)
                        w = int(smoothed.width * iw)
                        h = int(smoothed.height * ih)
                        x1 = max(0, cx - w // 2)
                        y1 = max(0, cy - h // 2)
                        x2 = min(iw - 1, cx + w // 2)
                        y2 = min(ih - 1, cy + h // 2)
                        cv2.rectangle(vis, (x1, y1), (x2, y2), (0, 255, 0), 2)
                        cv2.circle(vis, (cx, cy), 4, (0, 0, 255), -1)
                        cv2.putText(vis, f"conf:{smoothed.confidence:.2f}", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                    # overlay status
                    cv2.putText(vis, f"status:{smoothed.status}", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 2)
                    # encode to JPEG
                    ok, jpg = cv2.imencode('.jpg', vis, [int(cv2.IMWRITE_JPEG_QUALITY), 60])
                    if ok:
                        b64 = base64.b64encode(jpg.tobytes()).decode('ascii')
                        out["frame"] = b64
                except Exception:
                    # if frame encoding fails, skip frame
                    pass

            await server.broadcast(out)

            # slow motion support
            if server.slow_motion:
                await asyncio.sleep(0.15)
            else:
                # small delay to yield to event loop and limit CPU usage
                await asyncio.sleep(0.01)

    except asyncio.CancelledError:
        pass
    finally:
        cam.release()


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

# Face Tracker (MediaPipe + OpenCV)

Overview
--------
This backend captures camera frames, detects faces using MediaPipe Face Detection,
smooths face coordinates, and broadcasts JSON face data over a WebSocket (default
ws://0.0.0.0:8765). Game engines can connect to this WebSocket to receive
real-time face position and size data.

Output format (JSON)
--------------------
- `center_x` and `center_y`: normalized face center (0..1, relative to frame width/height)
- `width` and `height`: normalized face bounding box size (0..1)
- `confidence`: detection confidence (0..1)
- `timestamp`: epoch seconds
- `status`: `ok`, `no_face`, or `camera_error`

How to run
----------
1. Create a virtualenv and install requirements:

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Run tracker:

```powershell
python face_tracker.py --camera 0 --port 8765
```

3. Run example consumer (or connect your game engine):

```powershell
python face_consumer_example.py
```

Integration notes for game engines
---------------------------------
- Connect to the WebSocket and listen for JSON messages.
- Map `center_x`/`center_y` to in-game inputs (e.g., normalized screen coordinates).
- Use `width`/`height` and `confidence` for proximity triggers.
- When `status` is `no_face`, pause face-driven inputs and optionally show a prompt.

Extending the system
---------------------
- Eye tracking: use MediaPipe Face Mesh to extract eye landmarks and estimate gaze.
- Facial expressions/emotion: run a small classifier on face ROI (landmarks or CNN).
- Performance: run detector at lower resolution, or use GPU-accelerated builds of OpenCV/MediaPipe.

Security & Permissions
----------------------
- The script accesses the local camera; ensure you have device permission.
- When deploying, ensure TLS for WebSocket (wss://) and proper origin checks.

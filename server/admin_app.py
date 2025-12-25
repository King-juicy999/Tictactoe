"""
Admin web app to monitor face tracking in real time.

This simple Flask app serves a static dashboard that connects directly to the
face tracker's WebSocket to receive numeric tracking data and optional frames.

Run alongside `face_tracker.py`:
  1. Start face_tracker.py (it hosts the WebSocket)
  2. Start this Flask app: `python admin_app.py`
  3. Open http://localhost:5000 in your browser

The dashboard forwards control commands over the WebSocket to toggle pause,
slow motion, frame streaming and logging. The admin UI does not perform any
face detection - it consumes the same tracking data used by the game logic.
"""

from flask import Flask, send_from_directory
import os

app = Flask(__name__, static_folder="static")


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "admin_dashboard.html")


@app.route('/<path:path>')
def static_proxy(path):
    # serve static files
    return send_from_directory(app.static_folder, path)


if __name__ == '__main__':
    port = int(os.environ.get("ADMIN_PORT", 5000))
    print(f"Admin dashboard available at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)

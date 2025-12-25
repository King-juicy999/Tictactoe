"""
Example consumer showing how a game engine can consume face data.

This simple script connects to the WebSocket provided by `face_tracker.py`
and prints the received normalized face coordinates. A real game engine would
take these values and map them to in-game controls (e.g., map `center_x` to
horizontal look or cursor movement).

Run: python face_consumer_example.py
"""

import asyncio
import json

import websockets


async def consumer(uri: str = "ws://localhost:8765"):
    async with websockets.connect(uri) as ws:
        print(f"Connected to {uri}")
        try:
            while True:
                msg = await ws.recv()
                data = json.loads(msg)
                # Example usage: map normalized center_x to game input
                if data.get("status") == "ok":
                    cx = data["center_x"]
                    cy = data["center_y"]
                    w = data["width"]
                    h = data["height"]
                    conf = data["confidence"]
                    # Game can use these values directly or map them to screen coords
                    print(f"Face: cx={cx:.3f}, cy={cy:.3f}, w={w:.3f}, h={h:.3f}, conf={conf:.2f}")
                else:
                    print(f"Status: {data.get('status')}")
        except asyncio.CancelledError:
            pass


if __name__ == "__main__":
    asyncio.get_event_loop().run_until_complete(consumer())

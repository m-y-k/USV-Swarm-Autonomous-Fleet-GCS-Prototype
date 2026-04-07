"""
USV Fleet Command — Main Entry Point

Starts:
  1. Fleet Manager (MAVLink + Mesh + Leader Election)
  2. WebSocket Server (FastAPI + Uvicorn)

Both run in the SAME asyncio event loop so that broadcast_state()
can await WebSocket.send_text() on clients owned by that loop.

Usage:
  python main.py                           # Default: 3 boats on localhost
  python main.py --boats 5                 # 5 boats
  python main.py --host 192.168.1.100      # Custom SITL host
"""
import asyncio
import argparse
import uvicorn
import json
import time

from fleet.fleet_manager import FleetManager
from api.websocket_server import app, set_fleet_manager, broadcast_state


# ─── Configuration ─────────────────────────────────────────

DEFAULT_CONFIG = {
    "num_boats": 3,
    "sitl_host": "127.0.0.1",
    "base_port": 14550,       # SITL Boat 1 port, increments by 10
    "ws_host": "0.0.0.0",
    "ws_port": 8000,
}

DEBUG_LOG_PATH = r"d:\Drone Projects\USV Swarm Autonomous Fleet GCS Prototype\debug-af8cae.log"


def _debug_log(location: str, message: str, data: dict, hypothesis_id: str):
    try:
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "sessionId": "af8cae",
                "runId": "pre-fix-1",
                "hypothesisId": hypothesis_id,
                "location": location,
                "message": message,
                "data": data,
                "timestamp": int(time.time() * 1000),
            }, ensure_ascii=False) + "\n")
    except Exception:
        pass


# Default spawn positions matching scripts/launch_sitl.sh (Sydney Harbour).
# Used as placeholder positions so boats appear on the map before SITL GPS arrives.
_SPAWN_LOCATIONS = [
    (-33.8568, 151.2153),  # Boat 0 — near Opera House
    (-33.8540, 151.2200),  # Boat 1 — 500m northeast
    (-33.8595, 151.2180),  # Boat 2 — 500m south-east
]


def create_fleet(num_boats: int, host: str, base_port: int) -> FleetManager:
    """Create and configure the fleet manager with N boats."""
    fleet = FleetManager(on_state_update=broadcast_state)
    for i in range(num_boats):
        port = base_port + (i * 10)
        connection_string = f"udp:{host}:{port}"
        fleet.add_boat(vehicle_id=i, connection_string=connection_string)

        # Pre-seed position so the boat is visible on the map immediately.
        # Real SITL GPS data will overwrite this when it arrives.
        if i < len(_SPAWN_LOCATIONS):
            lat, lon = _SPAWN_LOCATIONS[i]
        else:
            lat = -33.8568 + (i - len(_SPAWN_LOCATIONS) + 1) * 0.003
            lon = 151.2153
        fleet.mavlink.vehicles[i].position.lat = lat
        fleet.mavlink.vehicles[i].position.lon = lon
        fleet.mesh.update_node_position(i, lat, lon)

    return fleet


async def run_all(fleet: FleetManager, ws_host: str, ws_port: int):
    """Run uvicorn and fleet manager in the same event loop.

    Using uvicorn.Server (programmatic API) instead of uvicorn.run()
    lets us await it as a coroutine alongside fleet.start(), so both
    share the same asyncio event loop. This is required so that
    broadcast_state() can correctly await WebSocket.send_text() on
    the Starlette clients that belong to this loop.
    """
    config = uvicorn.Config(app, host=ws_host, port=ws_port, log_level="info")
    server = uvicorn.Server(config)
    await asyncio.gather(
        server.serve(),
        fleet.start(),
    )


def main():
    # #region agent log
    _debug_log(
        "backend/main.py:main",
        "Python stdout encoding at startup",
        {
            "stdout_encoding": getattr(__import__("sys").stdout, "encoding", None),
            "default_encoding": __import__("sys").getdefaultencoding(),
            "preferred_encoding": __import__("locale").getpreferredencoding(False),
        },
        "H4",
    )
    # #endregion
    parser = argparse.ArgumentParser(description="USV Fleet Command")
    parser.add_argument("--boats", type=int, default=DEFAULT_CONFIG["num_boats"],
                        help="Number of SITL boat instances")
    parser.add_argument("--host", type=str, default=DEFAULT_CONFIG["sitl_host"],
                        help="SITL host address")
    parser.add_argument("--port", type=int, default=DEFAULT_CONFIG["base_port"],
                        help="Base SITL port (increments by 10 per boat)")
    parser.add_argument("--ws-port", type=int, default=DEFAULT_CONFIG["ws_port"],
                        help="WebSocket server port")
    args = parser.parse_args()

    print("=" * 60)
    print("  USV Fleet Command — Ground Control Station")
    print("=" * 60)
    print(f"  Boats:        {args.boats}")
    print(f"  SITL Host:    {args.host}")
    print(f"  Base Port:    {args.port}")
    print(f"  WS Server:    http://0.0.0.0:{args.ws_port}")
    print(f"  Dashboard:    http://localhost:5173")
    print("=" * 60)

    fleet = create_fleet(args.boats, args.host, args.port)
    set_fleet_manager(fleet)

    try:
        asyncio.run(run_all(fleet, "0.0.0.0", args.ws_port))
    except KeyboardInterrupt:
        print("\n[Fleet] Shutting down...")
        fleet.mavlink.stop()


if __name__ == "__main__":
    main()

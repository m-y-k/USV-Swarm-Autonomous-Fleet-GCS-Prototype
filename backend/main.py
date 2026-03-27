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


def create_fleet(num_boats: int, host: str, base_port: int) -> FleetManager:
    """Create and configure the fleet manager with N boats."""
    fleet = FleetManager(on_state_update=broadcast_state)
    for i in range(num_boats):
        port = base_port + (i * 10)
        connection_string = f"udp:{host}:{port}"
        fleet.add_boat(vehicle_id=i, connection_string=connection_string)
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

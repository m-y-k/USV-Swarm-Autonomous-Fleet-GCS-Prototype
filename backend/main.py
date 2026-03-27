"""
USV Fleet Command — Main Entry Point

Starts:
  1. Fleet Manager (MAVLink + Mesh + Leader Election)
  2. WebSocket Server (FastAPI + Uvicorn)
  
Usage:
  python main.py                           # Default: 3 boats on localhost
  python main.py --boats 5                 # 5 boats
  python main.py --host 192.168.1.100      # Custom SITL host
"""
import asyncio
import argparse
import sys
import uvicorn
import threading

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


async def run_fleet(fleet: FleetManager):
    """Run the fleet manager in async loop."""
    await fleet.start()


def run_webserver(host: str, port: int):
    """Run the FastAPI WebSocket server."""
    uvicorn.run(app, host=host, port=port, log_level="info")


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
    
    # Create fleet
    fleet = create_fleet(args.boats, args.host, args.port)
    set_fleet_manager(fleet)
    
    # Run web server in a thread
    ws_thread = threading.Thread(
        target=run_webserver,
        args=("0.0.0.0", args.ws_port),
        daemon=True,
    )
    ws_thread.start()
    
    # Run fleet manager in main async loop
    try:
        asyncio.run(run_fleet(fleet))
    except KeyboardInterrupt:
        print("\n[Fleet] Shutting down...")
        fleet.mavlink.stop()


if __name__ == "__main__":
    main()

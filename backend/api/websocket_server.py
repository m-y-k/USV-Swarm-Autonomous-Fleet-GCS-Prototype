"""
WebSocket Server — Bridges the Python backend with the React frontend.

Sends:
  - Fleet state updates (vehicles + mesh + leader) at 5 Hz
  
Receives:
  - Commands from UI (arm, disarm, mode change, waypoint, simulate failure,
    param set, GPS loss, demo scenario)
"""
import json
import asyncio
from typing import Set
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(title="USV Fleet Command API")

# Allow React dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connected WebSocket clients
connected_clients: Set[WebSocket] = set()

# Reference to fleet manager (set from main.py)
fleet_manager = None


def set_fleet_manager(fm):
    global fleet_manager
    fleet_manager = fm


async def broadcast_state(state: dict):
    """Send state update to all connected frontend clients."""
    if not connected_clients:
        return
    
    message = json.dumps(state)
    disconnected = set()
    
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)
    
    connected_clients.difference_update(disconnected)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.add(ws)
    print(f"[WS] Client connected ({len(connected_clients)} total)")
    
    try:
        while True:
            # Receive commands from frontend
            data = await ws.receive_text()
            command = json.loads(data)
            await handle_command(command)
    except WebSocketDisconnect:
        connected_clients.discard(ws)
        print(f"[WS] Client disconnected ({len(connected_clients)} total)")
    except Exception as e:
        connected_clients.discard(ws)
        print(f"[WS] Error: {e}")


async def handle_command(command: dict):
    """Process a command from the frontend UI.

    Wrapped in try/except so a bad command never kills the WebSocket connection.
    """
    if not fleet_manager:
        return

    cmd_type = command.get("type")
    vehicle_id = command.get("vehicle_id")

    print(f"[WS] Command: {cmd_type} for vehicle {vehicle_id}")

    try:
        if cmd_type == "arm":
            fleet_manager.arm(vehicle_id)

        elif cmd_type == "disarm":
            fleet_manager.disarm(vehicle_id)

        elif cmd_type == "set_mode":
            mode = command.get("mode", "MANUAL")
            fleet_manager.set_mode(vehicle_id, mode)

        elif cmd_type == "waypoint":
            lat = command.get("lat")
            lon = command.get("lon")
            if lat and lon:
                fleet_manager.send_waypoint(vehicle_id, lat, lon)

        elif cmd_type == "upload_mission":
            waypoints = command.get("waypoints", [])
            fleet_manager.upload_mission(vehicle_id, waypoints)

        elif cmd_type == "simulate_failure":
            fleet_manager.simulate_failure(vehicle_id)

        elif cmd_type == "simulate_restore":
            fleet_manager.simulate_restore(vehicle_id)

        elif cmd_type == "force_election":
            fleet_manager.mesh.leader_election.start_election()

        elif cmd_type == "param_set":
            param = command.get("param")
            value = command.get("value")
            if param is not None and value is not None:
                fleet_manager.set_param(vehicle_id, param, value)

        elif cmd_type == "simulate_gps_loss":
            fleet_manager.simulate_gps_loss(vehicle_id)

        elif cmd_type == "simulate_gps_restore":
            fleet_manager.simulate_gps_restore(vehicle_id)

        elif cmd_type == "set_mesh_range":
            range_m = command.get("range", 2000)
            fleet_manager.set_mesh_range(range_m)

        elif cmd_type == "fleet_auto_patrol":
            asyncio.create_task(fleet_manager.fleet_auto_patrol())

        elif cmd_type == "run_demo":
            asyncio.create_task(fleet_manager.run_demo_sequence())

        else:
            print(f"[WS] Unknown command type: {cmd_type}")

    except Exception as e:
        print(f"[WS] Error handling command '{cmd_type}': {e}")
        import traceback
        traceback.print_exc()


@app.get("/health")
async def health():
    return {"status": "ok", "clients": len(connected_clients)}


@app.get("/state")
async def get_state():
    if fleet_manager:
        return fleet_manager.get_full_state()
    return {"error": "Fleet manager not initialized"}


@app.get("/events")
async def get_events():
    """Return the event log for export."""
    if fleet_manager:
        return {"events": fleet_manager.event_log}
    return {"events": []}

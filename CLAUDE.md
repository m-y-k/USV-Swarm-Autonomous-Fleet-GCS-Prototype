# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ground Control Station (GCS) for autonomous USV (Unmanned Surface Vessel) swarm management. Connects to ArduPilot SITL simulation instances via MAVLink, orchestrates multi-vessel mesh networking, and streams real-time telemetry to a React dashboard over WebSocket. Built for Vanguard APAC — defence-grade maritime operations.

## Development Setup & Commands

### Backend (Python FastAPI)
```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows Git Bash
pip install -r requirements.txt

# Run (connects to SITL on localhost, 3 boats)
python main.py

# Custom configuration
python main.py --boats 5 --host 192.168.1.100 --port 14550 --ws-port 8000
```

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev      # Dev server at http://localhost:5173
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

### SITL Simulation (requires WSL2 + ArduPilot)
```bash
bash scripts/launch_sitl.sh  # Launches N SITL boat instances on UDP ports 14550, 14560, 14570...
```

No test framework or linter is configured. Manual verification uses the `/health` and `/state` REST endpoints, and browser at `http://localhost:5173`.

## Architecture

### Data Flow
```
ArduPilot SITL (UDP 14550+)
  → MAVLinkManager (10 Hz) — parses MAVLink, updates Vehicle state
  → FleetManager sync loop (5 Hz) — pushes GPS positions into MeshNetwork nodes
  → MeshNetwork (1 Hz) — calculates signal strength, peer discovery, leader election
  → FleetManager broadcast loop (5 Hz) — serializes fleet+mesh state to JSON
  → WebSocket server (port 8000) — broadcasts to all connected React clients
  → Frontend useWebSocket hook — drives component re-renders
  → User commands → WebSocket → FleetManager → MAVLink/Mesh
```

### Backend Subsystems

**`backend/core/`**
- `vehicle.py` — `Vehicle` dataclass: GPS position, attitude, armed status, flight mode, battery, mesh peers. `to_dict()` is the serialization contract used by the WebSocket broadcast.
- `mavlink_manager.py` — Connects to N SITL UDP ports (`14550 + boat_id * 10`), non-blocking MAVLink read loop at 10 Hz. Handles HEARTBEAT, GLOBAL_POSITION_INT, GPS_RAW_INT, VFR_HUD, ATTITUDE, SYS_STATUS. Issues arm/disarm, mode change, and waypoint upload commands.

**`backend/mesh/`**
- `peer.py` — `Peer` dataclass with states ACTIVE/DEGRADED/UNREACHABLE/OFFLINE, direct peer list, signal strength dict, and leader election fields.
- `mesh_network.py` — Simulated P2P mesh: haversine distance → signal strength (80-100% at <500m, exponential decay to 2000m cutoff). BFS routing table generation. Heartbeat-based peer discovery (1 Hz). MeshMessage dataclass with source/dest/type/payload/hops/TTL(5).
- `leader_election.py` — Bully Algorithm: highest node ID wins. Election timeout 3s, heartbeat timeout 5s. Emits ELECTION/VICTORY messages through mesh. Fires `on_leader_change` callback.

**`backend/fleet/`**
- `fleet_manager.py` — Central orchestrator. Runs four concurrent async loops: MAVLink telemetry (10 Hz), mesh network (1 Hz), state sync (5 Hz), broadcast (5 Hz). Syncs GPS data from `Vehicle` objects into mesh `Peer` nodes and back. Maintains in-memory event log (max 500 entries). Handles all user commands including GNSS-denied simulation (dead reckoning with growing uncertainty radius, capped at 2000m) and demo scenarios.
- `mission_engine.py` — Generates swarm formation waypoints: line, grid survey, perimeter patrol, follow-the-leader. Returns `Dict[vessel_id → List[waypoint_dicts]]` with lat, lon, alt, hold_time, radius.

**`backend/api/websocket_server.py`** — FastAPI app with CORS. `/ws` WebSocket endpoint broadcasts state at 5 Hz. Receives JSON commands. HTTP endpoints: `/health`, `/state`, `/events`.

### Frontend Architecture

Single React 18 app at `frontend/src/`. All WebSocket state flows through `useWebSocket.js` hook (auto-reconnect at 3s), which exposes `fleetState`, `connected`, `lastUpdate`, and `sendCommand()`.

**App layout** (`App.jsx`): Map (70% width) + side panel (30% width, tabbed: telemetry/mission/PID). Bottom row: mesh topology + fleet status. Below that: event log + mission replay. Maintains selected vehicle, waypoints array, and circular history buffer (1500 frames ≈ 5 min @ 5 Hz) for replay.

**Key constants** (`src/utils/constants.js`): WebSocket URL `ws://localhost:8000/ws`, map center Sydney Harbour (-33.8568, 151.2153), signal thresholds (>70% strong, 30-70% degraded, <30% weak), flight modes (MANUAL/GUIDED/AUTO/HOLD/LOITER/STEERING/RTL), 10 PID parameters.

**UI theme** (`src/styles/globals.css`): Dark maritime console aesthetic. CSS custom properties for all design tokens. Fonts: Outfit (display) + JetBrains Mono from Google Fonts. Primary background `#0a0e17`, accent `#06b6d4` cyan.

**Map** (`MapView.jsx` + `BoatMarker.jsx` + `MeshLink.jsx` + `WaypointMarker.jsx`): React-Leaflet with OpenStreetMap + OpenSeaMap tiles. Boat markers rotate to heading, color-coded by status (green=active, yellow=degraded, red=offline, blue outline=leader). 100-point trail polyline. Mesh links colored by signal strength. GNSS-denied shows dotted uncertainty circle.

## WebSocket Protocol

### State Broadcast (Backend → Frontend, 5 Hz)
```json
{
  "timestamp": 1711000000.123,
  "vehicles": [{ "id": 0, "name": "USV-00", "connected": true, "position": { "lat", "lon", "alt", "fix_type", "satellites" }, "heading", "groundspeed", "attitude": { "roll", "pitch", "yaw" }, "armed", "mode", "battery": { "voltage", "remaining" }, "mesh": { "is_leader", "peers": [], "signal_strength": {} } }],
  "mesh": { "nodes": {}, "edges": [{ "from", "to", "distance", "signal", "state" }], "routing_table": {}, "leader": {}, "stats": { "messages_sent", "messages_relayed", "messages_dropped", "elections_held" }, "log": [] },
  "gnss_denied": { "0": { "active", "estimatedLat", "estimatedLon", "uncertaintyRadius", "elapsedSeconds" } },
  "events": [{ "time", "category", "message", "level" }]
}
```

### Commands (Frontend → Backend)
```
{ type: "arm", vehicle_id: N }
{ type: "disarm", vehicle_id: N }
{ type: "set_mode", vehicle_id: N, mode: "AUTO" }
{ type: "waypoint", vehicle_id: N, lat: F, lon: F }
{ type: "upload_mission", vehicle_id: N, waypoints: [{ lat, lon, alt }] }
{ type: "param_set", vehicle_id: N, param: "CRUISE_SPEED", value: 5.0 }
{ type: "simulate_failure", vehicle_id: N }
{ type: "simulate_restore", vehicle_id: N }
{ type: "force_election" }
{ type: "simulate_gps_loss", vehicle_id: N }
{ type: "simulate_gps_restore", vehicle_id: N }
{ type: "set_mesh_range", range: 2000 }
{ type: "run_demo" }
```

## Key Design Decisions

- **Port scheme**: SITL instances use `14550 + (boat_index * 10)`. The backend derives connection ports from the boat count argument.
- **No persistence**: All state (telemetry, event log, mesh topology) is in-memory. Restart clears all data.
- **Mesh is simulated**: Signal strength is calculated purely from GPS distance via haversine — no real RF hardware. The mesh runs as a Python simulation layer on top of MAVLink telemetry.
- **GNSS-denied mode**: `FleetManager` can freeze GPS updates and switch to dead reckoning (heading + speed integration) per-vessel. Uncertainty grows ~10m/s, capped at 2000m.
- **WebSocket is the only command API**: There are no REST endpoints for commands — everything goes through WebSocket JSON messages. `/health`, `/state`, and `/events` are the only HTTP endpoints.
- **Naming**: Vehicles are `USV-{id:02d}` (e.g., USV-00), mesh nodes are `NODE-{id:02d}`.
- **Event categories**: system, command, mission, mesh, election — frontend filters by these.
- **All dataclasses have `.to_dict()`** for WebSocket JSON serialization.
- **Demo sequence** (spec §4.9): 0s init → 5s upload patrol + AUTO → 15s fail leader + election → 25s continue → 35s restore → 50s complete.

## Build Phases

Development follows `phase.md` (Phases 0–8). Full technical specification in `TECHNICAL_SPECIFICATION.md`. Current feature status tracked in `README.md` checklist (Tier 1 core features complete, Tier 2–3 in progress).

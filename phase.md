# USV Fleet Command — Phase-wise Build Plan

**Source of truth:** [TECHNICAL_SPECIFICATION.md](file:///d:/Drone%20Projects/USV%20Swarm%20Autonomous%20Fleet%20GCS%20Prototype/TECHNICAL_SPECIFICATION.md)

---

## Current State (Pre-Build Audit)

### What exists (all dumped flat in project root — needs reorganization)

| File | Target Location (per spec) | Status |
|------|---------------------------|--------|
| `vehicle.py` | `backend/core/vehicle.py` | ✅ Complete |
| `mavlink_manager.py` | `backend/core/mavlink_manager.py` | ✅ Complete |
| `peer.py` | `backend/mesh/peer.py` | ✅ Complete |
| `mesh_network.py` | `backend/mesh/mesh_network.py` | ✅ Complete |
| `leader_election.py` | `backend/mesh/leader_election.py` | ✅ Complete |
| `fleet_manager.py` | `backend/fleet/fleet_manager.py` | ✅ Complete |
| `websocket_server.py` | `backend/api/websocket_server.py` | ✅ Complete |
| `main.py` | `backend/main.py` | ✅ Complete |
| `requirements.txt` | `backend/requirements.txt` | ✅ Complete |
| `__init__.py` | `backend/core/__init__.py` | ✅ Exists |
| `__init__ (1).py` | `backend/mesh/__init__.py` | ✅ Exists |
| `__init__ (2).py` | `backend/fleet/__init__.py` | ✅ Exists |
| `__init__ (3).py` | `backend/api/__init__.py` | ✅ Exists |
| `launch_sitl.sh` | `scripts/launch_sitl.sh` | ✅ Complete |
| `package.json` | `frontend/package.json` | ✅ Complete |
| `vite.config.js` | `frontend/vite.config.js` | ✅ Complete |
| `index.html` | `frontend/index.html` | ✅ Complete |
| `README.md` | Root `README.md` | ✅ Complete |
| `TECHNICAL_SPECIFICATION.md` | `docs/TECHNICAL_SPECIFICATION.md` | ✅ Complete |
| `project_structure.txt` | Can be deleted (redundant) | 🗑️ Delete |
| `SKILL.md` | Not project code (Gemini skill) | ⬜ Keep in root |

### What doesn't exist yet

- `frontend/src/` — **Entire React application** (0 components built)
- `backend/fleet/mission_engine.py` — Mission planning & swarm patterns
- `docs/ARCHITECTURE.md` — Architecture diagrams

---

## Phase 0 — Project Scaffolding & File Organization

**Goal:** Move all flat files into the correct folder structure so imports work and the project is runnable.

### Tasks

1. Create directory structure:
   ```
   backend/core/
   backend/mesh/
   backend/fleet/
   backend/api/
   frontend/src/
   frontend/src/components/
   frontend/src/hooks/
   frontend/src/utils/
   frontend/src/styles/
   scripts/
   docs/
   ```

2. Move files to correct locations:
   - `vehicle.py` → `backend/core/vehicle.py`
   - `mavlink_manager.py` → `backend/core/mavlink_manager.py`
   - `__init__.py` → `backend/core/__init__.py`
   - `peer.py` → `backend/mesh/peer.py`
   - `mesh_network.py` → `backend/mesh/mesh_network.py`
   - `leader_election.py` → `backend/mesh/leader_election.py`
   - `__init__ (1).py` → `backend/mesh/__init__.py`
   - `fleet_manager.py` → `backend/fleet/fleet_manager.py`
   - `__init__ (2).py` → `backend/fleet/__init__.py`
   - `websocket_server.py` → `backend/api/websocket_server.py`
   - `__init__ (3).py` → `backend/api/__init__.py`
   - `main.py` → `backend/main.py`
   - `requirements.txt` → `backend/requirements.txt`
   - `package.json` → `frontend/package.json`
   - `vite.config.js` → `frontend/vite.config.js`
   - `index.html` → `frontend/index.html`
   - `launch_sitl.sh` → `scripts/launch_sitl.sh`
   - `TECHNICAL_SPECIFICATION.md` → `docs/TECHNICAL_SPECIFICATION.md`

3. Delete `project_structure.txt` (redundant with this plan).

4. Keep `README.md` and `SKILL.md` in root.

### How to test Phase 0

- ✅ Verify folder structure matches the spec's Section 9
- ✅ Run `cd backend && python -c "from core.vehicle import Vehicle; print(Vehicle(0))"` — should print without import errors
- ✅ Run `cd backend && python -c "from mesh.mesh_network import MeshNetwork; print('OK')"` — should print OK
- ✅ Run `cd backend && python -c "from fleet.fleet_manager import FleetManager; print('OK')"` — should print OK
- ✅ Run `cd backend && python -c "from api.websocket_server import app; print('OK')"` — should print OK

---

## Phase 1 — Backend Verification & Frontend Skeleton

**Goal:** Confirm backend runs against SITL (or gracefully without it), create minimal React app that connects via WebSocket and shows connection status.

### Tasks

#### Backend
1. Install Python dependencies: `cd backend && pip install -r requirements.txt`
2. Verify `python main.py --boats 3` starts without SITL (should show connection attempts, not crash)
3. Verify `/health` REST endpoint returns `{"status": "ok"}`
4. Verify `/state` REST endpoint returns the fleet state JSON structure

#### Frontend
5. `cd frontend && npm install`
6. Create `src/main.jsx` — React entry point
7. Create `src/App.jsx` — Main layout shell (dark theme, header bar, placeholder panels)
8. Create `src/styles/globals.css` — Dark navy/charcoal theme, CSS variables for colors
9. Create `src/hooks/useWebSocket.js` — WebSocket hook connecting to `ws://localhost:8000/ws`
10. Create `src/utils/constants.js` — Color palette, config values, unit conversions
11. Create `src/utils/formatters.js` — Unit conversion helpers (m/s → knots, etc.)
12. Create `src/components/Header.jsx` — Top bar showing "USV Fleet Command" + connection status + fleet count

### How to test Phase 1

- ✅ `cd backend && python main.py` — starts without crashing (even without SITL)
- ✅ `curl http://localhost:8000/health` — returns `{"status": "ok"}`
- ✅ `curl http://localhost:8000/state` — returns valid JSON with `vehicles` and `mesh` keys
- ✅ `cd frontend && npm run dev` — Vite starts, opens at http://localhost:5173
- ✅ Browser shows dark-themed header with "USV Fleet Command" and connection indicator
- ✅ If backend is running, header shows "Connected" (green); if not, "Disconnected" (red)

---

## Phase 2 — Maritime Map & Boat Markers

**Goal:** Display an interactive maritime map with boat icons that update position in real-time from backend telemetry.

### Tasks

1. Create `src/components/MapView.jsx`
   - Leaflet map with OpenStreetMap tiles
   - Default center: Sydney Harbour (-33.8568, 151.2153), zoom 14
   - OpenSeaMap overlay for nautical charts
   - Support zoom/pan

2. Create `src/components/BoatMarker.jsx`
   - Directional boat icon (rotates with heading)
   - Color-coded by status: green=active, yellow=degraded, red=offline, blue outline=leader
   - Label showing name (USV-00) and mode (AUTO)
   - Trail line (last 100 positions as a fading polyline)
   - Click to select vessel

3. Integrate `MapView` into `App.jsx` — occupies 70% width of main panel

### How to test Phase 2

- ✅ Map renders centered on Sydney Harbour
- ✅ When backend is running with SITL: 3 boat icons visible on the map
- ✅ Boat icons rotate based on heading
- ✅ Without SITL: boats appear at (0,0) or default coords — no crash
- ✅ Clicking a boat icon highlights/selects it
- ✅ Pan and zoom work smoothly

---

## Phase 3 — Telemetry Panels & Command Interface

**Goal:** Show per-vehicle telemetry data and allow sending commands (arm/disarm/mode).

### Tasks

1. Create `src/components/TelemetryPanel.jsx`
   - Displays all fields from spec §4.2 (GPS, heading, speed, attitude, mode, battery, etc.)
   - Compass widget for heading
   - Battery color bar (green/yellow/red)
   - GPS fix icon
   - ARMED/DISARMED badge
   - LEADER badge
   - Updates at 5 Hz from WebSocket data

2. Create `src/components/CommandPanel.jsx`
   - Arm/Disarm toggle button
   - Mode dropdown (MANUAL, GUIDED, AUTO, HOLD, LOITER, STEERING)
   - Return to Launch button
   - Emergency Stop button (red)
   - Fleet-wide: Arm All, Disarm All, All to AUTO, All to HOLD, Emergency Stop All
   - Click-on-map waypoint in GUIDED mode

3. Integrate into `App.jsx` side panel (30% width)

### How to test Phase 3

- ✅ Select a boat → side panel shows its telemetry data
- ✅ Telemetry values update in real-time (visible number changes)
- ✅ Battery bar changes color based on percentage value
- ✅ Click "Arm" → backend logs `[MAVLink] Arming USV-00`
- ✅ Mode dropdown sends `set_mode` command via WebSocket
- ✅ "Emergency Stop All" sends disarm + HOLD to all vehicles

---

## Phase 4 — Mesh Network Visualization

**Goal:** Display mesh topology graph and network links on the map.

### Tasks

1. Create `src/components/MeshTopology.jsx`
   - SVG/Canvas force-directed graph of mesh nodes
   - Nodes: circles with vessel name, leader gets crown/star
   - Edges: color-coded by signal strength (green >70%, yellow 30-70%, red <30%)
   - Signal % label on each edge
   - Node goes grey when offline
   - Animate message routing (dot traveling along path)

2. Create `src/components/MeshLink.jsx`
   - Draws signal link lines on the Leaflet map between boats
   - Solid green for strong, dashed yellow for degraded, no line for out-of-range

3. Add network statistics panel (messages sent/relayed/dropped, elections held, average signal, connectivity %)

### How to test Phase 4

- ✅ Mesh topology graph visible in bottom-left panel
- ✅ 3 nodes connected by edges with signal % labels
- ✅ Map shows signal lines between boats
- ✅ Lines change color/style as signal varies
- ✅ Stats panel shows message counters incrementing

---

## Phase 5 — Fleet Health & Simulation Controls

**Goal:** Fleet status cards, simulation failure/restore buttons, and leader election demo.

### Tasks

1. Create `src/components/FleetStatus.jsx`
   - Summary bar: Total | Online | Degraded | Offline
   - Per-vessel compact cards: Name, Status dot, Mode, Speed, Battery, Signal
   - Sort by Name/Status/Battery/Signal
   - Alert: flash on low battery, GPS loss, offline
   - Quick actions: Arm/Disarm, Mode selector, Simulate Failure, Restore

2. Create `src/components/SimulationControls.jsx`
   - Simulate vessel failure button (per vessel)
   - Restore vessel button
   - Force election button
   - Mesh range slider (500m–5000m)

3. Update `MeshTopology.jsx` to animate election process:
   - Show election messages flowing between nodes
   - Highlight winner with victory animation

### How to test Phase 5

- ✅ Fleet cards show all 3 boats with status/battery/signal
- ✅ Click "Simulate Failure" on leader → fleet card goes red, mesh node goes grey
- ✅ Election triggers automatically, new leader selected within 5s
- ✅ "Restore" brings boat back, rejoins mesh
- ✅ "Force Election" triggers election without any failure
- ✅ Alerts flash when battery drops or vessel goes offline

---

## Phase 6 — Mission Planner & Waypoint Upload

**Goal:** Plan and upload waypoint missions from the map.

### Tasks

1. Create `src/components/MissionPlanner.jsx`
   - Click map to add numbered waypoint markers (when boat selected in GUIDED mode)
   - Waypoints connected by path line
   - Drag to reposition, right-click to remove
   - Per-waypoint: hold time, acceptance radius
   - "Upload Mission" → sends waypoint list via WebSocket
   - "Upload to Fleet" → distributes with offsets
   - "Clear Mission" / "Start Mission" buttons
   - Show mission progress (current waypoint highlighted)

2. Create `src/components/WaypointMarker.jsx` — numbered marker on map

3. Create `backend/fleet/mission_engine.py`
   - Mission planning & upload coordination
   - Waypoint list management

### How to test Phase 6

- ✅ Select boat, click map → waypoint markers appear numbered
- ✅ Drag waypoint → position updates
- ✅ Right-click waypoint → removed
- ✅ "Upload Mission" → backend logs waypoint upload
- ✅ "Start Mission" → backend sets mode to AUTO
- ✅ "Clear Mission" → all markers removed

---

## Phase 7 — Event Log & Advanced Features

**Goal:** Event logging, swarm patterns, PID tuning, and demo scenario.

### Tasks

1. Create `src/components/EventLog.jsx`
   - Scrollable, filterable log panel
   - Categories: System, Mesh, Mission, Command
   - Color-coded: grey=info, yellow=warning, red=error, blue=election
   - Search and filter controls
   - Export button (JSON/CSV)

2. Create `src/components/PIDTuning.jsx`
   - Read/write ArduPilot PID parameters
   - Sliders and number inputs
   - Preset buttons (Conservative, Aggressive, Balanced)

3. Add swarm pattern generator to `mission_engine.py`:
   - Line formation
   - Area survey grid
   - Perimeter patrol
   - Follow the leader

4. Add pattern selector UI in `MissionPlanner.jsx`
   - Visual previews, configurable params, preview on map, execute button

5. Demo scenario button ("Run Demo") — automated 50-second sequence from spec §4.9

### How to test Phase 7

- ✅ Event log populates with system/mesh/election events
- ✅ Filter by category works
- ✅ Export downloads a valid JSON/CSV file
- ✅ PID tuning panel reads current values (with SITL)
- ✅ "Run Demo" executes the automated scenario from spec §4.9
- ✅ Swarm pattern selector generates waypoints and previews on map

---

## Phase 8 — Polish, GNSS-Denied & Final QA

**Goal:** GNSS-denied visualization, mission replay, UI polish, and full acceptance testing.

### Tasks

1. GNSS-denied fallback (spec §4.12):
   - "Simulate GPS Loss" button
   - Dead reckoning estimated position + growing uncertainty circle
   - Dashed outline icon with "DR" label

2. Mission replay:
   - Timeline scrubber for replaying recorded positions/events
   - Map and telemetry update to historical state

3. UI polish:
   - Defence/maritime dark theme refinement
   - Micro-animations for state changes
   - Responsive layout check
   - Performance optimization (5 Hz updates smooth with 10+ boats)

4. Full acceptance test against spec §11 criteria:
   - Three SITL boats visible on map with real-time updates
   - Telemetry panels accurate at 5 Hz
   - Mesh links visible with signal indicators
   - Leader failure → re-election within 5s
   - Multi-hop routing demonstrated
   - Waypoint missions uploadable and executable
   - At least one swarm pattern works for 3 boats
   - Fleet-wide commands work
   - Demo scenario runs end-to-end
   - Clean, commented code following module structure

### How to test Phase 8

- ✅ "Simulate GPS Loss" → icon changes to dashed outline with "DR", uncertainty circle grows
- ✅ Mission replay scrubber moves through timeline, map shows historical positions
- ✅ All 10 acceptance criteria from spec §11 pass
- ✅ UI looks like a defence/maritime radar console, not a consumer app
- ✅ No crashes or freezes during 5-minute continuous operation

---

## Summary

| Phase | Description | Key Deliverable |
|-------|-------------|-----------------|
| 0 | Scaffolding & file reorganization | Working folder structure with valid imports |
| 1 | Backend verification + frontend skeleton | Running backend + dark UI shell with WebSocket |
| 2 | Maritime map + boat markers | Live boat icons on Leaflet map |
| 3 | Telemetry + commands | Real-time data panels + arm/disarm/mode |
| 4 | Mesh network visualization | Topology graph + signal lines on map |
| 5 | Fleet health + simulation controls | Status cards + failure/election demo |
| 6 | Mission planner + waypoints | Map-based waypoint planning + upload |
| 7 | Event log + advanced features | Logging, PID tuning, swarm patterns, demo |
| 8 | Polish + GNSS-denied + QA | Final acceptance against all 10 criteria |

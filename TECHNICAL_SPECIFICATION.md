# USV Fleet Command — Technical Specification

**Project:** USV Fleet Command — Multi-Vessel Autonomous Ground Control Station  
**Author:** Mohammad Yusuf Khan  
**Version:** 1.0  
**Date:** March 2026  
**Client:** Vanguard APAC (Australia) — Defence & Maritime Autonomous Systems  
**Status:** Development Ready  

---

## 1. Executive Summary

USV Fleet Command is a web-based Ground Control Station (GCS) for managing fleets of autonomous Unmanned Surface Vessels (USVs). The system provides real-time telemetry, mesh networking with multi-hop peer-to-peer communication, autonomous leader election, swarm mission coordination, and fleet health monitoring — all through a single unified dashboard.

The software is designed for defence-grade maritime operations. The Australian Navy recently committed $176M AUD to expanding its USV fleet (Bluebottle program, March 2026), and the US Navy has merged its LUSV/MUSV programs into the MASC program with prototype contracts expected in FY2026. This project positions Vanguard APAC as a software provider in this rapidly growing market.

The system connects to ArduPilot-based USVs (Rover/Boat firmware) via MAVLink protocol. For development and demonstration, ArduPilot SITL (Software In The Loop) simulates multiple boats without requiring physical hardware.

**Total licensing cost for the entire stack: $0 (all open-source).**

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      REACT DASHBOARD (Frontend)                      │
│                                                                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐  │
│  │  Maritime    │ │  Telemetry  │ │   Mesh      │ │   Mission    │  │
│  │  Map View   │ │  Panels     │ │  Topology   │ │   Planner    │  │
│  │  (Leaflet)  │ │             │ │  Graph      │ │              │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────┘  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐  │
│  │  Fleet      │ │  Leader     │ │  PID Tuning │ │   Event      │  │
│  │  Health     │ │  Election   │ │  Interface  │ │   Log        │  │
│  │  Dashboard  │ │  Monitor    │ │             │ │              │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────┘  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ WebSocket (JSON, 5 Hz)
┌───────────────────────────┴─────────────────────────────────────────┐
│                    PYTHON BACKEND (FastAPI)                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Fleet Manager (Orchestrator)                │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │   │
│  │  │  MAVLink    │  │  Mesh        │  │  Mission           │  │   │
│  │  │  Manager    │  │  Network     │  │  Engine            │  │   │
│  │  │             │  │              │  │                    │  │   │
│  │  │ - Connect   │  │ - Topology   │  │ - Waypoint upload  │  │   │
│  │  │ - Telemetry │  │ - Routing    │  │ - Pattern gen      │  │   │
│  │  │ - Commands  │  │ - Signal sim │  │ - Mission execute  │  │   │
│  │  │ - Heartbeat │  │ - Relay      │  │ - Formation ctrl   │  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────────────────┘  │   │
│  │         │                │                                    │   │
│  │         │         ┌──────┴───────┐                           │   │
│  │         │         │   Leader     │                           │   │
│  │         │         │   Election   │                           │   │
│  │         │         │   (Bully)    │                           │   │
│  │         │         └──────────────┘                           │   │
│  └─────────┼────────────────────────────────────────────────────┘   │
└────────────┼────────────────────────────────────────────────────────┘
             │ MAVLink (UDP)
┌────────────┼────────────────────────────────────────────────────────┐
│  ┌─────────┴──┐   ┌──────────┐   ┌──────────┐   ┌──────────┐      │
│  │ ArduPilot  │   │ ArduPilot│   │ ArduPilot│   │   ...    │      │
│  │ SITL #0    │   │ SITL #1  │   │ SITL #2  │   │  SITL #N │      │
│  │ Boat 0     │   │ Boat 1   │   │ Boat 2   │   │  Boat N  │      │
│  │ Port 14550 │   │ Port 14560│  │ Port 14570│  │          │      │
│  └────────────┘   └──────────┘   └──────────┘   └──────────┘      │
│                    SIMULATION LAYER                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

1. Each ArduPilot SITL instance simulates a boat and emits MAVLink telemetry over UDP.
2. The MAVLink Manager connects to each instance, parses messages, and populates Vehicle state objects.
3. The Mesh Network layer reads GPS positions from vehicles, calculates inter-vessel distances, simulates radio signal strength, maintains a routing table, and runs leader election.
4. The Fleet Manager orchestrates all subsystems and produces a unified state object.
5. The WebSocket server pushes this state to the React frontend at 5 Hz.
6. The frontend renders the map, telemetry, mesh topology, and provides interactive controls.
7. User commands (arm, disarm, waypoint, simulate failure) flow back through WebSocket to the Fleet Manager.

---

## 3. Technology Stack

| Layer | Technology | Version | License | Cost |
|-------|-----------|---------|---------|------|
| Autopilot Firmware | ArduPilot (ArduRover/Boat) | 4.5+ | GPLv3 | Free |
| Vehicle Protocol | MAVLink 2.0 | 2.0 | MIT | Free |
| Python MAVLink | pymavlink | 2.4.41 | LGPLv3 | Free |
| Backend Framework | FastAPI | 0.109+ | MIT | Free |
| ASGI Server | Uvicorn | 0.27+ | BSD | Free |
| WebSocket | websockets | 12.0 | BSD | Free |
| Data Validation | Pydantic | 2.5+ | MIT | Free |
| Numerical | NumPy | 1.26+ | BSD | Free |
| Frontend Framework | React | 18.2+ | MIT | Free |
| Build Tool | Vite | 5.0+ | MIT | Free |
| Maps | Leaflet + react-leaflet | 1.9 / 4.2 | BSD | Free |
| Map Tiles | OpenStreetMap | - | ODbL | Free |
| Simulation | ArduPilot SITL | 4.5+ | GPLv3 | Free |

---

## 4. Feature Specifications

### 4.1 FEATURE: Multi-USV Maritime Map View

**Priority:** P0 (Critical)  
**Component:** Frontend — `MapView.jsx`

**Description:**  
An interactive maritime map displaying all USVs in real-time with position, heading, trail history, and status indicators.

**Requirements:**

- Use Leaflet with OpenStreetMap tiles. Maritime/nautical chart tiles preferred if available (OpenSeaMap overlay).
- Each USV is displayed as a directional boat icon that rotates based on heading.
- Boat icons are color-coded by status: Green = active, Yellow = degraded signal, Red = offline/lost, Blue outline = leader vessel.
- Each boat displays a small label with its name (e.g., "USV-01") and current mode (e.g., "AUTO").
- Trail history: show the last 100 positions as a fading polyline behind each boat.
- Click on a boat to select it and show its detailed telemetry panel.
- Click on the map (when a boat is selected in GUIDED mode) to send a waypoint command.
- Display mesh network links as lines between boats: solid green for strong signal, dashed yellow for degraded, no line for out of range.
- Support panning, zooming, and auto-centering on the fleet.
- Default view centered on Sydney Harbour, Australia (-33.8568, 151.2153) for demo.
- Waypoint markers: when a mission is uploaded, show numbered waypoint markers on the map connected by a path line.

**Data Input:** Vehicle array from WebSocket with lat, lon, heading, mode, mesh state.

---

### 4.2 FEATURE: Real-Time Telemetry Panels

**Priority:** P0 (Critical)  
**Component:** Frontend — `TelemetryPanel.jsx`

**Description:**  
Per-vehicle telemetry display showing all critical data received from ArduPilot via MAVLink.

**Requirements:**

- One panel per selected vehicle (or a compact grid showing all vehicles).
- Display the following data fields, updating at 5 Hz:

| Field | Source MAVLink Message | Unit |
|-------|----------------------|------|
| GPS Latitude | GLOBAL_POSITION_INT | degrees |
| GPS Longitude | GLOBAL_POSITION_INT | degrees |
| Altitude | GLOBAL_POSITION_INT | meters |
| Heading | VFR_HUD | degrees (0-360) |
| Groundspeed | VFR_HUD | m/s (also show knots) |
| Roll | ATTITUDE | degrees |
| Pitch | ATTITUDE | degrees |
| Yaw | ATTITUDE | degrees |
| Flight Mode | HEARTBEAT | string (MANUAL, GUIDED, AUTO, etc.) |
| Armed Status | HEARTBEAT | boolean |
| Battery Voltage | SYS_STATUS | volts |
| Battery Remaining | SYS_STATUS | percentage |
| GPS Fix Type | GPS_RAW_INT | 0/2/3 (No Fix/2D/3D) |
| Satellites Visible | GPS_RAW_INT | count |
| Connection Age | Heartbeat timestamp | seconds since last heartbeat |

- Visual indicators: Use a compass widget for heading. Use color bars for battery (green > 50%, yellow 20-50%, red < 20%). Show GPS fix as an icon (red X for no fix, yellow circle for 2D, green circle for 3D).
- Knot conversion: 1 m/s = 1.94384 knots. Show both units.
- Show "ARMED" / "DISARMED" badge with appropriate coloring.
- Show "LEADER" badge if this vessel is the current mesh leader.

---

### 4.3 FEATURE: Mesh Network with Peer-to-Peer Communication

**Priority:** P0 (Critical)  
**Component:** Backend — `mesh/mesh_network.py`, Frontend — `MeshTopology.jsx`

**Description:**  
A fully functional mesh networking layer that simulates peer-to-peer communication between USVs. The mesh handles peer discovery, signal strength calculation, multi-hop message routing, and link failure detection. In production, the transport layer (currently simulated via distance calculations) would be swapped with actual mesh radio SDKs (Rajant, Silvus, or custom).

**4.3.1 Signal Strength Simulation**

Signal strength between two nodes is calculated from their GPS distance using the haversine formula:

```
distance = haversine(lat1, lon1, lat2, lon2)  → meters

signal_strength:
  0 - 500m    → 80-100% (strong)
  500 - 1500m → 30-80%  (degraded, exponential decay)
  1500 - 2000m→ 0-30%   (weak)
  > 2000m     → 0%      (out of range, no link)
```

These parameters are configurable via `MESH_CONFIG`:

| Parameter | Default | Description |
|-----------|---------|-------------|
| max_range_meters | 2000 | Maximum communication range |
| strong_signal_range | 500 | Range for strong signal (>80%) |
| degraded_range | 1500 | Range where signal starts degrading |
| heartbeat_interval | 1.0s | Mesh heartbeat frequency |
| peer_timeout | 5.0s | Time before peer is considered lost |
| max_hops | 5 | Maximum relay hops for a message |

**4.3.2 Peer Discovery**

- Each node broadcasts a mesh heartbeat every `heartbeat_interval` seconds.
- Heartbeats contain: node_id, position, leader status, election term.
- When a node receives a heartbeat, it adds/updates the sender in its peer list.
- If no heartbeat is received for `peer_timeout` seconds, the peer is marked OFFLINE.

**4.3.3 Multi-Hop Message Routing**

Messages between nodes that cannot directly reach each other are relayed through intermediate nodes:

```
Example: Boat 0 wants to send to Boat 2, but they are too far apart.
         Boat 1 is in range of both.

Boat 0 → [message] → Boat 1 (relay) → [message] → Boat 2

Routing table is built using BFS (Breadth-First Search) across the topology graph.
```

Message structure:

```python
MeshMessage:
  msg_id: str          # Unique ID
  source_id: int       # Original sender
  dest_id: int         # Final destination (-1 for broadcast)
  msg_type: str        # "heartbeat" | "telemetry" | "command" | "election" | "relay"
  payload: dict        # Message data
  hops: List[int]      # Nodes this message has traversed
  ttl: int             # Time to live (max hops, default 5)
  timestamp: float     # Creation time
```

Routing algorithm:
1. Check if destination is a direct peer → send directly.
2. If not, consult routing table (pre-computed BFS shortest paths).
3. Forward to next hop. Decrement TTL.
4. If TTL reaches 0, drop the message.
5. Track hops to prevent routing loops.

**4.3.4 Mesh Topology Visualization (Frontend)**

- Display a network graph diagram showing all nodes and their connections.
- Nodes are circles with the vessel name inside. Leader node has a distinct crown/star icon.
- Edges between nodes represent direct links. Edge color and style indicate signal quality: solid green (>70%), dashed yellow (30-70%), dotted red (<30%).
- Display signal strength percentage on each edge.
- Show message routing in real-time: when a message is sent, animate a dot traveling along the path (source → relay → destination).
- When a node goes offline, its circle turns grey and all edges disappear with an animation.
- When leader election occurs, highlight the election process: show election messages flowing between nodes, then the victory broadcast.

**4.3.5 Network Statistics Panel**

Display running counters:
- Messages Sent
- Messages Relayed (multi-hop)
- Messages Dropped (no route / TTL expired)
- Elections Held
- Current Leader
- Average Signal Strength
- Network Connectivity (% of possible links that are active)

---

### 4.4 FEATURE: Leader Election (Bully Algorithm)

**Priority:** P0 (Critical)  
**Component:** Backend — `mesh/leader_election.py`

**Description:**  
Automatic leader election among USV fleet nodes using the Bully Algorithm. The leader is the coordinating vessel that aggregates telemetry, relays data to GCS, and coordinates fleet movements. If the leader goes offline, a new leader is automatically elected with zero human intervention.

**Algorithm:**

1. Every node has a unique ID (higher ID = higher priority).
2. When a node detects the leader's heartbeat has timed out (5 seconds), it initiates an election.
3. The initiating node sends ELECTION messages to all nodes with higher IDs.
4. If a higher-ID node is alive, it responds with ALIVE and takes over the election process.
5. The election cascades upward until the highest alive node wins.
6. The winner sends a VICTORY broadcast to all nodes.
7. All nodes update their leader reference.

**Election States:**

```
IDLE → ELECTION_STARTED → WAITING_FOR_RESPONSE → WINNER_DECLARED
                                    ↓
                              RESPONSE_RECEIVED → CASCADE_UP → WINNER_DECLARED
                                    ↓
                              TIMEOUT (3s) → INITIATOR_WINS
```

**Requirements:**

- Election should complete within 3-5 seconds.
- If two elections are triggered simultaneously, only one should proceed (election lock).
- The UI should display the election process in real-time: show which nodes are communicating, who is the candidate, and the final winner.
- An election log panel shows timestamped entries of every election event.
- A "Simulate Leader Failure" button in the UI triggers a forced failure for demo purposes.
- After failure, the UI should visibly show: leader going offline → election messages → new leader elected → fleet continues operating.

**Frontend Visualization:**

- Leader node has a distinct visual indicator (crown icon, golden border, or "LEADER" badge).
- During election: show animated pulse on participating nodes and animated message arrows between them.
- Election log: scrollable list with entries like:
  ```
  [14:32:05] Leader USV-02 heartbeat timeout!
  [14:32:05] Election started by USV-00
  [14:32:06] ELECTION msg: USV-00 → USV-01
  [14:32:06] ALIVE response from USV-01
  [14:32:06] VICTORY: USV-01 is the new leader (term 3)
  ```

---

### 4.5 FEATURE: Fleet Health Dashboard

**Priority:** P1 (High)  
**Component:** Frontend — `FleetStatus.jsx`

**Description:**  
A consolidated view of the entire fleet's health at a glance.

**Requirements:**

- Summary bar at the top showing: Total Vessels | Online | Degraded | Offline.
- Fleet-wide metrics: Average speed, Total distance covered, Active missions.
- Per-vessel compact cards showing: Name, Status (color dot), Mode, Speed, Battery, Signal to leader.
- Cards are sortable by: Name, Status, Battery, Signal strength.
- Alert system: Flash a warning when a vessel drops below 20% battery, loses GPS fix, goes offline, or enters an unrecognized mode.
- Quick actions on each card: Arm/Disarm toggle, Mode selector dropdown (MANUAL, GUIDED, AUTO, HOLD, LOITER), "Simulate Failure" button, "Restore" button.

---

### 4.6 FEATURE: Waypoint Mission Planner

**Priority:** P1 (High)  
**Component:** Frontend — `MissionPlanner.jsx`, Backend — `fleet/mission_engine.py`

**Description:**  
Plan and upload waypoint missions to individual USVs or the entire fleet.

**Requirements:**

- Click on the map to add waypoint markers for a selected vessel.
- Waypoints are numbered and connected by a path line.
- Drag waypoints to reposition them.
- Right-click a waypoint to remove it.
- Set per-waypoint parameters: Hold time (seconds), Acceptance radius (meters).
- "Upload Mission" button sends the waypoint list to the selected vessel via MAVLink.
- "Upload to Fleet" distributes the mission (with offsets) across all vessels.
- "Clear Mission" removes all waypoints.
- "Start Mission" sets the vessel to AUTO mode to begin executing waypoints.
- Display mission progress: highlight the current waypoint, show completed vs. remaining.
- Mission presets (see Section 4.7 Swarm Patterns): Line formation, Grid survey, Perimeter patrol.

**Backend Mission Upload Flow:**

```
1. Frontend sends waypoint list via WebSocket: {type: "upload_mission", vehicle_id: 0, waypoints: [{lat, lon, alt}, ...]}
2. Fleet Manager → MAVLink Manager → send MISSION_COUNT, then MISSION_ITEM_INT for each waypoint.
3. ArduPilot acknowledges with MISSION_ACK.
4. Frontend sends {type: "set_mode", vehicle_id: 0, mode: "AUTO"} to start.
```

---

### 4.7 FEATURE: Swarm Mission Patterns

**Priority:** P2 (Medium)  
**Component:** Backend — `fleet/mission_engine.py`

**Description:**  
Pre-built formation patterns that generate waypoint missions for the entire fleet automatically.

**Patterns to implement:**

**4.7.1 Line Formation**
- All boats sail in a straight line with configurable spacing.
- Input: Start point, End point, Inter-vessel spacing (meters).
- Output: Parallel waypoint paths for each vessel.
- Use case: Transit formation, convoy escort.

**4.7.2 Area Survey Grid**
- Fleet covers a rectangular area in a lawn-mower pattern.
- Input: Four corner coordinates of the survey area, Number of vessels.
- Output: Each vessel gets a strip of the grid to cover (non-overlapping).
- Use case: Maritime surveillance, search operations.

**4.7.3 Perimeter Patrol**
- Fleet distributes evenly around a perimeter and patrols continuously.
- Input: Center point, Radius (meters), Number of vessels.
- Output: Each vessel gets a sector of the perimeter. Vessels patrol back and forth within their sector.
- Use case: Asset protection, harbor security.

**4.7.4 Follow the Leader**
- Fleet follows the leader vessel in a configurable formation (line, V-shape, echelon).
- Input: Leader ID, Formation type, Spacing.
- Output: Follower vessels dynamically adjust position relative to leader using GUIDED mode waypoints.
- Use case: Convoy, autonomous transit.

**Frontend:**
- Pattern selector panel with visual previews of each pattern.
- Configurable parameters (spacing, area, formation type).
- Preview on map before uploading.
- "Execute" button uploads to all vessels and starts.

---

### 4.8 FEATURE: Vehicle Command Interface

**Priority:** P0 (Critical)  
**Component:** Frontend — integrated into TelemetryPanel and FleetStatus

**Description:**  
Send commands to individual vehicles or the entire fleet from the dashboard.

**Commands:**

| Command | MAVLink Action | UI Element |
|---------|---------------|------------|
| Arm | `arducopter_arm()` | Toggle button |
| Disarm | `arducopter_disarm()` | Toggle button |
| Set Mode | `set_mode(mode_id)` | Dropdown: MANUAL, GUIDED, AUTO, HOLD, LOITER, STEERING |
| Go To (Waypoint) | `set_position_target_global_int` | Click on map in GUIDED mode |
| Upload Mission | Mission protocol (MISSION_COUNT + MISSION_ITEM_INT) | Mission planner |
| Return to Launch | Set mode RTL | Button |
| Emergency Stop | Disarm + HOLD mode | Red emergency button |

**Fleet-wide commands:**
- "Arm All" / "Disarm All"
- "All to AUTO" / "All to HOLD"
- "Emergency Stop All"

---

### 4.9 FEATURE: Simulation Controls (Demo Mode)

**Priority:** P1 (High)  
**Component:** Frontend + Backend

**Description:**  
Controls to demonstrate mesh networking and leader election for presentations and demos.

**Requirements:**

- **Simulate Vessel Failure:** Button per vessel. When clicked, the vessel's mesh heartbeat stops, signal drops to zero, and the vessel is marked offline. If it's the leader, a new election is triggered. The vessel remains in SITL (autopilot still running) but is treated as lost by the mesh layer.
- **Restore Vessel:** Button to bring a failed vessel back online. Heartbeat resumes, topology recalculates, and the vessel rejoins the mesh.
- **Force Election:** Button to trigger a leader election manually without any vessel going offline.
- **Adjust Mesh Range:** Slider (500m to 5000m) to dynamically change the maximum communication range. Useful for showing how boats go out of range.
- **Move Vessel:** In simulation, drag a boat to a new position to demonstrate signal degradation and multi-hop routing.

**Demo Scenario Script:**

The UI should have a "Run Demo" button that automatically executes this sequence:

```
0s   — All 3 boats active, USV-02 is leader
5s   — Upload patrol mission to all boats, start AUTO mode
15s  — Simulate USV-02 failure
16s  — Election triggers: USV-00 sends ELECTION to USV-01
17s  — USV-01 responds ALIVE, takes over
18s  — USV-01 wins, broadcasts VICTORY
25s  — Remaining boats continue patrol seamlessly
35s  — Restore USV-02 — it rejoins mesh as a follower
40s  — Move USV-00 far away — signal degrades, multi-hop routing activates
50s  — Demo complete
```

---

### 4.10 FEATURE: PID Tuning Interface

**Priority:** P2 (Medium)  
**Component:** Frontend — `PIDTuning.jsx`, Backend — parameter read/write via MAVLink

**Description:**  
A UI panel to read, modify, and monitor ArduPilot PID parameters in real-time.

**Key ArduPilot Rover/Boat Parameters:**

| Parameter | Description |
|-----------|-------------|
| ATC_STR_RAT_P | Steering rate P gain |
| ATC_STR_RAT_I | Steering rate I gain |
| ATC_STR_RAT_D | Steering rate D gain |
| ATC_SPEED_P | Speed P gain |
| ATC_SPEED_I | Speed I gain |
| ATC_SPEED_D | Speed D gain |
| CRUISE_SPEED | Target cruise speed (m/s) |
| CRUISE_THROTTLE | Throttle at cruise speed (%) |
| WP_RADIUS | Waypoint acceptance radius (m) |
| NAVL1_PERIOD | L1 navigation period |

**Requirements:**

- Read current parameter values from ArduPilot using MAVLink PARAM_REQUEST_READ / PARAM_VALUE.
- Display parameters in a form with sliders and number inputs.
- "Write" button sends PARAM_SET to update the parameter on the vehicle.
- Real-time PID response graph: plot steering error vs. time to visualize tuning quality.
- Preset buttons: "Conservative" (low gains), "Aggressive" (high gains), "Balanced" (default).

---

### 4.11 FEATURE: Event Log and Mission Replay

**Priority:** P2 (Medium)  
**Component:** Backend — logging module, Frontend — `EventLog.jsx`

**Description:**  
Log all events and enable replay for post-mission analysis.

**Log Categories:**

- **System:** Connections, disconnections, mode changes
- **Mesh:** Peer discovery, signal changes, link drops, elections
- **Mission:** Waypoint uploads, mission start/stop, waypoint reached
- **Command:** All commands sent from the UI

**Requirements:**

- All events are timestamped and stored in memory (and optionally exported to JSON file).
- Event log panel in the UI with filtering by category and search.
- Color-coded entries: Info (grey), Warning (yellow), Error (red), Election (blue).
- "Export Log" button downloads the full log as JSON or CSV.
- Mission replay: scrub through a timeline to replay vehicle positions and events. The map and telemetry panels update to show historical state.

---

### 4.12 FEATURE: GNSS-Denied Fallback Visualization

**Priority:** P3 (Nice to Have)  
**Component:** Backend + Frontend

**Description:**  
Demonstrate what happens when GPS signal is lost on a vessel.

**Requirements:**

- "Simulate GPS Loss" button per vessel.
- When triggered: GPS fix type drops to 0, satellite count drops to 0.
- The vessel's position on the map changes to an estimated position (dead reckoning from last known position + heading + speed).
- Show a growing uncertainty circle around the estimated position (expands over time).
- Mesh peers that can still see the vessel (via mesh heartbeat) can share their relative bearing/distance to help localize the GPS-denied vessel.
- Visual indicator on the map: vessel icon changes to a dashed outline with "DR" label (Dead Reckoning).

---

## 5. Backend Detailed Design

### 5.1 Module: `core/vehicle.py`

Dataclass representing a single USV's state. Fields: vehicle_id, name, connected, last_heartbeat, position (lat/lon/alt/fix/satellites), attitude (roll/pitch/yaw), groundspeed, heading, armed, mode, battery (voltage/remaining), mesh state (is_leader, peers, signal_strength). Method `to_dict()` serializes for WebSocket.

### 5.2 Module: `core/mavlink_manager.py`

Manages MAVLink UDP connections to N ArduPilot SITL instances. Async loop at 10 Hz reads messages from all connections. Processes HEARTBEAT, GLOBAL_POSITION_INT, GPS_RAW_INT, VFR_HUD, ATTITUDE, SYS_STATUS. Provides command methods: arm, disarm, set_mode, send_waypoint, upload_mission. Non-blocking reads ensure one slow connection doesn't block others.

### 5.3 Module: `mesh/peer.py`

Dataclass representing a mesh network node. Fields: node_id, name, lat, lon, state (ACTIVE/DEGRADED/UNREACHABLE/OFFLINE), direct_peers list, signal_strength dict, is_leader, election_term, inbox/outbox message queues.

### 5.4 Module: `mesh/mesh_network.py`

Core mesh networking engine. Updates topology every 1 second: calculates pairwise distances via haversine, computes signal strength, determines direct links, builds edges list. Routing table is computed via BFS shortest path. Message sending checks direct link first, then consults routing table for multi-hop. Relay processing forwards messages in outboxes. Provides simulation controls: simulate_link_drop, simulate_link_restore.

### 5.5 Module: `mesh/leader_election.py`

Bully algorithm. Registers peers, monitors leader heartbeat, starts elections on timeout. Election messages flow through inbox/outbox queues. Cascading election with 3-second timeout. force_leader_failure for demo. Returns state including election log for UI.

### 5.6 Module: `fleet/fleet_manager.py`

Central orchestrator. Owns MAVLinkManager and MeshNetwork instances. Sync loop (5 Hz) copies MAVLink GPS data into mesh node positions, copies mesh leader status back into vehicle objects. Broadcast loop sends unified state to WebSocket clients. Exposes all command methods.

### 5.7 Module: `fleet/mission_engine.py` (To Be Built)

Mission planning and swarm pattern generator. Takes pattern type + parameters, generates waypoint lists for each vessel. Handles mission upload coordination for fleet-wide missions.

### 5.8 Module: `api/websocket_server.py`

FastAPI app with WebSocket endpoint at /ws. Accepts JSON commands, dispatches to fleet_manager. Broadcasts state to all connected clients. CORS enabled for React dev server. REST endpoints: GET /health, GET /state.

---

## 6. Frontend Detailed Design

### 6.1 Layout

```
┌──────────────────────────────────────────────────────┐
│  USV Fleet Command               [Fleet: 3/3 Online] │ ← Header bar
├────────────────────────────────┬─────────────────────┤
│                                │  Selected Vehicle   │
│                                │  ┌───────────────┐  │
│                                │  │ Telemetry     │  │
│    Maritime Map View           │  │ Panel         │  │
│    (70% width)                 │  └───────────────┘  │
│                                │  ┌───────────────┐  │
│                                │  │ Commands      │  │
│                                │  │ Panel         │  │
│                                │  └───────────────┘  │
├────────────────────────────────┼─────────────────────┤
│  Mesh Topology Graph           │  Fleet Status Cards │
│  (Network visualization)       │  (All vessels)      │
├────────────────────────────────┴─────────────────────┤
│  Event Log / Election Log                             │ ← Bottom panel
└──────────────────────────────────────────────────────┘
```

### 6.2 Design Direction

- Dark theme (navy/charcoal background — fits maritime/defence aesthetic).
- Clean, data-dense layout. Think radar console, not consumer app.
- Accent colors: Cyan/teal for active elements, amber for warnings, red for critical.
- Monospace font for telemetry values. Sans-serif for labels.
- Minimal animations except for meaningful state changes (election, link drop, waypoint reached).

### 6.3 Component Tree

```
App
├── Header (fleet summary, connection status)
├── MainPanel
│   ├── MapView (Leaflet)
│   │   ├── BoatMarker (per vehicle)
│   │   ├── TrailLine (per vehicle)
│   │   ├── MeshLink (per edge)
│   │   ├── WaypointMarker (per waypoint)
│   │   └── MissionPath (per vehicle mission)
│   └── SidePanel
│       ├── TelemetryPanel (selected vehicle)
│       ├── CommandPanel (arm/disarm/mode/waypoint)
│       └── PIDTuning (optional)
├── BottomPanel
│   ├── MeshTopology (D3.js or SVG force graph)
│   ├── FleetStatus (compact cards for all vehicles)
│   └── SimulationControls (failure/restore/election buttons)
└── EventLog (scrollable, filterable)
```

### 6.4 State Management

- Single WebSocket connection via custom `useWebSocket` hook.
- All state comes from the backend (single source of truth).
- Local UI state only for selection, panel visibility, map view.
- No Redux needed — `useState` + `useContext` is sufficient given the single data source.

---

## 7. Simulation Setup

### 7.1 ArduPilot SITL

Each boat runs as an independent ArduPilot SITL process in WSL2/Linux:

```bash
# Boat 0 — Port 14550
sim_vehicle.py -v Rover --frame=motorboat -I0 --out=udp:127.0.0.1:14550 -l "-33.8568,151.2153,0,0"

# Boat 1 — Port 14560 (500m NE)
sim_vehicle.py -v Rover --frame=motorboat -I1 --out=udp:127.0.0.1:14560 -l "-33.8540,151.2200,0,0"

# Boat 2 — Port 14570 (500m SW)
sim_vehicle.py -v Rover --frame=motorboat -I2 --out=udp:127.0.0.1:14570 -l "-33.8590,151.2100,0,0"
```

Default location: Sydney Harbour, Australia. Boats are spaced ~500m apart to demonstrate both direct links and degraded signals.

### 7.2 FRAME_CLASS Configuration

SITL boats must have FRAME_CLASS=2 (Boat) set in ArduPilot parameters. The `--frame=motorboat` argument handles this automatically. Boats use differential thrust steering (two motors).

---

## 8. API Reference

### 8.1 WebSocket: `ws://localhost:8000/ws`

**Server → Client (5 Hz):**

```json
{
  "timestamp": 1711382400.123,
  "vehicles": [
    {
      "id": 0,
      "name": "USV-00",
      "connected": true,
      "is_alive": true,
      "position": {"lat": -33.8568, "lon": 151.2153, "alt": 0.0, "fix_type": 3, "satellites": 12},
      "heading": 45.2,
      "groundspeed": 2.5,
      "attitude": {"roll": 1.2, "pitch": -0.5, "yaw": 45.2},
      "armed": true,
      "mode": "AUTO",
      "battery": {"voltage": 12.4, "remaining": 85},
      "mesh": {"is_leader": true, "peers": [1, 2], "signal_strength": {"1": 92.3, "2": 45.7}}
    }
  ],
  "mesh": {
    "nodes": {"0": {"node_id": 0, "name": "NODE-00", "state": "active", "is_leader": true, ...}},
    "edges": [
      {"from": 0, "to": 1, "distance": 523.4, "signal": 78.2, "state": "strong"},
      {"from": 1, "to": 2, "distance": 1245.1, "signal": 42.1, "state": "degraded"}
    ],
    "routing_table": {"0->2": 1},
    "leader": {"current_leader": 0, "election_in_progress": false, "log": [...]},
    "stats": {"messages_sent": 156, "messages_relayed": 23, "messages_dropped": 2, "elections_held": 1},
    "log": [{"time": 1711382400.0, "message": "Node NODE-00 joined mesh network"}]
  }
}
```

**Client → Server (Commands):**

```json
// Arm
{"type": "arm", "vehicle_id": 0}

// Disarm
{"type": "disarm", "vehicle_id": 0}

// Set mode
{"type": "set_mode", "vehicle_id": 0, "mode": "GUIDED"}

// Send waypoint (GUIDED mode)
{"type": "waypoint", "vehicle_id": 0, "lat": -33.855, "lon": 151.218}

// Upload mission
{"type": "upload_mission", "vehicle_id": 0, "waypoints": [
  {"lat": -33.856, "lon": 151.215, "alt": 0},
  {"lat": -33.854, "lon": 151.220, "alt": 0},
  {"lat": -33.858, "lon": 151.218, "alt": 0}
]}

// Simulate failure
{"type": "simulate_failure", "vehicle_id": 2}

// Restore vessel
{"type": "simulate_restore", "vehicle_id": 2}

// Force election
{"type": "force_election"}
```

### 8.2 REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Returns `{"status": "ok", "clients": N}` |
| GET | /state | Returns current full fleet state (same as WebSocket payload) |

---

## 9. File Structure

```
usv-fleet-command/
│
├── backend/
│   ├── main.py                         # Entry point — starts fleet + web server
│   ├── requirements.txt                # Python dependencies
│   │
│   ├── core/
│   │   ├── __init__.py
│   │   ├── vehicle.py                  # Vehicle state dataclass
│   │   └── mavlink_manager.py          # Multi-SITL MAVLink connections
│   │
│   ├── mesh/
│   │   ├── __init__.py
│   │   ├── peer.py                     # Mesh node model
│   │   ├── mesh_network.py             # Topology, routing, signal simulation
│   │   └── leader_election.py          # Bully algorithm
│   │
│   ├── fleet/
│   │   ├── __init__.py
│   │   ├── fleet_manager.py            # Central orchestrator
│   │   └── mission_engine.py           # Swarm patterns & mission generation
│   │
│   └── api/
│       ├── __init__.py
│       └── websocket_server.py         # FastAPI WebSocket + REST
│
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   │
│   └── src/
│       ├── main.jsx                    # React entry point
│       ├── App.jsx                     # Main layout
│       │
│       ├── components/
│       │   ├── MapView.jsx             # Leaflet maritime map
│       │   ├── BoatMarker.jsx          # Directional boat icon
│       │   ├── MeshLink.jsx            # Signal link line on map
│       │   ├── TelemetryPanel.jsx      # Per-vehicle data display
│       │   ├── CommandPanel.jsx        # Arm/disarm/mode controls
│       │   ├── MeshTopology.jsx        # Network graph visualization
│       │   ├── FleetStatus.jsx         # Fleet health cards
│       │   ├── MissionPlanner.jsx      # Waypoint planning UI
│       │   ├── SimulationControls.jsx  # Demo failure/restore buttons
│       │   ├── PIDTuning.jsx           # Parameter tuning panel
│       │   ├── EventLog.jsx            # Scrollable event log
│       │   └── Header.jsx              # Top bar with fleet summary
│       │
│       ├── hooks/
│       │   └── useWebSocket.js         # WebSocket connection hook
│       │
│       ├── utils/
│       │   ├── constants.js            # Colors, config values
│       │   └── formatters.js           # Unit conversions, time formatting
│       │
│       └── styles/
│           └── globals.css             # Dark theme, base styles
│
├── scripts/
│   └── launch_sitl.sh                  # Launch 3 SITL boats (WSL2)
│
└── docs/
    ├── TECHNICAL_SPECIFICATION.md      # This document
    └── ARCHITECTURE.md                 # Architecture diagrams
```

---

## 10. Development Priorities

### Phase 1: Foundation (Week 1)
- ArduPilot SITL setup (3 boats)
- MAVLink Manager: connect, receive telemetry, send commands
- Basic React app with Leaflet map showing boat positions
- WebSocket bridge (backend → frontend)

### Phase 2: Mesh & Election (Week 2)
- Mesh network: topology, signal simulation, peer discovery
- Leader election: Bully algorithm, auto re-election on failure
- Multi-hop message routing with BFS
- Mesh topology visualization in frontend
- Simulation controls (failure, restore, force election)

### Phase 3: Fleet Management (Week 3)
- Telemetry panels with all MAVLink data
- Command interface (arm, disarm, mode, waypoint)
- Mission planner with map-based waypoint creation
- Fleet health dashboard with status cards
- Event log with filtering

### Phase 4: Advanced Features (Week 4)
- Swarm patterns (line, grid, perimeter, follow-leader)
- PID tuning interface
- GNSS-denied visualization
- Demo scenario automation
- Mission replay
- Polish UI, record demo video

---

## 11. Acceptance Criteria

The project is considered complete when:

1. Three ArduPilot SITL boats are visible on the map with real-time position and heading updates.
2. Telemetry panels show accurate data from all boats at 5 Hz refresh.
3. Mesh network links are visible on the map with signal strength indicators.
4. Simulating a leader vessel failure triggers an automatic re-election visible in the UI within 5 seconds.
5. Multi-hop routing is demonstrated: Boat A sends to Boat C via Boat B relay.
6. Waypoint missions can be uploaded and executed from the dashboard.
7. At least one swarm pattern (grid survey or perimeter patrol) works for 3 boats.
8. Fleet-wide commands (arm all, disarm all) work correctly.
9. The demo scenario runs smoothly end-to-end.
10. All code is clean, commented, and follows the module structure defined in this spec.

---

## 12. Notes for Development Team

- **No Gazebo or ROS2 required.** The demo runs SITL + pymavlink + React. Keep it lightweight.
- **All libraries are free and open-source.** No licensing concerns.
- **The mesh layer is the most important feature.** This is what differentiates this project. Invest the most time here.
- **Dark theme with maritime/defence aesthetic.** Think military radar console, not consumer dashboard.
- **The demo should tell a story.** Leader goes down → election happens → fleet recovers → new leader takes over. This narrative is what will impress the client.
- **Test with 3 boats minimum, but the architecture should scale to 10+.** Don't hardcode boat count.
- **Sydney Harbour as default location.** The client is Australian.
- **Record a 2-3 minute demo video** showing the key features when complete.

---

*End of Technical Specification*

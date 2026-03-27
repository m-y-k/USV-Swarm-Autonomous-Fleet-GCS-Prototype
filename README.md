# USV Fleet Command — Multi-Vessel Autonomous GCS

A web-based Ground Control Station for managing fleets of autonomous USVs (Unmanned Surface Vessels) with mesh networking, leader election, and swarm mission capabilities.

Built on ArduPilot (Rover/Boat mode) + MAVLink + Python + React.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Dashboard                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ Map View │ │Telemetry │ │  Mesh    │ │  Mission   │ │
│  │(Leaflet) │ │ Panels   │ │ Network  │ │  Planner   │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket
┌──────────────────────┴──────────────────────────────────┐
│                  Python Backend (FastAPI)                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ MAVLink  │ │  Mesh    │ │  Leader  │ │  Mission   │ │
│  │ Manager  │ │ Network  │ │ Election │ │  Engine    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
└──────┬───────────┬───────────┬──────────────────────────┘
       │ MAVLink   │ MAVLink   │ MAVLink
┌──────┴──┐ ┌──────┴──┐ ┌─────┴───┐
│ SITL #1 │ │ SITL #2 │ │ SITL #3 │  (ArduPilot Rover/Boat)
│ Boat 1  │ │ Boat 2  │ │ Boat 3  │
└─────────┘ └─────────┘ └─────────┘
```

## Features

### Tier 1 — Core
- [x] Multi-USV GCS Dashboard with maritime map
- [x] Real-time telemetry (position, heading, speed, mode)
- [x] ArduPilot MAVLink integration
- [x] Mesh networking with peer-to-peer comms
- [x] Leader election (Bully algorithm)

### Tier 2 — Fleet Management
- [ ] Waypoint mission upload
- [ ] Fleet health monitoring
- [ ] Autonomous route planning

### Tier 3 — Advanced
- [ ] Swarm patrol patterns (line, grid, perimeter)
- [ ] GNSS-denied fallback visualization
- [ ] PID tuning interface
- [ ] Mission logging & replay

## Prerequisites

- Windows 10/11 with WSL2 (Ubuntu 22.04)
- Python 3.10+
- Node.js 18+
- Git

## Quick Start

### 1. Install ArduPilot SITL (in WSL2)

```bash
# Open WSL2 terminal
sudo apt update && sudo apt upgrade -y

# Install ArduPilot dependencies
sudo apt install git python3 python3-pip python3-dev python3-venv -y
sudo apt install build-essential ccache g++ gawk gcc-arm-none-eabi -y

# Clone ArduPilot
cd ~
git clone --recurse-submodules https://github.com/ArduPilot/ardupilot.git
cd ardupilot

# Install dependencies
Tools/environment_install/install-prereqs-ubuntu.sh -y
. ~/.profile

# Build Rover (used for boats)
./waf configure --board sitl
./waf rover
```

### 2. Launch 3 SITL Boat Instances

```bash
# Terminal 1 — Boat 1 (port 5760)
cd ~/ardupilot
sim_vehicle.py -v Rover --frame=motorboat -I0 --out=udp:127.0.0.1:14550

# Terminal 2 — Boat 2 (port 5770)
sim_vehicle.py -v Rover --frame=motorboat -I1 --out=udp:127.0.0.1:14560

# Terminal 3 — Boat 3 (port 5780)
sim_vehicle.py -v Rover --frame=motorboat -I2 --out=udp:127.0.0.1:14570
```

### 3. Start Python Backend

```bash
cd usv-fleet-command/backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python main.py
```

### 4. Start React Frontend

```bash
cd usv-fleet-command/frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Tech Stack

| Layer | Technology | License | Cost |
|-------|-----------|---------|------|
| Autopilot | ArduPilot (Rover/Boat) | GPLv3 | Free |
| Protocol | MAVLink | MIT | Free |
| Python MAVLink | pymavlink | LGPLv3 | Free |
| Backend | FastAPI + asyncio | MIT | Free |
| Frontend | React + Vite | MIT | Free |
| Maps | Leaflet + OpenStreetMap | BSD/ODbL | Free |
| WebSocket | websockets (Python) | BSD | Free |

**Total licensing cost: $0**

## Project Structure

```
usv-fleet-command/
├── backend/
│   ├── main.py              # Entry point
│   ├── requirements.txt
│   ├── core/
│   │   ├── mavlink_manager.py    # Connects to SITL instances
│   │   └── vehicle.py            # Vehicle state model
│   ├── mesh/
│   │   ├── mesh_network.py       # Mesh topology + message routing
│   │   ├── peer.py               # Peer node representation
│   │   └── leader_election.py    # Bully algorithm
│   ├── fleet/
│   │   ├── fleet_manager.py      # Fleet coordination
│   │   └── mission_engine.py     # Mission upload + execution
│   └── api/
│       └── websocket_server.py   # WebSocket API for frontend
├── frontend/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── MapView.jsx       # Leaflet maritime map
│   │   │   ├── TelemetryPanel.jsx
│   │   │   ├── MeshTopology.jsx  # Network graph visualization
│   │   │   ├── FleetStatus.jsx
│   │   │   └── MissionPlanner.jsx
│   │   ├── hooks/
│   │   │   └── useWebSocket.js
│   │   └── utils/
│   │       └── constants.js
├── scripts/
│   └── launch_sitl.sh        # Launch all 3 SITL boats
└── docs/
    └── ARCHITECTURE.md
```

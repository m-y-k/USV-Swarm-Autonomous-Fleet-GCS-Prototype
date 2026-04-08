# USV Fleet Command — Feature Test Plan

## Setup

1. **Start SITL** (in WSL2): `bash scripts/launch_sitl.sh`
2. **Start backend**: `cd backend && python main.py`
3. **Start frontend**: `cd frontend && npm run dev` then open `http://localhost:5173`

---

## 1. Real-Time Telemetry Display

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 1.1 | Connection indicator | Look at top-right header | Green dot when WS connected, red when backend is down |
| 1.2 | Vehicle positions on map | Wait for SITL GPS fix | Green boat arrows appear on Sydney Harbour |
| 1.3 | Compass & heading | Select a vehicle, open Telemetry tab | Compass rotates with vehicle heading |
| 1.4 | Speed display | Check Telemetry panel | Shows speed in m/s and knots |
| 1.5 | Battery display | Check Telemetry panel | Bar + voltage; color-coded green/amber/red |
| 1.6 | GPS info | Check Position section | Fix type icon (2D/3D), satellite count |
| 1.7 | Attitude | Check Attitude section | Roll, pitch, yaw in degrees |
| 1.8 | Mesh peers & signal | Check Mesh section at bottom of Telemetry tab | Shows connected peers and signal % |

---

## 2. Vehicle Selection

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 2.1 | Click marker on map | Click a boat marker | Side panel shows that vehicle's telemetry |
| 2.2 | Click fleet card | Bottom-right Fleet Status panel, click any vessel card | Selects that vehicle |
| 2.3 | Auto-select | Refresh the page with backend running | First connected vehicle is auto-selected |

---

## 3. Arm / Disarm

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 3.1 | Arm single | Telemetry tab > Command section > click "Arm" | Vehicle arms; button turns green, text changes to "Disarm" |
| 3.2 | Disarm single | Click "Disarm" | Vehicle disarms; button reverts |
| 3.3 | Arm All | Command section > "Arm All" | All connected vehicles arm |
| 3.4 | Disarm All | Command section > "Disarm All" | All vehicles disarm |
| 3.5 | Quick-action arm | Fleet Status card > click lock icon | That specific vehicle toggles arm state |

---

## 4. Flight Mode Changes

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 4.1 | Mode dropdown | Command section > mode select > pick GUIDED | Mode badge updates to GUIDED |
| 4.2 | All AUTO | Click "All > AUTO" | All vehicles switch to AUTO |
| 4.3 | All HOLD | Click "All > HOLD" | All vehicles hold position |
| 4.4 | Fleet card mode | Fleet Status card > per-card mode dropdown > select AUTO | That vehicle switches to AUTO |
| 4.5 | RTL button | Click "RTL" button | Selected vehicle mode changes to RTL |

---

## 5. GUIDED Waypoint

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 5.1 | Map click navigation | Set vehicle to GUIDED mode > click anywhere on map (while on Telemetry tab, not Mission) | Vehicle navigates toward clicked point |

---

## 6. Mission Planning & Upload

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 6.1 | Add waypoints | Side panel > Mission tab > click on map | Numbered amber waypoint markers appear |
| 6.2 | Drag waypoints | Drag a waypoint marker | Waypoint repositions on map and in list |
| 6.3 | Remove waypoint | Right-click a waypoint marker | Waypoint removed from map and list |
| 6.4 | Edit waypoint params | Click waypoint number in list | Adjust hold time and acceptance radius |
| 6.5 | Upload to one | Click "Upload Mission" | Uploads waypoints to selected vehicle |
| 6.6 | Upload to fleet | Click "Upload to Fleet" | Uploads waypoints to all vehicles |
| 6.7 | Start Mission | Click "Start Mission" | Vehicle set to AUTO mode; follows waypoints |
| 6.8 | Clear waypoints | Click "Clear" button | All waypoints removed from list and map |

---

## 7. Swarm Pattern Generation

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 7.1 | Line formation | Mission tab > Swarm Patterns > select "Line" > set spacing > "Preview" | Parallel track waypoints shown on map |
| 7.2 | Grid survey | Select "Grid" > set rows/cols/spacing > "Preview" | Lawn-mower pattern waypoints on map |
| 7.3 | Perimeter patrol | Select "Perimeter" > set radius > "Preview" | Waypoints around a circle perimeter |
| 7.4 | Follow-the-leader | Select "Follow" > choose sub-formation > "Preview" | Relative waypoints in formation |
| 7.5 | Generate & Upload | After preview, click "Generate & Upload" | Waypoints sent to all vehicles |

---

## 8. Mesh Network Topology

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 8.1 | Topology view | Look at bottom-left panel | SVG circle layout with nodes and connection lines |
| 8.2 | Signal strength lines | Observe line colors | Green >70%, amber 30-70%, red <30% |
| 8.3 | Map mesh links | Look at main map between boats | Colored polylines showing mesh links |
| 8.4 | Node states | Check node colors in topology | Blue = leader, green = active, amber = degraded, gray = offline |
| 8.5 | Stats bar | Check below topology view | Messages sent/relayed/dropped, elections held |

---

## 9. Leader Election

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 9.1 | Initial leader | Start system, wait for election | Highest-ID node becomes leader (crown icon on map + header) |
| 9.2 | Force Election | Simulation Controls > "Election" button | Re-election triggers; Event Log shows ELECTION/VICTORY messages |
| 9.3 | Fail Leader triggers election | "Fail Leader" > wait 3s | Leader goes offline, automatic re-election, new leader emerges |
| 9.4 | Event Log tracking | Filter Event Log to "Election" | Full election sequence visible |

---

## 10. Failure Simulation & Restore

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 10.1 | Fail Leader | Simulation Controls > "Fail Leader" | Leader goes offline (marker red, card shows "Offline") |
| 10.2 | Fail specific vessel | Fleet Status card > click lightning bolt icon | That vessel goes offline |
| 10.3 | Restore all | Simulation Controls > "Restore" | All offline vessels restored |
| 10.4 | Restore individual | Fleet Status card > click refresh icon on failed vessel | That vessel restored |
| 10.5 | Mesh recalculation | After failure, check topology | Edges to failed node disappear |

---

## 11. GNSS-Denied Mode (GPS Loss)

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 11.1 | Simulate GPS Loss | Simulation Controls > "GPS Loss" | Leader vessel enters dead-reckoning mode |
| 11.2 | Uncertainty circle | Watch map around DR vessel | Red dashed circle appears, grows over time (~10m/s) |
| 11.3 | DR marker appearance | Check boat marker | Dashed outline + "DR" label on marker |
| 11.4 | DR badge | Check side panel header | "DR" badge appears next to vessel name |
| 11.5 | Restore GPS | Click "GPS Fix" button | Uncertainty circle clears, normal GPS resumes |

---

## 12. Mesh Range Slider

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 12.1 | Adjust range | Simulation Controls > drag "Range" slider (500m-5000m) | Range label updates |
| 12.2 | Short range effect | Set range to 500m | Distant boats lose connectivity; mesh links disappear |
| 12.3 | Long range effect | Set range to 5000m | All boats connect with stronger signals |
| 12.4 | Map link updates | Watch mesh link lines on map while adjusting | Lines change color/appear/disappear with range |

---

## 13. PID Tuning

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 13.1 | Conservative preset | PID tab > click "Conservative" | All sliders jump to conservative values |
| 13.2 | Balanced preset | Click "Balanced" | All sliders jump to balanced values |
| 13.3 | Aggressive preset | Click "Aggressive" | All sliders jump to aggressive values |
| 13.4 | Adjust slider | Drag any slider | Value updates in real-time next to label |
| 13.5 | Write one param | Click pencil icon next to a slider | PARAM_SET sent to selected vehicle; event logged |
| 13.6 | Write all params | Click "Write All Parameters" | All 10 params sent in sequence; events logged |

---

## 14. Event Log

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 14.1 | View events | Look at bottom panel Event Log | Events stream in real-time |
| 14.2 | Filter by category | Use dropdown: System / Mesh / Election / Mission / Command / Errors | Only matching events shown |
| 14.3 | Search | Type text in search box | Filters events by message content |
| 14.4 | Auto-scroll | Observe as new events arrive | Log scrolls to bottom automatically |
| 14.5 | Pause auto-scroll | Manually scroll up in the log | Auto-scroll pauses; new events don't force scroll |
| 14.6 | Export JSON | Click "JSON" button | Downloads `usv-event-log.json` |
| 14.7 | Export CSV | Click "CSV" button | Downloads `usv-event-log.csv` |

---

## 15. Mission Replay

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 15.1 | Enter replay | Bottom panel > "Replay" button | Enters replay mode; panel highlights |
| 15.2 | Scrub timeline | Drag slider left/right | Map and telemetry jump to that recorded frame |
| 15.3 | Play/Pause | Click play button | Animates through recorded frames |
| 15.4 | Speed control | Select 0.5x / 1x / 2x / 5x / 10x | Playback speed changes accordingly |
| 15.5 | Event markers | Look at colored dots on timeline | Marks where events occurred during recording |
| 15.6 | Return to live | Click "Live" button | Exits replay, returns to real-time data |

> **Note:** Recording starts on page load; accumulates up to 1500 frames (~5 min at 5 Hz).

---

## 16. Fleet Status Panel

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 16.1 | Summary bar | Look at top of Fleet Status panel | Shows total / online / degraded / offline counts |
| 16.2 | Sort by Name | Sort dropdown > "Name" | Cards sorted alphabetically by vessel name |
| 16.3 | Sort by Status | Sort dropdown > "Status" | Offline first, then degraded, then online |
| 16.4 | Sort by Battery | Sort dropdown > "Battery" | Lowest battery first |
| 16.5 | Sort by Signal | Sort dropdown > "Signal" | Weakest signal first |
| 16.6 | Alert icons | Trigger low battery or offline state | Warning icon appears on affected cards |
| 16.7 | Quick actions | Hover/select a card | Arm/Disarm, Mode select, Fail, Restore buttons appear |

---

## 17. Demo Sequence (Automated 50s)

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 17.1 | Start demo | Click "Demo" button | Event Log shows "Demo sequence started" |
| 17.2 | T+5s: Missions upload | Watch Event Log | "Uploading patrol missions" + "AUTO" mode set |
| 17.3 | T+15s: Leader failure | Watch map and topology | Leader goes offline, marker turns red |
| 17.4 | T+18s: Election | Watch Event Log (Election filter) | ELECTION and VICTORY messages appear |
| 17.5 | T+25s: Fleet continues | Watch map | Remaining boats continue patrol |
| 17.6 | T+35s: Restore | Watch map and topology | Failed vessel comes back online |
| 17.7 | T+50s: Complete | Watch Event Log | "Demo sequence completed" message |

---

## 18. REST Endpoints

| # | Test | Steps | Expected Result |
|---|------|-------|-----------------|
| 18.1 | Health check | Browser > `http://localhost:8000/health` | `{"status":"ok","clients":N}` |
| 18.2 | Full state | Browser > `http://localhost:8000/state` | JSON with vehicles, mesh, gnss_denied, events |
| 18.3 | Events | Browser > `http://localhost:8000/events` | `{"events":[...]}` array |

---

## Bugs Fixed

| # | File | Bug | Impact |
|---|------|-----|--------|
| 1 | `BoatMarker.jsx` | `useEffect`/`useMemo` after conditional return (Rules of Hooks) | Markers failed to render — no boats on map |
| 2 | `mavlink_manager.py` | `mode_mapping()` returns None for SURFACE_BOAT causing `TypeError` | Every mode-change command crashed the WebSocket |
| 3 | `mavlink_manager.py` | `set_mode` used deprecated `SET_MODE` message | Unreliable mode changes on newer ArduPilot |
| 4 | `App.jsx` | `setSelectedVehicleId` called during render body | Extra re-renders, potential state issues |
| 5 | `MapView.jsx` | `MapController` dependency `[vehicles.length]` never refired on position update | Map never auto-fit to actual boat GPS positions |
| 6 | `mavlink_manager.py` | Missing `set_param()` method | PID Write buttons crashed WebSocket with `AttributeError` |
| 7 | `fleet_manager.py` | `set_mesh_range` checked non-existent `self.mesh.max_range` | Mesh range slider had zero effect |
| 8 | `websocket_server.py` | No try/except inside `handle_command` | Any single bad command disconnected the WebSocket client |

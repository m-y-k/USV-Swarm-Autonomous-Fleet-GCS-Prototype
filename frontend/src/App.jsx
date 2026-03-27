/**
 * USV Fleet Command — Main Application Layout
 * 
 * Layout structure (from TECHNICAL_SPECIFICATION.md §6.1):
 * ┌──────────────────────────────────────────────────────┐
 * │  Header (fleet summary, connection status)           │
 * ├────────────────────────────┬─────────────────────────┤
 * │                            │  Side Panel             │
 * │    Map View (70%)          │  - Telemetry            │
 * │                            │  - Commands             │
 * │                            │  - Mission Planner      │
 * │                            │  - PID Tuning           │
 * ├────────────────────────────┼─────────────────────────┤
 * │  Mesh Topology / Controls  │  Fleet Status Cards     │
 * ├────────────────────────────┴─────────────────────────┤
 * │  Event Log + Mission Replay                          │
 * └──────────────────────────────────────────────────────┘
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Header from './components/Header';
import MapView from './components/MapView';
import TelemetryPanel from './components/TelemetryPanel';
import CommandPanel from './components/CommandPanel';
import MissionPlanner from './components/MissionPlanner';
import PIDTuning from './components/PIDTuning';
import FleetStatus from './components/FleetStatus';
import MeshTopology from './components/MeshTopology';
import SimulationControls from './components/SimulationControls';
import EventLog from './components/EventLog';
import MissionReplay from './components/MissionReplay';

export default function App() {
  const { fleetState, connected, sendCommand } = useWebSocket();
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [sideTab, setSideTab] = useState('telemetry');
  const [waypoints, setWaypoints] = useState([]);
  const [missionPlannerActive, setMissionPlannerActive] = useState(false);

  // History buffer for mission replay
  const historyBuffer = useRef([]);
  const [replayState, setReplayState] = useState(null);
  const maxHistoryFrames = 1500; // ~5 minutes at 5 Hz

  // Get current state (replay or live)
  const activeState = replayState || fleetState;
  const vehicles = activeState?.vehicles || [];
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId) || null;
  const meshState = activeState?.mesh || null;
  const meshEdges = meshState?.edges || [];
  const gnssDeniedVehicles = activeState?.gnss_denied || {};
  const events = activeState?.events || [];

  // Auto-select first vehicle if none selected
  if (selectedVehicleId === null && vehicles.length > 0) {
    setSelectedVehicleId(vehicles[0].id);
  }

  // Record state history for replay
  useEffect(() => {
    if (fleetState && !replayState) {
      const frame = {
        ...fleetState,
        events: fleetState.events?.slice(-5) || [], // Only recent events per frame
      };
      historyBuffer.current.push(frame);
      if (historyBuffer.current.length > maxHistoryFrames) {
        historyBuffer.current = historyBuffer.current.slice(-maxHistoryFrames);
      }
    }
  }, [fleetState?.timestamp]);

  // Handle map click
  const handleMapClick = useCallback((latlng) => {
    if (missionPlannerActive) {
      setWaypoints(prev => [...prev, { lat: latlng.lat, lon: latlng.lng, alt: 0, holdTime: 0, radius: 5 }]);
    } else if (selectedVehicle && selectedVehicle.mode === 'GUIDED') {
      sendCommand({
        type: 'waypoint',
        vehicle_id: selectedVehicle.id,
        lat: latlng.lat,
        lon: latlng.lng,
      });
    }
  }, [selectedVehicle, sendCommand, missionPlannerActive]);

  // Replay seek handler
  const handleReplaySeek = useCallback((frame) => {
    setReplayState(frame); // null = return to live
  }, []);

  // Demo scenario (spec §4.9) — now delegated to backend
  const runDemo = useCallback(() => {
    sendCommand({ type: 'run_demo' });
  }, [sendCommand]);

  return (
    <div className="app-container">
      {/* ── Header ──────────────────────────────────────── */}
      <Header connected={connected} fleetState={activeState} />

      {/* ── Main Content ────────────────────────────────── */}
      <div className="main-content">
        {/* Left: Map Area */}
        <div className="map-area">
          <div className="panel map-panel">
            <MapView
              vehicles={vehicles}
              meshEdges={meshEdges}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              onMapClick={handleMapClick}
              waypoints={waypoints}
              currentWaypointIndex={-1}
              onRemoveWaypoint={(i) => setWaypoints(prev => prev.filter((_, idx) => idx !== i))}
              onDragWaypoint={(i, lat, lon) => setWaypoints(prev => prev.map((wp, idx) => idx === i ? { ...wp, lat, lon } : wp))}
              onUpdateWaypointParams={(i, holdTime, radius) => setWaypoints(prev => prev.map((wp, idx) => idx === i ? { ...wp, holdTime, radius } : wp))}
              gnssDeniedVehicles={gnssDeniedVehicles}
            />
          </div>
        </div>

        {/* Right: Side Panel */}
        <div className="side-panel-area">
          <div className="panel side-panel">
            <div className="panel-header">
              <h3>{selectedVehicle ? selectedVehicle.name : 'Select a Vessel'}</h3>
              {selectedVehicle && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  {selectedVehicle.mesh?.is_leader && (
                    <span className="badge badge-leader">👑 LEADER</span>
                  )}
                  {gnssDeniedVehicles[selectedVehicle.id]?.active && (
                    <span className="badge badge-dr">📡 DR</span>
                  )}
                  <span className={`badge ${selectedVehicle.armed ? 'badge-armed' : 'badge-disarmed'}`}>
                    {selectedVehicle.armed ? 'ARMED' : 'DISARMED'}
                  </span>
                </div>
              )}
            </div>

            {/* Side panel tabs */}
            <div className="side-tabs">
              <button className={`side-tab ${sideTab === 'telemetry' ? 'active' : ''}`} onClick={() => { setSideTab('telemetry'); setMissionPlannerActive(false); }}>📡 Telemetry</button>
              <button className={`side-tab ${sideTab === 'mission' ? 'active' : ''}`} onClick={() => { setSideTab('mission'); setMissionPlannerActive(true); }}>🎯 Mission</button>
              <button className={`side-tab ${sideTab === 'pid' ? 'active' : ''}`} onClick={() => { setSideTab('pid'); setMissionPlannerActive(false); }}>⚙ PID</button>
            </div>

            <div className="panel-body" style={{ padding: 0 }}>
              {selectedVehicle ? (
                <>
                  {sideTab === 'telemetry' && (
                    <>
                      <TelemetryPanel vehicle={selectedVehicle} />
                      <CommandPanel
                        vehicle={selectedVehicle}
                        sendCommand={sendCommand}
                        allVehicles={vehicles}
                      />
                    </>
                  )}
                  {sideTab === 'mission' && (
                    <MissionPlanner
                      vehicle={selectedVehicle}
                      vehicles={vehicles}
                      waypoints={waypoints}
                      setWaypoints={setWaypoints}
                      sendCommand={sendCommand}
                      currentWaypointIndex={-1}
                    />
                  )}
                  {sideTab === 'pid' && (
                    <PIDTuning
                      vehicle={selectedVehicle}
                      sendCommand={sendCommand}
                    />
                  )}
                </>
              ) : (
                <div className="placeholder-content" style={{ padding: '40px 0' }}>
                  <span className="placeholder-icon">📡</span>
                  <p className="placeholder-text">
                    {vehicles.length > 0 ? 'Click a vessel to view telemetry' : 'Waiting for vessel data...'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Panel ────────────────────────────────── */}
      <div className="bottom-content">
        <div className="panel bottom-left-panel">
          <div className="panel-header">
            <h3>Mesh Network</h3>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              <SimulationControls sendCommand={sendCommand} vehicles={vehicles} />
              <button className="btn btn-accent btn-sm" onClick={runDemo} title="Run automated demo scenario (50s)">
                🎬 Demo
              </button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <MeshTopology meshState={meshState} vehicles={vehicles} selectedVehicleId={selectedVehicleId} />
          </div>
        </div>

        <div className="panel bottom-right-panel">
          <div className="panel-header">
            <h3>Fleet Status</h3>
          </div>
          <div className="panel-body" style={{ padding: '4px' }}>
            <FleetStatus
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              sendCommand={sendCommand}
            />
          </div>
        </div>
      </div>

      {/* ── Event Log + Replay Strip ────────────────────── */}
      <div className="event-log-strip">
        <MissionReplay
          historyBuffer={historyBuffer.current}
          onSeek={handleReplaySeek}
          isRecording={connected}
        />
        <EventLog
          meshState={meshState}
          connected={connected}
          vehicleCount={vehicles.length}
          events={events}
        />
      </div>
    </div>
  );
}

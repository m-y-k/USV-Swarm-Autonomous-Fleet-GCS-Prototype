/**
 * SimulationControls — Demo failure/restore/election/GPS/mesh range buttons.
 * Spec §4.9: Simulate failure, restore, force election, GPS loss, mesh range.
 * Phase 8: Added GPS loss, mesh range slider.
 */
import React, { useState } from 'react';
import { MESH_DEFAULTS } from '../utils/constants';

export default function SimulationControls({ sendCommand, vehicles }) {
  const [meshRange, setMeshRange] = useState(MESH_DEFAULTS.maxRange);

  const handleMeshRangeChange = (e) => {
    const range = parseInt(e.target.value);
    setMeshRange(range);
    sendCommand({ type: 'set_mesh_range', range });
  };

  return (
    <div className="simulation-controls">
      <button
        className="btn btn-danger btn-sm"
        onClick={() => {
          const leader = vehicles.find(v => v.mesh?.is_leader);
          const target = leader || vehicles[0];
          if (target) sendCommand({ type: 'simulate_failure', vehicle_id: target.id });
        }}
        title="Simulate leader vessel failure"
      >
        ⚡ Fail Leader
      </button>
      <button
        className="btn btn-success btn-sm"
        onClick={() => {
          vehicles.forEach(v => {
            if (!v.is_alive) sendCommand({ type: 'simulate_restore', vehicle_id: v.id });
          });
        }}
        title="Restore offline vessels"
      >
        🔄 Restore
      </button>
      <button
        className="btn btn-sm"
        onClick={() => sendCommand({ type: 'force_election' })}
        title="Force a new leader election"
      >
        🗳️ Election
      </button>

      {/* GPS Loss simulation */}
      <div className="sim-gps-controls">
        <button
          className="btn btn-sm btn-danger"
          onClick={() => {
            const selected = vehicles.find(v => v.mesh?.is_leader) || vehicles[0];
            if (selected) sendCommand({ type: 'simulate_gps_loss', vehicle_id: selected.id });
          }}
          title="Simulate GPS Loss on leader"
        >
          📡✕ GPS Loss
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            vehicles.forEach(v => {
              sendCommand({ type: 'simulate_gps_restore', vehicle_id: v.id });
            });
          }}
          title="Restore GPS on all vessels"
        >
          📡✓ GPS Fix
        </button>
      </div>

      {/* Mesh range slider */}
      <div className="sim-mesh-range">
        <span className="telemetry-label" title="Max mesh communication range">Range: {meshRange}m</span>
        <input
          type="range"
          min={MESH_DEFAULTS.minRange}
          max={MESH_DEFAULTS.maxSlider}
          step={100}
          value={meshRange}
          onChange={handleMeshRangeChange}
          className="mesh-range-slider"
        />
      </div>
    </div>
  );
}

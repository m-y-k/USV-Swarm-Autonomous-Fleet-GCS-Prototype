/**
 * CommandPanel — Send commands to individual vehicles or fleet.
 * Spec §4.8: Arm, Disarm, Mode, Waypoint, RTL, Emergency Stop.
 */
import React from 'react';
import { FLIGHT_MODES } from '../utils/constants';

export default function CommandPanel({ vehicle, sendCommand, allVehicles }) {
  if (!vehicle) return null;

  const handleArm = () => sendCommand({ type: 'arm', vehicle_id: vehicle.id });
  const handleDisarm = () => sendCommand({ type: 'disarm', vehicle_id: vehicle.id });
  const handleModeChange = (e) => sendCommand({ type: 'set_mode', vehicle_id: vehicle.id, mode: e.target.value });
  const handleRTL = () => sendCommand({ type: 'set_mode', vehicle_id: vehicle.id, mode: 'RTL' });
  const handleEmergency = () => {
    sendCommand({ type: 'disarm', vehicle_id: vehicle.id });
    sendCommand({ type: 'set_mode', vehicle_id: vehicle.id, mode: 'HOLD' });
  };

  // Fleet-wide commands
  const handleArmAll = () => allVehicles.forEach(v => sendCommand({ type: 'arm', vehicle_id: v.id }));
  const handleDisarmAll = () => allVehicles.forEach(v => sendCommand({ type: 'disarm', vehicle_id: v.id }));
  const handleAllAuto = () => allVehicles.forEach(v => sendCommand({ type: 'set_mode', vehicle_id: v.id, mode: 'AUTO' }));
  const handleAllHold = () => allVehicles.forEach(v => sendCommand({ type: 'set_mode', vehicle_id: v.id, mode: 'HOLD' }));
  const handleEmergencyAll = () => {
    allVehicles.forEach(v => {
      sendCommand({ type: 'disarm', vehicle_id: v.id });
      sendCommand({ type: 'set_mode', vehicle_id: v.id, mode: 'HOLD' });
    });
  };

  return (
    <div className="command-panel">
      {/* Vehicle Commands */}
      <div className="command-section">
        <div className="command-section-title">Vehicle Control</div>

        <div className="command-row">
          <button
            className={`btn ${vehicle.armed ? 'btn-danger' : 'btn-success'} btn-sm`}
            onClick={vehicle.armed ? handleDisarm : handleArm}
          >
            {vehicle.armed ? '🔒 Disarm' : '🔓 Arm'}
          </button>

          <select
            className="mode-select"
            value={vehicle.mode}
            onChange={handleModeChange}
          >
            {FLIGHT_MODES.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
        </div>

        <div className="command-row">
          <button className="btn btn-sm" onClick={handleRTL}>
            🏠 RTL
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleEmergency}>
            🛑 Emergency Stop
          </button>
        </div>
      </div>

      {/* Fleet Commands */}
      <div className="command-section">
        <div className="command-section-title">Fleet Commands</div>

        <div className="command-row">
          <button className="btn btn-success btn-sm" onClick={handleArmAll}>Arm All</button>
          <button className="btn btn-sm" onClick={handleDisarmAll}>Disarm All</button>
        </div>

        <div className="command-row">
          <button className="btn btn-accent btn-sm" onClick={handleAllAuto}>All → AUTO</button>
          <button className="btn btn-sm" onClick={handleAllHold}>All → HOLD</button>
        </div>

        <div className="command-row">
          <button className="btn btn-danger btn-sm" onClick={handleEmergencyAll} style={{ width: '100%' }}>
            🛑 EMERGENCY STOP ALL
          </button>
        </div>
      </div>
    </div>
  );
}

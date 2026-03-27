/**
 * TelemetryPanel — Per-vehicle telemetry display.
 * Shows all critical data from ArduPilot via MAVLink (spec §4.2).
 */
import React from 'react';
import {
  formatCoord, formatHeading, formatSpeed, formatAlt,
  formatVoltage, getBatteryStatus, formatConnectionAge, formatSignal
} from '../utils/formatters';
import { GPS_FIX_TYPES } from '../utils/constants';

function TelemetryRow({ label, value, unit, className }) {
  return (
    <div className="telemetry-row">
      <span className="telemetry-label">{label}</span>
      <span className={`telemetry-value ${className || ''}`}>
        {value}
        {unit && <span className="telemetry-unit">{unit}</span>}
      </span>
    </div>
  );
}

function CompassWidget({ heading }) {
  const rotation = heading || 0;
  return (
    <div className="compass-widget">
      <svg viewBox="0 0 60 60" width="52" height="52">
        {/* Compass ring */}
        <circle cx="30" cy="30" r="27" fill="none" stroke="var(--border-primary)" strokeWidth="1.5" />
        <circle cx="30" cy="30" r="24" fill="var(--bg-tertiary)" fillOpacity="0.6" />

        {/* Cardinal markers */}
        <text x="30" y="10" textAnchor="middle" fill="var(--text-muted)" fontSize="6" fontFamily="var(--font-mono)">N</text>
        <text x="54" y="33" textAnchor="middle" fill="var(--text-dim)" fontSize="5" fontFamily="var(--font-mono)">E</text>
        <text x="30" y="56" textAnchor="middle" fill="var(--text-dim)" fontSize="5" fontFamily="var(--font-mono)">S</text>
        <text x="6" y="33" textAnchor="middle" fill="var(--text-dim)" fontSize="5" fontFamily="var(--font-mono)">W</text>

        {/* Tick marks */}
        {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
          <line
            key={deg}
            x1="30" y1="6"
            x2="30" y2={deg % 90 === 0 ? 9 : 8}
            stroke="var(--text-dim)"
            strokeWidth="1"
            transform={`rotate(${deg}, 30, 30)`}
          />
        ))}

        {/* Needle */}
        <g transform={`rotate(${rotation}, 30, 30)`}>
          <polygon points="30,8 27,30 30,28 33,30" fill="var(--accent)" opacity="0.9" />
          <polygon points="30,52 27,30 30,32 33,30" fill="var(--status-offline)" opacity="0.5" />
        </g>

        {/* Center dot */}
        <circle cx="30" cy="30" r="2" fill="var(--accent)" />
      </svg>
      <span className="compass-value">{formatHeading(heading)}</span>
    </div>
  );
}

function BatteryBar({ voltage, remaining }) {
  const bat = getBatteryStatus(remaining);
  const width = Math.min(100, Math.max(0, remaining || 0));
  const colorVar = remaining > 50 ? 'var(--battery-high)' : remaining > 20 ? 'var(--battery-mid)' : 'var(--battery-low)';

  return (
    <div className="battery-widget">
      <div className="battery-bar-track">
        <div
          className="battery-bar-fill"
          style={{
            width: `${width}%`,
            background: colorVar,
            boxShadow: `0 0 6px ${colorVar}40`,
          }}
        />
      </div>
      <div className="battery-values">
        <span className="telemetry-value" style={{ color: colorVar }}>{bat.text}</span>
        <span className="telemetry-unit">{formatVoltage(voltage)}</span>
      </div>
    </div>
  );
}

function GPSFixIcon({ fixType }) {
  const fix = GPS_FIX_TYPES[fixType] || GPS_FIX_TYPES[0];
  return (
    <span className="gps-fix-icon" style={{ color: fix.color }} title={fix.label}>
      {fix.icon} {fix.label}
    </span>
  );
}

export default function TelemetryPanel({ vehicle }) {
  if (!vehicle) return null;

  const pos = vehicle.position || {};
  const att = vehicle.attitude || {};
  const bat = vehicle.battery || {};
  const connectionAge = vehicle.is_alive ? 0 : (Date.now() / 1000 - (vehicle.last_heartbeat || 0));

  return (
    <div className="telemetry-panel">
      {/* Compass + Speed Summary */}
      <div className="telemetry-summary-row">
        <CompassWidget heading={vehicle.heading} />
        <div className="telemetry-speed-block">
          <div className="speed-large">
            <span className="telemetry-value large">{vehicle.groundspeed?.toFixed(1) || '0.0'}</span>
            <span className="telemetry-unit">m/s</span>
          </div>
          <div className="speed-knots">
            <span className="telemetry-value">{(vehicle.groundspeed * 1.94384).toFixed(1)}</span>
            <span className="telemetry-unit">kn</span>
          </div>
        </div>
      </div>

      {/* Battery Section */}
      <div className="telemetry-section">
        <div className="telemetry-section-title">Battery</div>
        <BatteryBar voltage={bat.voltage} remaining={bat.remaining} />
      </div>

      {/* Position Section */}
      <div className="telemetry-section">
        <div className="telemetry-section-title">Position</div>
        <TelemetryRow label="Latitude" value={formatCoord(pos.lat)} />
        <TelemetryRow label="Longitude" value={formatCoord(pos.lon)} />
        <TelemetryRow label="Altitude" value={formatAlt(pos.alt)} />
        <TelemetryRow label="GPS Fix" value={<GPSFixIcon fixType={pos.fix_type} />} />
        <TelemetryRow label="Satellites" value={pos.satellites || 0} />
      </div>

      {/* Attitude Section */}
      <div className="telemetry-section">
        <div className="telemetry-section-title">Attitude</div>
        <TelemetryRow label="Roll" value={att.roll?.toFixed(1) || '0.0'} unit="°" />
        <TelemetryRow label="Pitch" value={att.pitch?.toFixed(1) || '0.0'} unit="°" />
        <TelemetryRow label="Yaw" value={att.yaw?.toFixed(1) || '0.0'} unit="°" />
      </div>

      {/* Mesh Section */}
      <div className="telemetry-section">
        <div className="telemetry-section-title">Mesh Network</div>
        <TelemetryRow label="Peers" value={(vehicle.mesh?.peers || []).length} />
        {Object.entries(vehicle.mesh?.signal_strength || {}).map(([peerId, strength]) => (
          <TelemetryRow key={peerId} label={`Signal → ${peerId}`} value={formatSignal(strength)} />
        ))}
      </div>
    </div>
  );
}

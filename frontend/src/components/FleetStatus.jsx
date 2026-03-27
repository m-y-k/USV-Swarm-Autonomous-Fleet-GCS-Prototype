/**
 * FleetStatus — Compact cards for all vessels with summary bar.
 * Spec §4.5: Summary bar + per-vessel cards with quick actions, sorting, alerts.
 * Phase 8: Added summary bar, sorting, alerts, quick action buttons.
 */
import React, { useState } from 'react';
import { formatSpeed, formatSignal, getBatteryStatus } from '../utils/formatters';

function getVehicleStatus(v) {
  if (!v.connected || !v.is_alive) return 'offline';
  const signals = Object.values(v.mesh?.signal_strength || {});
  if (signals.length > 0) {
    const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
    if (avg < 30) return 'degraded';
  }
  return 'online';
}

function getAlerts(v) {
  const alerts = [];
  if (v.battery?.remaining != null && v.battery.remaining < 20) {
    alerts.push({ type: 'battery', label: 'Low Battery' });
  }
  if (v.position?.fix_type === 0) {
    alerts.push({ type: 'gps', label: 'No GPS Fix' });
  }
  if (!v.connected || !v.is_alive) {
    alerts.push({ type: 'offline', label: 'Offline' });
  }
  return alerts;
}

const SORT_OPTIONS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'battery', label: 'Battery' },
  { key: 'signal', label: 'Signal' },
];

const STATUS_ORDER = { offline: 0, degraded: 1, online: 2 };

export default function FleetStatus({ vehicles, selectedVehicleId, onSelectVehicle, sendCommand }) {
  const [sortBy, setSortBy] = useState('name');
  const [expandedCard, setExpandedCard] = useState(null);

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="placeholder-content compact" style={{ padding: 16 }}>
        <span className="placeholder-icon">🚢</span>
        <p className="placeholder-text">Waiting for fleet data...</p>
      </div>
    );
  }

  // Summary counts
  const statusCounts = { online: 0, degraded: 0, offline: 0 };
  vehicles.forEach(v => {
    const status = getVehicleStatus(v);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  // Sort vehicles
  const sorted = [...vehicles].sort((a, b) => {
    switch (sortBy) {
      case 'status': {
        const sa = STATUS_ORDER[getVehicleStatus(a)] || 0;
        const sb = STATUS_ORDER[getVehicleStatus(b)] || 0;
        return sa - sb;
      }
      case 'battery':
        return (a.battery?.remaining || 0) - (b.battery?.remaining || 0);
      case 'signal': {
        const sigA = Object.values(a.mesh?.signal_strength || {});
        const sigB = Object.values(b.mesh?.signal_strength || {});
        const avgA = sigA.length ? sigA.reduce((x, y) => x + y, 0) / sigA.length : 0;
        const avgB = sigB.length ? sigB.reduce((x, y) => x + y, 0) / sigB.length : 0;
        return avgA - avgB;
      }
      default:
        return a.id - b.id;
    }
  });

  return (
    <div className="fleet-status">
      {/* Summary bar */}
      <div className="fleet-summary-bar">
        <span className="fleet-summary-item">
          <span className="fleet-summary-count">{vehicles.length}</span>
          <span className="fleet-summary-label">Total</span>
        </span>
        <span className="fleet-summary-item online">
          <span className="fleet-summary-count">{statusCounts.online}</span>
          <span className="fleet-summary-label">Online</span>
        </span>
        <span className="fleet-summary-item degraded">
          <span className="fleet-summary-count">{statusCounts.degraded}</span>
          <span className="fleet-summary-label">Degraded</span>
        </span>
        <span className="fleet-summary-item offline">
          <span className="fleet-summary-count">{statusCounts.offline}</span>
          <span className="fleet-summary-label">Offline</span>
        </span>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="fleet-sort-select"
          title="Sort by"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.key} value={o.key}>↕ {o.label}</option>
          ))}
        </select>
      </div>

      {/* Vehicle cards */}
      {sorted.map(v => {
        const status = getVehicleStatus(v);
        const bat = getBatteryStatus(v.battery?.remaining);
        const isSelected = selectedVehicleId === v.id;
        const alerts = getAlerts(v);
        const isExpanded = expandedCard === v.id;
        const signals = Object.values(v.mesh?.signal_strength || {});
        const avgSignal = signals.length ? (signals.reduce((a, b) => a + b, 0) / signals.length).toFixed(0) : '—';

        return (
          <div
            key={v.id}
            className={`fleet-card ${isSelected ? 'selected' : ''} ${status} ${alerts.length > 0 ? 'has-alert' : ''}`}
            onClick={() => onSelectVehicle(v.id)}
          >
            <div className="fleet-card-top">
              <span className={`status-dot ${status}`} />
              <span className="fleet-card-name">{v.name}</span>
              {v.mesh?.is_leader && <span className="fleet-card-leader">👑</span>}
              <span className="badge badge-mode">{v.mode}</span>
              {alerts.length > 0 && (
                <span className="fleet-card-alert-icon" title={alerts.map(a => a.label).join(', ')}>⚠</span>
              )}
            </div>
            <div className="fleet-card-stats">
              <span className="fleet-card-stat">
                <span className="telemetry-label">SPD</span>
                <span className="telemetry-value">{v.groundspeed?.toFixed(1) || '0.0'}</span>
              </span>
              <span className="fleet-card-stat">
                <span className="telemetry-label">BAT</span>
                <span className={`telemetry-value ${bat.className}`}>{bat.text}</span>
              </span>
              <span className="fleet-card-stat">
                <span className="telemetry-label">SIG</span>
                <span className="telemetry-value">{avgSignal}%</span>
              </span>
              <span className="fleet-card-stat">
                <span className="telemetry-label">HDG</span>
                <span className="telemetry-value">{Math.round(v.heading || 0)}°</span>
              </span>
            </div>

            {/* Quick actions — show on hover/click */}
            <div className="fleet-card-actions">
              <button
                className={`btn btn-sm ${v.armed ? 'btn-success' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  sendCommand({
                    type: v.armed ? 'disarm' : 'arm',
                    vehicle_id: v.id,
                  });
                }}
                title={v.armed ? 'Disarm' : 'Arm'}
              >
                {v.armed ? '🔒' : '🔓'}
              </button>
              <select
                onClick={e => e.stopPropagation()}
                onChange={e => {
                  sendCommand({ type: 'set_mode', vehicle_id: v.id, mode: e.target.value });
                }}
                value={v.mode || 'MANUAL'}
                className="fleet-mode-select"
              >
                {['MANUAL', 'GUIDED', 'AUTO', 'HOLD', 'LOITER'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <button
                className="btn btn-sm btn-danger"
                onClick={(e) => {
                  e.stopPropagation();
                  sendCommand({ type: 'simulate_failure', vehicle_id: v.id });
                }}
                title="Simulate failure"
              >
                ⚡
              </button>
              <button
                className="btn btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  sendCommand({ type: 'simulate_restore', vehicle_id: v.id });
                }}
                title="Restore"
              >
                🔄
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

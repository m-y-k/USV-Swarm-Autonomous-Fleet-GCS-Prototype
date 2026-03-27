/**
 * Header — Top bar with fleet summary, connection status, and branding.
 */
import React from 'react';

export default function Header({ connected, fleetState }) {
  // Compute fleet summary from state
  const vehicles = fleetState?.vehicles || [];
  const totalVessels = vehicles.length;
  const onlineCount = vehicles.filter(v => v.connected && v.is_alive).length;
  const degradedCount = vehicles.filter(v => {
    const mesh = v.mesh || {};
    const signals = Object.values(mesh.signal_strength || {});
    const avgSignal = signals.length > 0
      ? signals.reduce((a, b) => a + b, 0) / signals.length
      : 100;
    return v.connected && v.is_alive && avgSignal < 70 && avgSignal > 30;
  }).length;
  const offlineCount = totalVessels - onlineCount;

  // Find current leader
  const leader = vehicles.find(v => v.mesh?.is_leader);
  const leaderName = leader ? leader.name : '—';

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="header-brand">
          <span className="header-icon">⚓</span>
          <div className="header-title-group">
            <h1 className="header-title">USV Fleet Command</h1>
            <span className="header-subtitle">Ground Control Station</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="fleet-summary">
          <div className="fleet-stat">
            <span className="fleet-stat-value">{totalVessels}</span>
            <span className="fleet-stat-label">Total</span>
          </div>
          <div className="fleet-stat-divider" />
          <div className="fleet-stat">
            <span className="status-dot online" />
            <span className="fleet-stat-value">{onlineCount}</span>
            <span className="fleet-stat-label">Online</span>
          </div>
          {degradedCount > 0 && (
            <>
              <div className="fleet-stat-divider" />
              <div className="fleet-stat">
                <span className="status-dot degraded" />
                <span className="fleet-stat-value">{degradedCount}</span>
                <span className="fleet-stat-label">Degraded</span>
              </div>
            </>
          )}
          {offlineCount > 0 && (
            <>
              <div className="fleet-stat-divider" />
              <div className="fleet-stat">
                <span className="status-dot offline" />
                <span className="fleet-stat-value">{offlineCount}</span>
                <span className="fleet-stat-label">Offline</span>
              </div>
            </>
          )}
          <div className="fleet-stat-divider" />
          <div className="fleet-stat">
            <span className="fleet-stat-icon">👑</span>
            <span className="fleet-stat-value">{leaderName}</span>
            <span className="fleet-stat-label">Leader</span>
          </div>
        </div>
      </div>

      <div className="header-right">
        <div className={`connection-indicator ${connected ? 'connected' : 'disconnected'}`}>
          <span className="connection-dot" />
          <span className="connection-text">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
}

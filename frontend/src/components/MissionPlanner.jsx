/**
 * MissionPlanner — Waypoint mission planning UI.
 * Spec §4.6: Click map to add waypoints, upload missions, start/clear.
 * Spec §4.7: Swarm pattern generation (line, grid, perimeter, follow-leader).
 * Phase 6: Per-waypoint params, mission progress, pattern previews.
 */
import React, { useState, useCallback } from 'react';
import { useMapEvents } from 'react-leaflet';

// ─── Map click handler (exported for MapView) ───────────
export function MapClickHandler({ onMapClick, enabled }) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

// ─── Swarm Pattern Generators ────────────────────────────
function generateLineFormation(start, end, numVessels, spacing) {
  const missions = {};
  const dLat = end.lat - start.lat;
  const dLon = end.lon - start.lon;
  const perpLat = -dLon * 0.00001 * spacing;
  const perpLon = dLat * 0.00001 * spacing;

  for (let v = 0; v < numVessels; v++) {
    const offset = (v - (numVessels - 1) / 2);
    missions[v] = [
      { lat: start.lat + perpLat * offset, lon: start.lon + perpLon * offset, alt: 0, holdTime: 0, radius: 5 },
      { lat: end.lat + perpLat * offset, lon: end.lon + perpLon * offset, alt: 0, holdTime: 0, radius: 5 },
    ];
  }
  return missions;
}

function generateGridSurvey(corners, numVessels, rows = 4) {
  const minLat = Math.min(corners[0].lat, corners[1].lat);
  const maxLat = Math.max(corners[0].lat, corners[1].lat);
  const minLon = Math.min(corners[0].lon, corners[1].lon);
  const maxLon = Math.max(corners[0].lon, corners[1].lon);

  const stripWidth = (maxLon - minLon) / numVessels;
  const missions = {};

  for (let v = 0; v < numVessels; v++) {
    const stripLeft = minLon + v * stripWidth;
    const stripRight = stripLeft + stripWidth;
    const wps = [];
    for (let r = 0; r < rows; r++) {
      const lat = minLat + (maxLat - minLat) * (r / (rows - 1));
      if (r % 2 === 0) {
        wps.push({ lat, lon: stripLeft, alt: 0, holdTime: 0, radius: 5 });
        wps.push({ lat, lon: stripRight, alt: 0, holdTime: 0, radius: 5 });
      } else {
        wps.push({ lat, lon: stripRight, alt: 0, holdTime: 0, radius: 5 });
        wps.push({ lat, lon: stripLeft, alt: 0, holdTime: 0, radius: 5 });
      }
    }
    missions[v] = wps;
  }
  return missions;
}

function generatePerimeterPatrol(center, radiusMeters, numVessels) {
  const missions = {};
  const radiusDeg = radiusMeters / 111320;
  const sectorSize = (2 * Math.PI) / numVessels;

  for (let v = 0; v < numVessels; v++) {
    const startAngle = v * sectorSize;
    const endAngle = (v + 1) * sectorSize;
    const wps = [];
    const steps = 6;
    for (let s = 0; s <= steps; s++) {
      const angle = startAngle + (endAngle - startAngle) * (s / steps);
      wps.push({
        lat: center.lat + radiusDeg * Math.cos(angle),
        lon: center.lon + radiusDeg * Math.sin(angle) / Math.cos(center.lat * Math.PI / 180),
        alt: 0, holdTime: 0, radius: 5,
      });
    }
    for (let s = steps; s >= 0; s--) {
      const angle = startAngle + (endAngle - startAngle) * (s / steps);
      const innerRadius = radiusDeg * 0.8;
      wps.push({
        lat: center.lat + innerRadius * Math.cos(angle),
        lon: center.lon + innerRadius * Math.sin(angle) / Math.cos(center.lat * Math.PI / 180),
        alt: 0, holdTime: 0, radius: 5,
      });
    }
    missions[v] = wps;
  }
  return missions;
}

function generateFollowLeader(leaderPos, heading, numFollowers, formation, spacing) {
  const headingRad = (heading * Math.PI) / 180;
  const missions = {};

  for (let f = 0; f < numFollowers; f++) {
    let dNorth, dEast;
    if (formation === 'v_shape') {
      const side = f % 2 === 0 ? 1 : -1;
      const row = Math.floor(f / 2) + 1;
      dNorth = -row * spacing * Math.cos(headingRad);
      dEast = side * row * spacing * 0.5;
    } else if (formation === 'echelon') {
      dNorth = -(f + 1) * spacing * Math.cos(headingRad);
      dEast = (f + 1) * spacing * 0.5 * Math.sin(headingRad + Math.PI / 4);
    } else {
      // line (default)
      dNorth = -(f + 1) * spacing * Math.cos(headingRad);
      dEast = -(f + 1) * spacing * Math.sin(headingRad);
    }
    const R = 6371000;
    const newLat = leaderPos.lat + (dNorth / R) * (180 / Math.PI);
    const newLon = leaderPos.lon + (dEast / (R * Math.cos(leaderPos.lat * Math.PI / 180))) * (180 / Math.PI);
    missions[f + 1] = [{ lat: newLat, lon: newLon, alt: 0, holdTime: 0, radius: 5 }];
  }
  return missions;
}

// ─── Pattern Preview SVGs ────────────────────────────────
function PatternPreview({ pattern }) {
  const size = 48;
  const pad = 6;
  const area = size - 2 * pad;

  if (pattern === 'line') {
    return (
      <svg width={size} height={size} className="pattern-preview-svg">
        <line x1={pad} y1={pad + area * 0.2} x2={pad + area} y2={pad + area * 0.2} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,2" />
        <line x1={pad} y1={pad + area * 0.5} x2={pad + area} y2={pad + area * 0.5} stroke="#22d3ee" strokeWidth="1.5" strokeDasharray="3,2" />
        <line x1={pad} y1={pad + area * 0.8} x2={pad + area} y2={pad + area * 0.8} stroke="#10b981" strokeWidth="1.5" strokeDasharray="3,2" />
        {[0.2, 0.5, 0.8].map((y, i) => (
          <React.Fragment key={i}>
            <circle cx={pad + 4} cy={pad + area * y} r="3" fill={['#f59e0b', '#22d3ee', '#10b981'][i]} />
            <polygon points={`${pad + area - 2},${pad + area * y - 3} ${pad + area + 2},${pad + area * y} ${pad + area - 2},${pad + area * y + 3}`} fill={['#f59e0b', '#22d3ee', '#10b981'][i]} />
          </React.Fragment>
        ))}
      </svg>
    );
  }

  if (pattern === 'grid') {
    return (
      <svg width={size} height={size} className="pattern-preview-svg">
        <rect x={pad} y={pad} width={area} height={area} fill="none" stroke="var(--text-dim)" strokeWidth="0.5" />
        <polyline points={`${pad},${pad} ${pad + area * 0.33},${pad} ${pad + area * 0.33},${pad + area} ${pad},${pad + area}`} fill="none" stroke="#f59e0b" strokeWidth="1.2" />
        <polyline points={`${pad + area * 0.33},${pad} ${pad + area * 0.66},${pad} ${pad + area * 0.66},${pad + area} ${pad + area * 0.33},${pad + area}`} fill="none" stroke="#22d3ee" strokeWidth="1.2" />
        <polyline points={`${pad + area * 0.66},${pad} ${pad + area},${pad} ${pad + area},${pad + area} ${pad + area * 0.66},${pad + area}`} fill="none" stroke="#10b981" strokeWidth="1.2" />
      </svg>
    );
  }

  if (pattern === 'perimeter') {
    const cx = size / 2, cy = size / 2, r = area / 2 - 2;
    const arcs = ['#f59e0b', '#22d3ee', '#10b981'];
    return (
      <svg width={size} height={size} className="pattern-preview-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--text-dim)" strokeWidth="0.5" strokeDasharray="2,2" />
        {arcs.map((color, i) => {
          const startA = (i * 2 * Math.PI) / 3 - Math.PI / 2;
          const endA = ((i + 1) * 2 * Math.PI) / 3 - Math.PI / 2;
          const x1 = cx + r * Math.cos(startA), y1 = cy + r * Math.sin(startA);
          const x2 = cx + r * Math.cos(endA), y2 = cy + r * Math.sin(endA);
          return <path key={i} d={`M${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2}`} fill="none" stroke={color} strokeWidth="2" />;
        })}
      </svg>
    );
  }

  if (pattern === 'follow') {
    return (
      <svg width={size} height={size} className="pattern-preview-svg">
        <circle cx={size / 2} cy={pad + 6} r="4" fill="#22d3ee" />
        <text x={size / 2} y={pad + 9} textAnchor="middle" fill="white" fontSize="5" fontWeight="700">L</text>
        <circle cx={size / 2 - 8} cy={pad + area * 0.5} r="3" fill="#f59e0b" />
        <circle cx={size / 2 + 8} cy={pad + area * 0.5} r="3" fill="#10b981" />
        <line x1={size / 2} y1={pad + 10} x2={size / 2 - 8} y2={pad + area * 0.5 - 3} stroke="var(--text-dim)" strokeWidth="0.8" strokeDasharray="2,2" />
        <line x1={size / 2} y1={pad + 10} x2={size / 2 + 8} y2={pad + area * 0.5 - 3} stroke="var(--text-dim)" strokeWidth="0.8" strokeDasharray="2,2" />
      </svg>
    );
  }

  return null;
}

// ─── Mission Planner Panel ───────────────────────────────
export default function MissionPlanner({ vehicle, vehicles, waypoints, setWaypoints, sendCommand, currentWaypointIndex = -1 }) {
  const [pattern, setPattern] = useState('none');
  const [spacing, setSpacing] = useState(50);
  const [radius, setRadius] = useState(500);
  const [gridRows, setGridRows] = useState(4);
  const [followFormation, setFollowFormation] = useState('line');
  const [previewWaypoints, setPreviewWaypoints] = useState(null);
  const [editingWp, setEditingWp] = useState(null);
  const [wpHoldTime, setWpHoldTime] = useState(0);
  const [wpRadius, setWpRadius] = useState(5);

  const handleAddWaypoint = useCallback((latlng) => {
    setWaypoints(prev => [...prev, {
      lat: latlng.lat,
      lon: latlng.lng,
      alt: 0,
      holdTime: 0,
      radius: 5,
    }]);
  }, [setWaypoints]);

  const handleRemoveWaypoint = useCallback((index) => {
    setWaypoints(prev => prev.filter((_, i) => i !== index));
  }, [setWaypoints]);

  const handleDragWaypoint = useCallback((index, lat, lon) => {
    setWaypoints(prev => prev.map((wp, i) => i === index ? { ...wp, lat, lon } : wp));
  }, [setWaypoints]);

  const handleUpdateWaypointParams = useCallback((index, holdTime, acceptanceRadius) => {
    setWaypoints(prev => prev.map((wp, i) =>
      i === index ? { ...wp, holdTime, radius: acceptanceRadius } : wp
    ));
  }, [setWaypoints]);

  const handleUploadMission = () => {
    if (!vehicle || waypoints.length === 0) return;
    sendCommand({
      type: 'upload_mission',
      vehicle_id: vehicle.id,
      waypoints: waypoints,
    });
  };

  const handleUploadToFleet = () => {
    if (waypoints.length === 0 || !vehicles) return;
    vehicles.forEach((v, i) => {
      const offset = i * 0.0003;
      const offsetWps = waypoints.map(wp => ({
        lat: wp.lat + offset,
        lon: wp.lon + offset,
        alt: wp.alt,
        holdTime: wp.holdTime || 0,
        radius: wp.radius || 5,
      }));
      sendCommand({
        type: 'upload_mission',
        vehicle_id: v.id,
        waypoints: offsetWps,
      });
    });
  };

  const handleClear = () => {
    setWaypoints([]);
    setPreviewWaypoints(null);
  };

  const handleStartMission = () => {
    if (!vehicle) return;
    sendCommand({ type: 'set_mode', vehicle_id: vehicle.id, mode: 'AUTO' });
  };

  const handleGeneratePattern = (previewOnly = false) => {
    if (!vehicles || vehicles.length === 0) return;

    const center = { lat: -33.8568, lon: 151.2153 };
    let missions;

    switch (pattern) {
      case 'line':
        missions = generateLineFormation(
          { lat: center.lat - 0.003, lon: center.lon - 0.003 },
          { lat: center.lat + 0.003, lon: center.lon + 0.003 },
          vehicles.length, spacing
        );
        break;
      case 'grid':
        missions = generateGridSurvey(
          [
            { lat: center.lat - 0.003, lon: center.lon - 0.003 },
            { lat: center.lat + 0.003, lon: center.lon + 0.003 },
          ],
          vehicles.length, gridRows
        );
        break;
      case 'perimeter':
        missions = generatePerimeterPatrol(center, radius, vehicles.length);
        break;
      case 'follow': {
        const leader = vehicles.find(v => v.mesh?.is_leader) || vehicles[0];
        if (leader) {
          missions = generateFollowLeader(
            { lat: leader.position?.lat || center.lat, lon: leader.position?.lon || center.lon },
            leader.heading || 0,
            vehicles.length - 1,
            followFormation,
            spacing
          );
        }
        break;
      }
      default:
        return;
    }

    if (missions) {
      if (previewOnly) {
        // Set preview waypoints (shown on map but not uploaded)
        if (missions[0]) setPreviewWaypoints(missions[0]);
        return;
      }

      // Upload to each vehicle
      Object.entries(missions).forEach(([vid, wps]) => {
        const vehicleId = parseInt(vid);
        if (vehicles.find(v => v.id === vehicleId)) {
          sendCommand({
            type: 'upload_mission',
            vehicle_id: vehicleId,
            waypoints: wps,
          });
        }
      });
      if (missions[0]) {
        setWaypoints(missions[0]);
      }
      setPreviewWaypoints(null);
    }
  };

  const startEditingWp = (index) => {
    setEditingWp(index);
    setWpHoldTime(waypoints[index]?.holdTime || 0);
    setWpRadius(waypoints[index]?.radius || 5);
  };

  const saveWpParams = () => {
    if (editingWp !== null) {
      handleUpdateWaypointParams(editingWp, wpHoldTime, wpRadius);
      setEditingWp(null);
    }
  };

  // Mission progress
  const totalWp = waypoints.length;
  const currentWp = currentWaypointIndex >= 0 ? currentWaypointIndex + 1 : 0;

  return (
    <div className="mission-planner">
      <div className="command-section">
        <div className="command-section-title">Mission Planner</div>
        <p className="mission-hint">Click the map to add waypoints. Right-click to remove. Drag to reposition.</p>

        {/* Mission progress */}
        <div className="mission-progress-bar">
          <div className="mission-wp-count">
            <span className="telemetry-label">Waypoints</span>
            <span className="telemetry-value">{totalWp}</span>
          </div>
          {currentWaypointIndex >= 0 && (
            <div className="mission-wp-count">
              <span className="telemetry-label">Progress</span>
              <span className="telemetry-value mission-progress-text">{currentWp}/{totalWp}</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {totalWp > 0 && currentWaypointIndex >= 0 && (
          <div className="mission-track">
            <div
              className="mission-track-fill"
              style={{ width: `${(currentWp / totalWp) * 100}%` }}
            />
          </div>
        )}

        {/* Waypoint list (editable params) */}
        {waypoints.length > 0 && (
          <div className="wp-list">
            {waypoints.map((wp, i) => (
              <div
                key={i}
                className={`wp-list-item ${i === currentWaypointIndex ? 'current' : ''} ${editingWp === i ? 'editing' : ''}`}
                onClick={() => startEditingWp(i)}
              >
                <span className="wp-list-num">{i + 1}</span>
                <span className="wp-list-coord">{wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}</span>
                {wp.holdTime > 0 && <span className="wp-list-param">⏱{wp.holdTime}s</span>}
                <span className="wp-list-param">⊙{wp.radius || 5}m</span>
              </div>
            ))}
          </div>
        )}

        {/* Per-waypoint parameter editor */}
        {editingWp !== null && waypoints[editingWp] && (
          <div className="wp-param-editor">
            <div className="command-section-title" style={{ fontSize: '0.68rem' }}>
              WP {editingWp + 1} Parameters
            </div>
            <div className="command-row">
              <span className="telemetry-label">Hold (s)</span>
              <input
                type="number"
                value={wpHoldTime}
                onChange={e => setWpHoldTime(Number(e.target.value))}
                min="0"
                max="300"
                style={{ width: 60 }}
              />
            </div>
            <div className="command-row">
              <span className="telemetry-label">Radius (m)</span>
              <input
                type="number"
                value={wpRadius}
                onChange={e => setWpRadius(Number(e.target.value))}
                min="1"
                max="100"
                style={{ width: 60 }}
              />
            </div>
            <div className="command-row">
              <button className="btn btn-accent btn-sm" onClick={saveWpParams}>✓ Save</button>
              <button className="btn btn-sm" onClick={() => setEditingWp(null)}>✕ Cancel</button>
            </div>
          </div>
        )}

        <div className="command-row">
          <button className="btn btn-accent btn-sm" onClick={handleUploadMission} disabled={waypoints.length === 0}>
            📤 Upload Mission
          </button>
          <button className="btn btn-sm" onClick={handleUploadToFleet} disabled={waypoints.length === 0}>
            📤 Upload to Fleet
          </button>
        </div>

        <div className="command-row">
          <button className="btn btn-success btn-sm" onClick={handleStartMission}>
            ▶ Start Mission
          </button>
          <button className="btn btn-sm" onClick={handleClear}>
            ✕ Clear
          </button>
        </div>
      </div>

      {/* Swarm Patterns */}
      <div className="command-section">
        <div className="command-section-title">Swarm Patterns</div>

        <div className="pattern-selector">
          {[
            { value: 'line', label: 'Line' },
            { value: 'grid', label: 'Grid' },
            { value: 'perimeter', label: 'Perimeter' },
            { value: 'follow', label: 'Follow' },
          ].map(p => (
            <button
              key={p.value}
              className={`pattern-btn ${pattern === p.value ? 'active' : ''}`}
              onClick={() => setPattern(pattern === p.value ? 'none' : p.value)}
            >
              <PatternPreview pattern={p.value} />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Pattern-specific params */}
        {(pattern === 'line' || pattern === 'follow') && (
          <div className="command-row">
            <span className="telemetry-label">Spacing (m)</span>
            <input type="number" value={spacing} onChange={e => setSpacing(Number(e.target.value))} min="10" max="500" style={{ width: 70 }} />
          </div>
        )}

        {pattern === 'perimeter' && (
          <div className="command-row">
            <span className="telemetry-label">Radius (m)</span>
            <input type="number" value={radius} onChange={e => setRadius(Number(e.target.value))} min="100" max="5000" style={{ width: 70 }} />
          </div>
        )}

        {pattern === 'grid' && (
          <div className="command-row">
            <span className="telemetry-label">Rows</span>
            <input type="number" value={gridRows} onChange={e => setGridRows(Number(e.target.value))} min="2" max="10" style={{ width: 70 }} />
          </div>
        )}

        {pattern === 'follow' && (
          <div className="command-row">
            <span className="telemetry-label">Formation</span>
            <select value={followFormation} onChange={e => setFollowFormation(e.target.value)} style={{ flex: 1 }}>
              <option value="line">Line</option>
              <option value="v_shape">V-Shape</option>
              <option value="echelon">Echelon</option>
            </select>
          </div>
        )}

        {pattern !== 'none' && (
          <div className="command-row">
            <button className="btn btn-sm" onClick={() => handleGeneratePattern(true)} style={{ flex: 1 }}>
              👁 Preview
            </button>
            <button className="btn btn-accent btn-sm" onClick={() => handleGeneratePattern(false)} style={{ flex: 1 }}>
              🎯 Generate & Upload
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

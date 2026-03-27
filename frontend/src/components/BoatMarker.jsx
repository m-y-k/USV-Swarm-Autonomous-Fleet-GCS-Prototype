/**
 * BoatMarker — Directional boat icon on the map.
 * 
 * - Rotates based on heading
 * - Color-coded by status (active/degraded/offline/leader)
 * - GNSS-denied: dashed outline with "DR" label and uncertainty circle
 * - Shows name and mode label
 * - Trail line of last N positions
 * - Click to select
 */
import React, { useMemo, useRef, useEffect } from 'react';
import { Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { TRAIL_CONFIG } from '../utils/constants';
import { formatSpeed, formatHeading, formatCoord } from '../utils/formatters';

/**
 * Create a boat-shaped SVG icon that rotates with heading.
 * Supports GNSS-denied (dead reckoning) mode with dashed outline.
 */
function createBoatIcon(heading, status, isLeader, isSelected, gnssDenied) {
  let fill = '#10b981';
  let stroke = '#065f46';
  let glowColor = 'rgba(16,185,129,0.4)';

  if (gnssDenied) {
    fill = 'rgba(100, 116, 139, 0.4)';
    stroke = '#94a3b8';
    glowColor = 'rgba(239,68,68,0.3)';
  } else if (status === 'offline' || status === 'unreachable') {
    fill = '#ef4444';
    stroke = '#991b1b';
    glowColor = 'rgba(239,68,68,0.4)';
  } else if (status === 'degraded') {
    fill = '#f59e0b';
    stroke = '#92400e';
    glowColor = 'rgba(245,158,11,0.4)';
  }

  const leaderRing = isLeader
    ? `<circle cx="18" cy="18" r="16" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-dasharray="3,2" opacity="0.8"/>`
    : '';

  const selectedRing = isSelected
    ? `<circle cx="18" cy="18" r="14" fill="none" stroke="#22d3ee" stroke-width="1.5" opacity="0.9"/>`
    : '';

  const drIndicator = gnssDenied
    ? `<circle cx="18" cy="18" r="15" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4,3" opacity="0.7"/>
       <text x="18" y="35" text-anchor="middle" fill="#ef4444" font-size="7" font-weight="700" font-family="monospace">DR</text>`
    : '';

  const boatPath = gnssDenied
    ? `<path d="M18 4 L26 28 L18 24 L10 28 Z" 
            fill="${fill}" stroke="${stroke}" stroke-width="1.5"
            stroke-linejoin="round" stroke-dasharray="3,2"/>`
    : `<path d="M18 4 L26 28 L18 24 L10 28 Z" 
            fill="${fill}" stroke="${stroke}" stroke-width="1.2"
            stroke-linejoin="round"/>`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="${gnssDenied ? 40 : 36}" viewBox="0 0 36 ${gnssDenied ? 40 : 36}">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="blur"/>
          <feFlood flood-color="${glowColor}" result="color"/>
          <feComposite in="color" in2="blur" operator="in"/>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      ${leaderRing}
      ${selectedRing}
      ${drIndicator}
      <g transform="rotate(${heading || 0}, 18, 18)" filter="url(#glow)">
        ${boatPath}
        <circle cx="18" cy="18" r="2.5" fill="white" opacity="${gnssDenied ? 0.3 : 0.6}"/>
      </g>
    </svg>
  `;

  return L.divIcon({
    html: svg,
    className: `boat-marker-icon ${gnssDenied ? 'gnss-denied' : ''}`,
    iconSize: [36, gnssDenied ? 40 : 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
}

function getVehicleStatus(vehicle) {
  if (!vehicle.connected || !vehicle.is_alive) return 'offline';
  const signals = Object.values(vehicle.mesh?.signal_strength || {});
  if (signals.length > 0) {
    const avg = signals.reduce((a, b) => a + b, 0) / signals.length;
    if (avg < 30) return 'degraded';
  }
  return 'active';
}

export default function BoatMarker({ vehicle, isSelected, onSelect, gnssDenied = false }) {
  const trailRef = useRef([]);
  const map = useMap();

  if (!vehicle || (vehicle.position.lat === 0 && vehicle.position.lon === 0)) {
    return null;
  }

  const pos = [vehicle.position.lat, vehicle.position.lon];
  const status = getVehicleStatus(vehicle);
  const isLeader = vehicle.mesh?.is_leader || false;

  // Accumulate trail positions
  useEffect(() => {
    if (vehicle.position.lat !== 0) {
      trailRef.current.push([...pos]);
      if (trailRef.current.length > TRAIL_CONFIG.maxPoints) {
        trailRef.current.shift();
      }
    }
  }, [vehicle.position.lat, vehicle.position.lon]);

  const icon = useMemo(
    () => createBoatIcon(vehicle.heading, status, isLeader, isSelected, gnssDenied),
    [vehicle.heading, status, isLeader, isSelected, gnssDenied]
  );

  const trail = trailRef.current.length > 1 ? trailRef.current : null;

  return (
    <>
      {/* Trail line */}
      {trail && (
        <Polyline
          positions={trail}
          pathOptions={{
            color: gnssDenied ? '#ef4444' : TRAIL_CONFIG.color,
            weight: TRAIL_CONFIG.weight,
            opacity: gnssDenied ? 0.2 : 0.4,
            dashArray: gnssDenied ? '2,4' : '4,4',
          }}
        />
      )}

      {/* Boat marker */}
      <Marker
        position={pos}
        icon={icon}
        eventHandlers={{
          click: () => onSelect && onSelect(),
        }}
      >
        <Popup className="boat-popup" closeButton={false}>
          <div style={{
            fontFamily: 'var(--font-display)',
            color: '#e2e8f0',
            fontSize: '0.78rem',
            lineHeight: 1.5,
            minWidth: 160,
          }}>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
              {vehicle.name}
              {isLeader && <span style={{ color: '#3b82f6', marginLeft: 6 }}>👑 LEADER</span>}
              {gnssDenied && <span style={{ color: '#ef4444', marginLeft: 6 }}>📡 DR MODE</span>}
            </div>
            <div><strong>Mode:</strong> {vehicle.mode}</div>
            <div><strong>Position:</strong> {formatCoord(vehicle.position.lat)}, {formatCoord(vehicle.position.lon)}</div>
            <div><strong>Heading:</strong> {formatHeading(vehicle.heading)}</div>
            <div><strong>Speed:</strong> {formatSpeed(vehicle.groundspeed)}</div>
            <div><strong>Battery:</strong> {vehicle.battery?.remaining}%</div>
            <div><strong>Armed:</strong> {vehicle.armed ? '✅ YES' : '❌ NO'}</div>
            {gnssDenied && (
              <div style={{ color: '#ef4444', marginTop: 4 }}>
                ⚠ GNSS Denied — Dead Reckoning
              </div>
            )}
          </div>
        </Popup>
      </Marker>

      {/* Name label */}
      <Marker
        position={pos}
        icon={L.divIcon({
          html: `<div class="boat-label ${status} ${isLeader ? 'leader' : ''} ${gnssDenied ? 'gnss-denied' : ''}">
                   ${vehicle.name}${gnssDenied ? ' <span class="dr-tag">DR</span>' : ''}
                   <span class="boat-label-mode">${vehicle.mode}</span>
                 </div>`,
          className: 'boat-label-container',
          iconSize: [90, 24],
          iconAnchor: [45, -10],
        })}
        interactive={false}
      />
    </>
  );
}

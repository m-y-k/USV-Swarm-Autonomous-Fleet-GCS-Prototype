/**
 * WaypointMarker — Dedicated numbered waypoint marker on the map.
 * Spec §4.6: Numbered markers with drag, right-click remove, per-waypoint params.
 */
import React, { useState } from 'react';
import { Marker, Polyline, Tooltip, Circle } from 'react-leaflet';
import L from 'leaflet';

function createWaypointIcon(index, status) {
  // status: 'upcoming' | 'current' | 'completed'
  const colors = {
    upcoming: '#f59e0b',
    current: '#22d3ee',
    completed: '#10b981',
  };
  const color = colors[status] || colors.upcoming;
  const opacity = status === 'completed' ? 0.5 : 1;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" opacity="${opacity}">
      <path d="M14 0 C6.3 0 0 6.3 0 14 C0 24.5 14 36 14 36 S28 24.5 28 14 C28 6.3 21.7 0 14 0Z"
            fill="${color}" stroke="rgba(0,0,0,0.4)" stroke-width="1"/>
      <circle cx="14" cy="14" r="8" fill="rgba(0,0,0,0.25)"/>
      <text x="14" y="18" text-anchor="middle" fill="white" font-size="11" font-weight="700"
            font-family="monospace">${index + 1}</text>
    </svg>
  `;
  return L.divIcon({
    html: svg,
    className: 'waypoint-marker-icon',
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  });
}

function getWaypointStatus(index, currentWaypointIndex) {
  if (currentWaypointIndex < 0) return 'upcoming';
  if (index < currentWaypointIndex) return 'completed';
  if (index === currentWaypointIndex) return 'current';
  return 'upcoming';
}

export default function WaypointMarker({
  waypoint,
  index,
  currentWaypointIndex = -1,
  onRemove,
  onDrag,
  onUpdateParams,
}) {
  const status = getWaypointStatus(index, currentWaypointIndex);

  return (
    <>
      {/* Acceptance radius circle for current waypoint */}
      {status === 'current' && waypoint.radius && (
        <Circle
          center={[waypoint.lat, waypoint.lon]}
          radius={waypoint.radius}
          pathOptions={{
            color: '#22d3ee',
            weight: 1,
            opacity: 0.4,
            fillOpacity: 0.08,
            dashArray: '4,4',
          }}
        />
      )}

      <Marker
        position={[waypoint.lat, waypoint.lon]}
        icon={createWaypointIcon(index, status)}
        draggable={true}
        eventHandlers={{
          contextmenu: () => onRemove && onRemove(index),
          dragend: (e) => {
            const { lat, lng } = e.target.getLatLng();
            onDrag && onDrag(index, lat, lng);
          },
        }}
      >
        <Tooltip
          direction="right"
          offset={[12, -18]}
          permanent={false}
          className="wp-tooltip"
        >
          <div className="wp-tooltip-content">
            <strong>WP {index + 1}</strong>
            <span>{waypoint.lat.toFixed(6)}, {waypoint.lon.toFixed(6)}</span>
            {waypoint.holdTime > 0 && <span>Hold: {waypoint.holdTime}s</span>}
            {waypoint.radius > 0 && <span>Radius: {waypoint.radius}m</span>}
            <span className="wp-tooltip-hint">Right-click to remove</span>
          </div>
        </Tooltip>
      </Marker>
    </>
  );
}

/**
 * WaypointPath — Renders the connecting line and all markers for a mission.
 */
export function WaypointPath({
  waypoints,
  currentWaypointIndex = -1,
  onRemoveWaypoint,
  onDragWaypoint,
  onUpdateWaypointParams,
}) {
  if (!waypoints || waypoints.length === 0) return null;

  const positions = waypoints.map(wp => [wp.lat, wp.lon]);

  // Split path into completed and upcoming segments
  const completedPositions = currentWaypointIndex > 0
    ? positions.slice(0, currentWaypointIndex + 1)
    : [];
  const upcomingPositions = currentWaypointIndex >= 0
    ? positions.slice(currentWaypointIndex)
    : positions;

  return (
    <>
      {/* Completed path (solid green) */}
      {completedPositions.length > 1 && (
        <Polyline
          positions={completedPositions}
          pathOptions={{
            color: '#10b981',
            weight: 3,
            opacity: 0.5,
          }}
        />
      )}

      {/* Upcoming path (dashed amber) */}
      {upcomingPositions.length > 1 && (
        <Polyline
          positions={upcomingPositions}
          pathOptions={{
            color: '#f59e0b',
            weight: 2,
            opacity: 0.6,
            dashArray: '6,4',
          }}
        />
      )}

      {/* Waypoint markers */}
      {waypoints.map((wp, i) => (
        <WaypointMarker
          key={`wp-${i}-${wp.lat}-${wp.lon}`}
          waypoint={wp}
          index={i}
          currentWaypointIndex={currentWaypointIndex}
          onRemove={onRemoveWaypoint}
          onDrag={onDragWaypoint}
          onUpdateParams={onUpdateWaypointParams}
        />
      ))}
    </>
  );
}

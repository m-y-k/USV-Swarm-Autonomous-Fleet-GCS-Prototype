/**
 * MapView — Interactive maritime map using Leaflet.
 * 
 * Shows all USVs on a nautical chart with:
 * - Directional boat markers (rotate with heading)
 * - Signal link lines between vessels
 * - Waypoint markers and mission paths
 * - GNSS-denied uncertainty circles
 * - Click to select vessel, click map for waypoint
 * 
 * Default: Sydney Harbour, Australia (-33.8568, 151.2153)
 */
import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, useMapEvents, Circle } from 'react-leaflet';
import BoatMarker from './BoatMarker';
import MeshLink from './MeshLink';
import { WaypointPath } from './WaypointMarker';
import { MAP_CONFIG } from '../utils/constants';

// Component to auto-fit bounds once valid GPS positions arrive
function MapController({ vehicles }) {
  const map = useMap();
  const fittedRef = useRef(false);

  // Fires whenever any vehicle first gets a non-zero position
  const hasValidPositions = vehicles.some(v => v.position.lat !== 0 || v.position.lon !== 0);

  useEffect(() => {
    if (fittedRef.current || !hasValidPositions) return;

    const validPositions = vehicles
      .filter(v => v.position.lat !== 0 || v.position.lon !== 0)
      .map(v => [v.position.lat, v.position.lon]);

    if (validPositions.length > 0) {
      map.fitBounds(validPositions, { padding: [60, 60], maxZoom: 15 });
      fittedRef.current = true;
    }
  }, [hasValidPositions]);

  return null;
}

// Handle map clicks for waypoints or GUIDED mode
function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) onMapClick(e.latlng);
    },
  });
  return null;
}

export default function MapView({
  vehicles = [],
  meshEdges = [],
  selectedVehicleId,
  onSelectVehicle,
  onMapClick,
  waypoints = [],
  currentWaypointIndex = -1,
  onRemoveWaypoint,
  onDragWaypoint,
  onUpdateWaypointParams,
  gnssDeniedVehicles = {},
}) {
  return (
    <MapContainer
      center={MAP_CONFIG.defaultCenter}
      zoom={MAP_CONFIG.defaultZoom}
      minZoom={MAP_CONFIG.minZoom}
      maxZoom={MAP_CONFIG.maxZoom}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
    >
      {/* Base map tiles */}
      <TileLayer
        url={MAP_CONFIG.tileUrl}
        attribution={MAP_CONFIG.tileAttribution}
      />

      {/* OpenSeaMap nautical overlay */}
      <TileLayer
        url={MAP_CONFIG.seaMapUrl}
        opacity={0.6}
      />

      {/* Auto-fit bounds */}
      <MapController vehicles={vehicles} />

      {/* Click handler */}
      <MapClickHandler onMapClick={onMapClick} />

      {/* Mesh network link lines */}
      {meshEdges.map((edge, i) => {
        const fromVeh = vehicles.find(v => v.id === edge.from);
        const toVeh = vehicles.find(v => v.id === edge.to);
        if (!fromVeh || !toVeh) return null;
        if (fromVeh.position.lat === 0 || toVeh.position.lat === 0) return null;

        return (
          <MeshLink
            key={`edge-${edge.from}-${edge.to}`}
            from={[fromVeh.position.lat, fromVeh.position.lon]}
            to={[toVeh.position.lat, toVeh.position.lon]}
            signal={edge.signal}
            state={edge.state}
            distance={edge.distance}
          />
        );
      })}

      {/* GNSS-denied uncertainty circles */}
      {Object.entries(gnssDeniedVehicles).map(([vid, gnssState]) => {
        if (!gnssState || !gnssState.active) return null;
        return (
          <Circle
            key={`gnss-uncertainty-${vid}`}
            center={[gnssState.estimatedLat, gnssState.estimatedLon]}
            radius={gnssState.uncertaintyRadius}
            pathOptions={{
              color: '#ef4444',
              weight: 1.5,
              opacity: 0.5,
              fillColor: '#ef4444',
              fillOpacity: 0.06,
              dashArray: '5,5',
            }}
          />
        );
      })}

      {/* Mission waypoint markers */}
      {waypoints.length > 0 && (
        <WaypointPath
          waypoints={waypoints}
          currentWaypointIndex={currentWaypointIndex}
          onRemoveWaypoint={onRemoveWaypoint}
          onDragWaypoint={onDragWaypoint}
          onUpdateWaypointParams={onUpdateWaypointParams}
        />
      )}

      {/* Boat markers */}
      {vehicles.map(vehicle => (
        <BoatMarker
          key={vehicle.id}
          vehicle={vehicle}
          isSelected={selectedVehicleId === vehicle.id}
          onSelect={() => onSelectVehicle(vehicle.id)}
          gnssDenied={gnssDeniedVehicles[vehicle.id]?.active || false}
        />
      ))}
    </MapContainer>
  );
}

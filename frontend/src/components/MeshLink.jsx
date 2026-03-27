/**
 * MeshLink — Signal link line between two boats on the map.
 * 
 * - Solid green for strong signal (>70%)
 * - Dashed yellow for degraded (30-70%)
 * - Dotted red for weak (<30%)
 * - Shows signal % tooltip on hover
 */
import React from 'react';
import { Polyline, Tooltip } from 'react-leaflet';
import { formatDistance, formatSignal } from '../utils/formatters';

export default function MeshLink({ from, to, signal, state, distance }) {
  let color = '#10b981';  // strong green
  let dashArray = null;
  let weight = 2;
  let opacity = 0.7;

  if (state === 'degraded' || (signal > 30 && signal <= 70)) {
    color = '#f59e0b';
    dashArray = '8,6';
    weight = 1.8;
    opacity = 0.6;
  } else if (state === 'weak' || signal <= 30) {
    color = '#ef4444';
    dashArray = '3,5';
    weight = 1.5;
    opacity = 0.5;
  }

  return (
    <Polyline
      positions={[from, to]}
      pathOptions={{
        color,
        weight,
        opacity,
        dashArray,
      }}
    >
      <Tooltip
        sticky
        direction="center"
        className="mesh-link-tooltip"
      >
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: '#e2e8f0',
        }}>
          {formatSignal(signal)} · {formatDistance(distance)}
        </span>
      </Tooltip>
    </Polyline>
  );
}

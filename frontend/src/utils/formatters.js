/**
 * USV Fleet Command — Formatting & Conversion Utilities
 */

// ─── Unit Conversions ─────────────────────────────────
export const MS_TO_KNOTS = 1.94384;

/**
 * Convert m/s to knots
 */
export function toKnots(ms) {
  return (ms * MS_TO_KNOTS).toFixed(1);
}

/**
 * Format speed with both units: "2.5 m/s (4.9 kn)"
 */
export function formatSpeed(ms) {
  if (ms == null) return '—';
  return `${ms.toFixed(1)} m/s (${toKnots(ms)} kn)`;
}

/**
 * Format GPS coordinate to 6 decimal places
 */
export function formatCoord(value) {
  if (value == null || value === 0) return '—';
  return value.toFixed(6);
}

/**
 * Format heading: "045°"
 */
export function formatHeading(deg) {
  if (deg == null) return '—';
  return `${Math.round(deg).toString().padStart(3, '0')}°`;
}

/**
 * Format altitude in meters
 */
export function formatAlt(m) {
  if (m == null) return '—';
  return `${m.toFixed(1)} m`;
}

/**
 * Format distance in human readable form
 */
export function formatDistance(meters) {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Format battery voltage: "12.4V"
 */
export function formatVoltage(v) {
  if (v == null) return '—';
  return `${v.toFixed(1)}V`;
}

/**
 * Format battery percentage with color class
 */
export function getBatteryStatus(pct) {
  if (pct == null) return { text: '—', className: '' };
  if (pct > 50) return { text: `${pct}%`, className: 'battery-high' };
  if (pct > 20) return { text: `${pct}%`, className: 'battery-mid' };
  return { text: `${pct}%`, className: 'battery-low' };
}

/**
 * Format connection age in human readable form
 */
export function formatConnectionAge(seconds) {
  if (seconds == null || seconds < 0) return '—';
  if (seconds < 1) return '< 1s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h`;
}

/**
 * Format signal strength percentage
 */
export function formatSignal(strength) {
  if (strength == null) return '—';
  return `${strength.toFixed(0)}%`;
}

/**
 * Get signal quality class based on percentage
 */
export function getSignalClass(strength) {
  if (strength == null || strength <= 0) return 'signal-none';
  if (strength > 70) return 'signal-strong';
  if (strength > 30) return 'signal-degraded';
  return 'signal-weak';
}

/**
 * Format timestamp to HH:MM:SS
 */
export function formatTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

/**
 * Format timestamp to full datetime
 */
export function formatDateTime(timestamp) {
  if (!timestamp) return '—';
  const d = new Date(timestamp * 1000);
  return d.toLocaleString('en-GB', { hour12: false });
}

/**
 * Degrees to radians
 */
export function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

/**
 * Radians to degrees
 */
export function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

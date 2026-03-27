/**
 * USV Fleet Command — Constants & Configuration
 */

// ─── WebSocket ─────────────────────────────────────────
export const WS_URL = 'ws://localhost:8000/ws';
export const API_URL = 'http://localhost:8000';

// ─── Map Configuration ────────────────────────────────
export const MAP_CONFIG = {
  defaultCenter: [-33.8568, 151.2153], // Sydney Harbour
  defaultZoom: 14,
  minZoom: 3,
  maxZoom: 19,
  tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  seaMapUrl: 'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
};

// ─── Boat Status Colors ───────────────────────────────
export const STATUS_COLORS = {
  active: '#10b981',
  degraded: '#f59e0b',
  unreachable: '#ef4444',
  offline: '#ef4444',
};

// ─── Signal Strength Thresholds ───────────────────────
export const SIGNAL_THRESHOLDS = {
  strong: 70,   // > 70% = green
  degraded: 30, // 30-70% = yellow
  // < 30% = red
};

// ─── Flight Modes ─────────────────────────────────────
export const FLIGHT_MODES = [
  'MANUAL',
  'GUIDED',
  'AUTO',
  'HOLD',
  'LOITER',
  'STEERING',
  'RTL',
];

// ─── GPS Fix Types ────────────────────────────────────
export const GPS_FIX_TYPES = {
  0: { label: 'No Fix', color: '#ef4444', icon: '✕' },
  2: { label: '2D Fix', color: '#f59e0b', icon: '◐' },
  3: { label: '3D Fix', color: '#10b981', icon: '●' },
};

// ─── Trail Configuration ──────────────────────────────
export const TRAIL_CONFIG = {
  maxPoints: 100,
  fadeOpacity: { start: 0.8, end: 0.05 },
  color: '#06b6d4',
  weight: 2,
};

// ─── Mesh Config Defaults ─────────────────────────────
export const MESH_DEFAULTS = {
  maxRange: 2000,
  minRange: 500,
  maxSlider: 5000,
};

// ─── Update Rate ──────────────────────────────────────
export const UPDATE_RATE_HZ = 5;
export const RECONNECT_DELAY_MS = 3000;

// ─── PID Parameter Definitions ────────────────────────
export const PID_PARAMS = [
  { key: 'ATC_STR_RAT_P', label: 'Steering Rate P', min: 0, max: 2, step: 0.01 },
  { key: 'ATC_STR_RAT_I', label: 'Steering Rate I', min: 0, max: 2, step: 0.01 },
  { key: 'ATC_STR_RAT_D', label: 'Steering Rate D', min: 0, max: 2, step: 0.001 },
  { key: 'ATC_SPEED_P', label: 'Speed P', min: 0, max: 5, step: 0.01 },
  { key: 'ATC_SPEED_I', label: 'Speed I', min: 0, max: 5, step: 0.01 },
  { key: 'ATC_SPEED_D', label: 'Speed D', min: 0, max: 5, step: 0.001 },
  { key: 'CRUISE_SPEED', label: 'Cruise Speed (m/s)', min: 0, max: 20, step: 0.1 },
  { key: 'CRUISE_THROTTLE', label: 'Cruise Throttle (%)', min: 0, max: 100, step: 1 },
  { key: 'WP_RADIUS', label: 'Waypoint Radius (m)', min: 1, max: 50, step: 1 },
  { key: 'NAVL1_PERIOD', label: 'L1 Nav Period', min: 1, max: 40, step: 1 },
];

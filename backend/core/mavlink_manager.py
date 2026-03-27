"""
MAVLink Manager — handles connections to multiple ArduPilot SITL boat instances.
Each boat runs on a separate UDP port. This manager:
  1. Connects to each SITL instance
  2. Receives telemetry (heartbeat, GPS, attitude, battery)
  3. Updates Vehicle state objects
  4. Sends commands (arm, mode change, waypoints)
"""
import asyncio
import math
import time
from typing import Dict, Optional, Callable

from pymavlink import mavutil

from core.vehicle import Vehicle, GPSPosition, Attitude


# ArduRover/Boat mode mapping fallback — used when pymavlink returns None
# for MAV_TYPE_SURFACE_BOAT (type 31) which has no built-in mapping in pymavlink.
_ROVER_MODE_MAPPING = {
    'MANUAL': 0, 'ACRO': 1, 'LEARNING': 2, 'STEERING': 3, 'HOLD': 4,
    'LOITER': 5, 'FOLLOW': 6, 'SIMPLE': 7, 'DOCK': 8, 'CIRCLE': 9,
    'AUTO': 10, 'RTL': 11, 'SMART_RTL': 12, 'GUIDED': 15, 'INIT': 16,
}


class MAVLinkManager:
    """Manages MAVLink connections to multiple ArduPilot SITL instances."""
    
    def __init__(self, on_vehicle_update: Optional[Callable] = None):
        self.vehicles: Dict[int, Vehicle] = {}
        self.connections: Dict[int, object] = {}  # vehicle_id -> mavutil connection
        self.on_vehicle_update = on_vehicle_update  # Callback when vehicle state changes
        self._running = False
    
    def add_vehicle(self, vehicle_id: int, connection_string: str):
        """
        Register a vehicle and its SITL connection string.
        
        Args:
            vehicle_id: Unique ID (0, 1, 2, ...)
            connection_string: e.g. 'udp:127.0.0.1:14550'
        """
        self.vehicles[vehicle_id] = Vehicle(
            vehicle_id=vehicle_id,
            mavlink_port=int(connection_string.split(":")[-1]),
        )
        print(f"[MAVLink] Registered {self.vehicles[vehicle_id].name} on {connection_string}")
        
        # Create MAVLink connection
        try:
            conn = mavutil.mavlink_connection(connection_string, input=True)
            self.connections[vehicle_id] = conn
            print(f"[MAVLink] Connected to {self.vehicles[vehicle_id].name}")
        except Exception as e:
            print(f"[MAVLink] Failed to connect {vehicle_id}: {e}")
    
    async def start(self):
        """Start receiving telemetry from all vehicles."""
        self._running = True
        print(f"[MAVLink] Starting telemetry loop for {len(self.vehicles)} vehicles...")
        
        while self._running:
            for vid, conn in self.connections.items():
                try:
                    # Non-blocking read of ALL pending messages
                    while True:
                        msg = conn.recv_match(blocking=False)
                        if not msg:
                            break
                        self._process_message(vid, msg)
                except Exception as e:
                    pass  # Connection might not be ready yet
            
            # Notify callback
            if self.on_vehicle_update:
                await self.on_vehicle_update(self.get_all_states())
            
            await asyncio.sleep(0.1)  # 10 Hz update rate
    
    def stop(self):
        """Stop the telemetry loop."""
        self._running = False
    
    def _process_message(self, vehicle_id: int, msg):
        """Process a single MAVLink message and update vehicle state."""
        vehicle = self.vehicles[vehicle_id]
        msg_type = msg.get_type()
        
        if msg_type == "HEARTBEAT":
            vehicle.connected = True
            vehicle.last_heartbeat = time.time()
            vehicle.armed = (msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED) != 0
            # Decode flight mode — fall back to rover mapping if pymavlink returns None
            # (happens for MAV_TYPE_SURFACE_BOAT which has no entry in pymavlink's table)
            mode_mapping = self.connections[vehicle_id].mode_mapping() or _ROVER_MODE_MAPPING
            reverse_map = {v: k for k, v in mode_mapping.items()}
            vehicle.mode = reverse_map.get(msg.custom_mode, f"MODE_{msg.custom_mode}")
        
        elif msg_type == "GLOBAL_POSITION_INT":
            vehicle.position.lat = msg.lat / 1e7
            vehicle.position.lon = msg.lon / 1e7
            vehicle.position.alt = msg.alt / 1000.0
            vehicle.heading = msg.hdg / 100.0 if msg.hdg != 65535 else 0.0
        
        elif msg_type == "GPS_RAW_INT":
            vehicle.position.fix_type = msg.fix_type
            vehicle.position.satellites = msg.satellites_visible
        
        elif msg_type == "VFR_HUD":
            vehicle.groundspeed = msg.groundspeed
            vehicle.heading = msg.heading
        
        elif msg_type == "ATTITUDE":
            vehicle.attitude.roll = math.degrees(msg.roll)
            vehicle.attitude.pitch = math.degrees(msg.pitch)
            vehicle.attitude.yaw = math.degrees(msg.yaw)
        
        elif msg_type == "SYS_STATUS":
            vehicle.battery_voltage = msg.voltage_battery / 1000.0
            vehicle.battery_remaining = msg.battery_remaining if msg.battery_remaining >= 0 else 100
    
    def get_vehicle(self, vehicle_id: int) -> Optional[Vehicle]:
        """Get a vehicle by ID."""
        return self.vehicles.get(vehicle_id)
    
    def get_all_states(self) -> list:
        """Get serialized state of all vehicles."""
        return [v.to_dict() for v in self.vehicles.values()]
    
    # ─── Commands ──────────────────────────────────────────────
    
    def arm_vehicle(self, vehicle_id: int):
        """Arm a vehicle's motors."""
        conn = self.connections.get(vehicle_id)
        if conn:
            conn.arducopter_arm()
            print(f"[MAVLink] Arming {self.vehicles[vehicle_id].name}")
    
    def disarm_vehicle(self, vehicle_id: int):
        """Disarm a vehicle's motors."""
        conn = self.connections.get(vehicle_id)
        if conn:
            conn.arducopter_disarm()
            print(f"[MAVLink] Disarming {self.vehicles[vehicle_id].name}")
    
    def set_mode(self, vehicle_id: int, mode: str):
        """Set flight mode (MANUAL, GUIDED, AUTO, etc.)."""
        conn = self.connections.get(vehicle_id)
        if not conn:
            return
        # Fall back to rover mapping so we never crash on None
        mode_mapping = conn.mode_mapping() or _ROVER_MODE_MAPPING
        mode_upper = mode.upper()
        if mode_upper not in mode_mapping:
            print(f"[MAVLink] Unknown mode '{mode_upper}' for {self.vehicles[vehicle_id].name}")
            return
        mode_id = mode_mapping[mode_upper]
        # Use COMMAND_LONG/DO_SET_MODE — more reliable than the deprecated SET_MODE message
        conn.mav.command_long_send(
            conn.target_system,
            conn.target_component,
            mavutil.mavlink.MAV_CMD_DO_SET_MODE,
            0,  # confirmation
            mavutil.mavlink.MAV_MODE_FLAG_CUSTOM_MODE_ENABLED,
            mode_id,
            0, 0, 0, 0, 0,
        )
        print(f"[MAVLink] Set {self.vehicles[vehicle_id].name} to {mode_upper}")
    
    def send_waypoint(self, vehicle_id: int, lat: float, lon: float, alt: float = 0):
        """Send a GUIDED mode waypoint to a vehicle."""
        conn = self.connections.get(vehicle_id)
        if conn:
            conn.mav.set_position_target_global_int_send(
                0,  # time_boot_ms
                conn.target_system,
                conn.target_component,
                mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT_INT,
                0b0000111111111000,  # type_mask (position only)
                int(lat * 1e7),
                int(lon * 1e7),
                alt,
                0, 0, 0,  # velocity
                0, 0, 0,  # acceleration
                0, 0,     # yaw, yaw_rate
            )
            print(f"[MAVLink] Waypoint sent to {self.vehicles[vehicle_id].name}: ({lat}, {lon})")
    
    def set_param(self, vehicle_id: int, param: str, value: float):
        """Set an ArduPilot parameter on a vehicle via PARAM_SET."""
        conn = self.connections.get(vehicle_id)
        if not conn:
            return
        # PARAM_SET requires the param_id as a 16-byte null-padded string
        param_id = param.encode('utf-8')
        conn.mav.param_set_send(
            conn.target_system,
            conn.target_component,
            param_id,
            float(value),
            mavutil.mavlink.MAV_PARAM_TYPE_REAL32,
        )
        print(f"[MAVLink] Set param {param}={value} on {self.vehicles[vehicle_id].name}")

    def upload_mission(self, vehicle_id: int, waypoints: list):
        """
        Upload a full mission (list of waypoints) to a vehicle.
        Each waypoint: {"lat": float, "lon": float, "alt": float}
        """
        conn = self.connections.get(vehicle_id)
        if not conn:
            return
        
        # Clear existing mission
        conn.waypoint_clear_all_send()
        
        # Create mission items
        mission_items = []
        for i, wp in enumerate(waypoints):
            if i == 0:
                # First item is HOME
                item = mavutil.mavlink.MAVLink_mission_item_int_message(
                    conn.target_system, conn.target_component,
                    i, mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
                    mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
                    0, 1,  # current, autocontinue
                    0, 0, 0, 0,
                    int(wp["lat"] * 1e7), int(wp["lon"] * 1e7),
                    wp.get("alt", 0)
                )
            else:
                item = mavutil.mavlink.MAVLink_mission_item_int_message(
                    conn.target_system, conn.target_component,
                    i, mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
                    mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
                    0, 1,
                    0, 5, 0, 0,  # hold time, acceptance radius
                    int(wp["lat"] * 1e7), int(wp["lon"] * 1e7),
                    wp.get("alt", 0)
                )
            mission_items.append(item)
        
        # Send count
        conn.waypoint_count_send(len(mission_items))
        
        print(f"[MAVLink] Uploaded {len(mission_items)} waypoints to {self.vehicles[vehicle_id].name}")

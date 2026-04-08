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
import json
from typing import Dict, Optional, Callable

from pymavlink import mavutil

from core.vehicle import Vehicle, GPSPosition, Attitude

DEBUG_LOG_PATH = r"d:\Drone Projects\USV Swarm Autonomous Fleet GCS Prototype\debug-af8cae.log"


def _debug_log(location: str, message: str, data: dict, hypothesis_id: str, run_id: str):
    try:
        with open(DEBUG_LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "sessionId": "af8cae",
                "runId": run_id,
                "hypothesisId": hypothesis_id,
                "location": location,
                "message": message,
                "data": data,
                "timestamp": int(time.time() * 1000),
            }, ensure_ascii=False) + "\n")
    except Exception:
        pass


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
        self._heartbeat_tick = 0
        self._pending_missions: Dict[int, list] = {}  # vehicle_id -> list of raw waypoint dicts
        self._streams_requested: set = set()  # vehicle_ids that have had data streams requested
        self._simulated_failures: set = set()  # vehicle_ids that are force-killed via simulate_failure
    
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
            conn = mavutil.mavlink_connection(connection_string)
            self.connections[vehicle_id] = conn
            self.vehicles[vehicle_id].connected = True  # UDP socket bound
            print(f"[MAVLink] Connected to {self.vehicles[vehicle_id].name}")
        except Exception as e:
            print(f"[MAVLink] Failed to connect {vehicle_id}: {e}")
    
    async def start(self):
        """Start receiving telemetry from all vehicles."""
        self._running = True
        self._heartbeat_tick = 0
        print(f"[MAVLink] Starting telemetry loop for {len(self.vehicles)} vehicles...")

        while self._running:
            self._heartbeat_tick += 1
            send_hb = (self._heartbeat_tick % 10 == 0)  # every 10 × 100 ms = 1 Hz

            for vid, conn in self.connections.items():
                try:
                    # Send GCS heartbeat so SITL recognises us as a ground station
                    if send_hb:
                        conn.mav.heartbeat_send(
                            mavutil.mavlink.MAV_TYPE_GCS,
                            mavutil.mavlink.MAV_AUTOPILOT_INVALID,
                            0, 0, 0,
                        )
                    # Non-blocking read of ALL pending messages
                    while True:
                        msg = conn.recv_match(blocking=False)
                        if not msg:
                            break
                        self._process_message(vid, msg)
                except Exception:
                    pass  # Connection might not be ready yet

            # Notify callback
            if self.on_vehicle_update:
                await self.on_vehicle_update(self.get_all_states())

            await asyncio.sleep(0.1)  # 10 Hz update rate
    
    def stop(self):
        """Stop the telemetry loop."""
        self._running = False

    def mark_failed(self, vehicle_id: int):
        """Block SITL heartbeat processing for a simulated-failed vehicle."""
        self._simulated_failures.add(vehicle_id)

    def mark_restored(self, vehicle_id: int):
        """Re-enable SITL heartbeat processing after a simulated restore."""
        self._simulated_failures.discard(vehicle_id)
    
    def _process_message(self, vehicle_id: int, msg):
        """Process a single MAVLink message and update vehicle state."""
        vehicle = self.vehicles[vehicle_id]
        msg_type = msg.get_type()
        
        if msg_type == "HEARTBEAT":
            if vehicle_id in self._simulated_failures:
                return  # This vehicle is force-killed; ignore SITL heartbeats until restored
            if not vehicle.connected:
                print(f"[MAVLink] SITL heartbeat received from {vehicle.name} — link established")
            vehicle.connected = True
            vehicle.last_heartbeat = time.time()
            # Request telemetry streams on the first heartbeat from each vehicle
            if vehicle_id not in self._streams_requested:
                self._streams_requested.add(vehicle_id)
                self._request_data_streams(vehicle_id)
            vehicle.armed = (msg.base_mode & mavutil.mavlink.MAV_MODE_FLAG_SAFETY_ARMED) != 0
            # Decode flight mode — fall back to rover mapping if pymavlink returns None
            # (happens for MAV_TYPE_SURFACE_BOAT which has no entry in pymavlink's table)
            mode_mapping = self.connections[vehicle_id].mode_mapping() or _ROVER_MODE_MAPPING
            reverse_map = {v: k for k, v in mode_mapping.items()}
            vehicle.mode = reverse_map.get(msg.custom_mode, f"MODE_{msg.custom_mode}")
        
        elif msg_type == "GLOBAL_POSITION_INT":
            new_lat = msg.lat / 1e7
            new_lon = msg.lon / 1e7
            if vehicle.position.lat == 0 and new_lat != 0:
                print(f"[MAVLink] First GPS fix for {vehicle.name}: ({new_lat:.6f}, {new_lon:.6f})")
            vehicle.position.lat = new_lat
            vehicle.position.lon = new_lon
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

        elif msg_type in ("MISSION_REQUEST", "MISSION_REQUEST_INT"):
            # SITL is requesting mission item seq — build and send it now so
            # conn.target_system is always current and the message type matches.
            seq = msg.seq
            pending = self._pending_missions.get(vehicle_id)
            if pending is not None and seq < len(pending):
                conn = self.connections[vehicle_id]
                wp = pending[seq]
                hold = float(wp.get("holdTime", 0) or 0)
                radius = float(wp.get("radius", 5) or 5)
                alt = float(wp.get("alt", 0) or 0)
                lat_int = int(wp["lat"] * 1e7)
                lon_int = int(wp["lon"] * 1e7)
                # Respond with MISSION_ITEM_INT for both request variants.
                # seq=0 is always the home reference (current=0, not a nav target).
                # seq=1 is the first real navigation waypoint (current=1).
                conn.mav.mission_item_int_send(
                    conn.target_system,
                    conn.target_component,
                    seq,
                    mavutil.mavlink.MAV_FRAME_GLOBAL_RELATIVE_ALT,
                    mavutil.mavlink.MAV_CMD_NAV_WAYPOINT,
                    1 if seq == 1 else 0,  # current: first nav WP is seq=1
                    1,                     # autocontinue
                    hold, radius, 0, 0,    # param1-4
                    lat_int, lon_int, alt,
                )
                print(f"[MAVLink] Sent mission item {seq}/{len(pending)-1} to {vehicle.name}")

        elif msg_type == "MISSION_ACK":
            if msg.type == 0:  # MAV_MISSION_ACCEPTED
                print(f"[MAVLink] Mission accepted by {vehicle.name}")
                # Point ArduRover at seq=1 — the first real nav waypoint.
                # seq=0 is our home reference; skipping it ensures the boat navigates
                # to the user's first waypoint rather than bouncing back to home first.
                conn = self.connections[vehicle_id]
                conn.mav.mission_set_current_send(conn.target_system, conn.target_component, 1)
            else:
                print(f"[MAVLink] Mission rejected by {vehicle.name} (type={msg.type})")
            self._pending_missions.pop(vehicle_id, None)

        elif msg_type == "COMMAND_ACK":
            cmd = msg.command
            result = msg.result
            # MAV_RESULT: 0=ACCEPTED, 1=TEMPORARILY_REJECTED, 2=DENIED, 3=UNSUPPORTED, 4=FAILED
            _MAV_RESULT = {0: "ACCEPTED", 1: "TEMP_REJECTED", 2: "DENIED", 3: "UNSUPPORTED", 4: "FAILED"}
            result_str = _MAV_RESULT.get(result, f"RESULT_{result}")
            if cmd == mavutil.mavlink.MAV_CMD_COMPONENT_ARM_DISARM:
                print(f"[MAVLink] ARM {result_str} for {vehicle.name}")
                if result != 0:
                    vehicle.armed = False  # Correct local state if arm was rejected
            elif cmd == mavutil.mavlink.MAV_CMD_DO_SET_MODE:
                print(f"[MAVLink] MODE CHANGE {result_str} for {vehicle.name}")
            elif cmd == mavutil.mavlink.MAV_CMD_MISSION_START:
                print(f"[MAVLink] MISSION START {result_str} for {vehicle.name}")
    
    def _request_data_streams(self, vehicle_id: int):
        """Ask ArduPilot to start streaming all telemetry we need."""
        conn = self.connections.get(vehicle_id)
        if not conn:
            return
        for stream_id in [
            mavutil.mavlink.MAV_DATA_STREAM_RAW_SENSORS,     # GPS_RAW_INT
            mavutil.mavlink.MAV_DATA_STREAM_EXTENDED_STATUS,  # SYS_STATUS
            mavutil.mavlink.MAV_DATA_STREAM_POSITION,         # GLOBAL_POSITION_INT
            mavutil.mavlink.MAV_DATA_STREAM_EXTRA1,           # ATTITUDE
            mavutil.mavlink.MAV_DATA_STREAM_EXTRA2,           # VFR_HUD
        ]:
            conn.mav.request_data_stream_send(
                conn.target_system,
                conn.target_component,
                stream_id,
                10,  # 10 Hz
                1,   # start streaming
            )
        print(f"[MAVLink] Data streams requested for {self.vehicles[vehicle_id].name}")

    def get_vehicle(self, vehicle_id: int) -> Optional[Vehicle]:
        """Get a vehicle by ID."""
        return self.vehicles.get(vehicle_id)
    
    def get_all_states(self) -> list:
        """Get serialized state of all vehicles."""
        return [v.to_dict() for v in self.vehicles.values()]
    
    # ─── Commands ──────────────────────────────────────────────
    
    def arm_vehicle(self, vehicle_id: int):
        """Arm a vehicle's motors."""
        self.vehicles[vehicle_id].armed = True
        print(f"[MAVLink] Arming {self.vehicles[vehicle_id].name}")
        conn = self.connections.get(vehicle_id)
        if conn:
            conn.arducopter_arm()

    def disarm_vehicle(self, vehicle_id: int):
        """Disarm a vehicle's motors."""
        self.vehicles[vehicle_id].armed = False
        print(f"[MAVLink] Disarming {self.vehicles[vehicle_id].name}")
        conn = self.connections.get(vehicle_id)
        if conn:
            conn.arducopter_disarm()

    def set_mode(self, vehicle_id: int, mode: str):
        """Set flight mode (MANUAL, GUIDED, AUTO, etc.)."""
        mode_upper = mode.upper()
        self.vehicles[vehicle_id].mode = mode_upper
        conn = self.connections.get(vehicle_id)
        if not conn:
            print(f"[MAVLink] Set {self.vehicles[vehicle_id].name} to {mode_upper} (no SITL)")
            return
        # Fall back to rover mapping so we never crash on None
        mode_mapping = conn.mode_mapping() or _ROVER_MODE_MAPPING
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

    def set_mission_current(self, vehicle_id: int, seq: int = 0):
        """Tell ArduPilot which mission item to execute next (resets mission pointer)."""
        conn = self.connections.get(vehicle_id)
        if conn:
            conn.mav.mission_set_current_send(conn.target_system, conn.target_component, seq)

    def upload_mission(self, vehicle_id: int, waypoints: list) -> bool:
        """
        Upload a full mission (list of waypoints) to a vehicle.
        Each waypoint: {"lat": float, "lon": float, "alt": float}
        Returns True if the handshake was initiated, False if no connection.

        ArduRover mission convention:
          seq=0  — Home reference waypoint (vehicle's current GPS position).
                   ArduRover's AUTO mode entry check requires num_commands() >= 2,
                   so even a single-waypoint mission works once home is prepended.
          seq=1+ — Actual navigation waypoints (user-supplied).

        MISSION_SET_CURRENT(1) is sent on MISSION_ACK to skip the home item
        and begin navigation at the first real waypoint.

        NOTE: We do NOT send MISSION_CLEAR_ALL before MISSION_COUNT.
        MISSION_CLEAR_ALL generates its own MISSION_ACK response which arrives
        before the upload handshake starts and would pop _pending_missions,
        leaving MISSION_REQUEST with no items to send (silent upload failure).
        """
        conn = self.connections.get(vehicle_id)
        if not conn:
            return False

        vehicle = self.vehicles.get(vehicle_id)
        home_lat = vehicle.position.lat if (vehicle and vehicle.position.lat != 0) else 0.0
        home_lon = vehicle.position.lon if (vehicle and vehicle.position.lon != 0) else 0.0

        # Prepend home item so ArduRover has a valid reference at seq=0.
        # Navigation starts at seq=1 (first user waypoint) via MISSION_SET_CURRENT(1).
        full_mission = [{"lat": home_lat, "lon": home_lon, "alt": 0, "holdTime": 0, "radius": 1}] + list(waypoints)

        self._pending_missions[vehicle_id] = full_mission

        # Initiate MAVLink mission upload handshake (no preceding CLEAR_ALL)
        conn.waypoint_count_send(len(full_mission))

        print(f"[MAVLink] Mission handshake started for {self.vehicles[vehicle_id].name} ({len(waypoints)} waypoints + home)")
        return True

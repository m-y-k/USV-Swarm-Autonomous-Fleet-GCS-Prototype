"""
Fleet Manager — The central orchestrator that ties together:
  - MAVLink telemetry from ArduPilot SITL boats
  - Mesh network topology and routing
  - Leader election
  - Mission coordination
  - Event logging
  - GNSS-denied simulation
  - Demo sequence automation
"""
import asyncio
import time
from typing import Dict, List, Optional, Callable

from core.mavlink_manager import MAVLinkManager
from mesh.mesh_network import MeshNetwork


class FleetManager:
    """
    Central fleet orchestrator.
    Connects MAVLink vehicles to the mesh network layer.
    """
    
    def __init__(self, on_state_update: Optional[Callable] = None):
        self.mavlink = MAVLinkManager()
        self.mesh = MeshNetwork()
        self.on_state_update = on_state_update
        self._running = False
        
        # Event log — in-memory list of all events
        self.event_log: List[dict] = []
        self._max_events = 500
        
        # GNSS-denied state per vehicle
        self.gps_denied: Dict[int, dict] = {}
    
    def _log_event(self, category: str, message: str, level: str = "info"):
        """Add an event to the log."""
        entry = {
            "time": time.time(),
            "category": category,
            "message": message,
            "level": level,
        }
        self.event_log.append(entry)
        if len(self.event_log) > self._max_events:
            self.event_log = self.event_log[-self._max_events:]
        print(f"[Event][{category}] {message}")
    
    def add_boat(self, vehicle_id: int, connection_string: str):
        """Register a boat in both MAVLink and Mesh systems."""
        self.mavlink.add_vehicle(vehicle_id, connection_string)
        self.mesh.add_node(vehicle_id)
        self._log_event("system", f"Vehicle USV-{vehicle_id:02d} added to fleet")
    
    async def start(self):
        """Start all subsystems."""
        self._running = True
        self._log_event("system", "Fleet manager starting...")
        print("[Fleet] Starting fleet manager...")
        
        # Run MAVLink, Mesh, and state broadcast concurrently
        await asyncio.gather(
            self.mavlink.start(),
            self.mesh.run(),
            self._sync_loop(),
            self._broadcast_loop(),
        )
    
    async def _sync_loop(self):
        """Sync MAVLink telemetry data into mesh network nodes."""
        while self._running:
            for vid, vehicle in self.mavlink.vehicles.items():
                if vehicle.connected and vehicle.position.lat != 0:
                    # Update mesh node position from MAVLink GPS
                    self.mesh.update_node_position(
                        vid,
                        vehicle.position.lat,
                        vehicle.position.lon
                    )
                    
                    # Sync leader status back to vehicle
                    if vid in self.mesh.peers:
                        vehicle.is_leader = self.mesh.peers[vid].is_leader
                        vehicle.mesh_peers = self.mesh.peers[vid].direct_peers
                        vehicle.signal_strength = self.mesh.peers[vid].signal_strength
                
                # Update GNSS-denied dead reckoning positions
                if vid in self.gps_denied and self.gps_denied[vid]["active"]:
                    dr_state = self.gps_denied[vid]
                    elapsed = time.time() - dr_state["start_time"]
                    speed = dr_state.get("last_speed", 0)
                    heading_rad = dr_state.get("last_heading_rad", 0)
                    
                    import math
                    R = 6371000
                    d_north = speed * elapsed * math.cos(heading_rad)
                    d_east = speed * elapsed * math.sin(heading_rad)
                    
                    dr_state["estimated_lat"] = dr_state["last_lat"] + (d_north / R) * (180 / math.pi)
                    dr_state["estimated_lon"] = dr_state["last_lon"] + (d_east / (R * math.cos(math.radians(dr_state["last_lat"])))) * (180 / math.pi)
                    # Uncertainty grows over time: ~10m/s uncertainty growth
                    dr_state["uncertainty_radius"] = min(10 * elapsed + 20, 2000)
            
            await asyncio.sleep(0.2)
    
    async def _broadcast_loop(self):
        """Send full state to frontend via callback."""
        while self._running:
            if self.on_state_update:
                state = self.get_full_state()
                await self.on_state_update(state)
            
            await asyncio.sleep(0.2)  # 5 Hz update to frontend
    
    def get_full_state(self) -> dict:
        """Get complete fleet state for the frontend dashboard."""
        # Build GNSS-denied state for frontend
        gnss_state = {}
        for vid, gs in self.gps_denied.items():
            if gs.get("active"):
                gnss_state[vid] = {
                    "active": True,
                    "estimatedLat": gs.get("estimated_lat", 0),
                    "estimatedLon": gs.get("estimated_lon", 0),
                    "uncertaintyRadius": gs.get("uncertainty_radius", 20),
                    "elapsedSeconds": time.time() - gs.get("start_time", time.time()),
                }
        
        return {
            "timestamp": time.time(),
            "vehicles": self.mavlink.get_all_states(),
            "mesh": self.mesh.get_state(),
            "gnss_denied": gnss_state,
            "events": self.event_log[-50:],
        }
    
    # ─── Commands (called from WebSocket API) ──────────────────
    
    def arm(self, vehicle_id: int):
        self.mavlink.arm_vehicle(vehicle_id)
        self._log_event("command", f"Armed USV-{vehicle_id:02d}")
    
    def disarm(self, vehicle_id: int):
        self.mavlink.disarm_vehicle(vehicle_id)
        self._log_event("command", f"Disarmed USV-{vehicle_id:02d}")
    
    def set_mode(self, vehicle_id: int, mode: str):
        self.mavlink.set_mode(vehicle_id, mode)
        self._log_event("command", f"USV-{vehicle_id:02d} mode set to {mode}")
    
    def send_waypoint(self, vehicle_id: int, lat: float, lon: float):
        self.mavlink.send_waypoint(vehicle_id, lat, lon)
        self._log_event("mission", f"Waypoint sent to USV-{vehicle_id:02d}: ({lat:.6f}, {lon:.6f})")
    
    def upload_mission(self, vehicle_id: int, waypoints: list):
        self.mavlink.upload_mission(vehicle_id, waypoints)
        self._log_event("mission", f"Mission uploaded to USV-{vehicle_id:02d}: {len(waypoints)} waypoints")
    
    def simulate_failure(self, vehicle_id: int):
        """Simulate a vessel failure for demo."""
        self.mesh.simulate_link_drop(vehicle_id)
        self._log_event("system", f"Simulated failure on USV-{vehicle_id:02d}", "warning")
    
    def simulate_restore(self, vehicle_id: int):
        """Restore a vessel from simulated failure."""
        self.mesh.simulate_link_restore(vehicle_id)
        self._log_event("system", f"Restored USV-{vehicle_id:02d}")
    
    def set_param(self, vehicle_id: int, param: str, value: float):
        """Set an ArduPilot parameter via MAVLink."""
        self.mavlink.set_param(vehicle_id, param, value)
        self._log_event("command", f"Set param {param}={value} on USV-{vehicle_id:02d}")
    
    def simulate_gps_loss(self, vehicle_id: int):
        """Simulate GPS loss — begin dead reckoning."""
        import math
        vehicle = self.mavlink.vehicles.get(vehicle_id)
        if vehicle:
            self.gps_denied[vehicle_id] = {
                "active": True,
                "start_time": time.time(),
                "last_lat": vehicle.position.lat,
                "last_lon": vehicle.position.lon,
                "last_speed": vehicle.groundspeed or 0,
                "last_heading_rad": math.radians(vehicle.heading or 0),
                "estimated_lat": vehicle.position.lat,
                "estimated_lon": vehicle.position.lon,
                "uncertainty_radius": 20,
            }
            self._log_event("system", f"GPS loss simulated on USV-{vehicle_id:02d}", "error")
    
    def simulate_gps_restore(self, vehicle_id: int):
        """Restore GPS on a vehicle."""
        if vehicle_id in self.gps_denied:
            self.gps_denied[vehicle_id]["active"] = False
            self._log_event("system", f"GPS restored on USV-{vehicle_id:02d}")
    
    def set_mesh_range(self, range_m: float):
        """Dynamically adjust mesh maximum range."""
        if hasattr(self.mesh, 'max_range'):
            self.mesh.max_range = range_m
            self._log_event("mesh", f"Mesh range adjusted to {range_m}m")
    
    async def run_demo_sequence(self):
        """
        Automated demo sequence per spec §4.9:
        0s  — All boats active, leader identified
        5s  — Upload patrol mission, start AUTO mode
        15s — Simulate leader failure
        25s — Fleet continues patrol
        35s — Restore failed vessel
        50s — Demo complete
        """
        self._log_event("system", "🎬 Demo sequence started")
        
        vehicles = list(self.mavlink.vehicles.keys())
        if len(vehicles) < 2:
            self._log_event("system", "Demo requires at least 2 vehicles", "warning")
            return
        
        # 0s — Log initial state
        leader_id = None
        for vid, peer in self.mesh.peers.items():
            if peer.is_leader:
                leader_id = vid
                break
        if leader_id is None:
            leader_id = max(vehicles)
        self._log_event("system", f"Demo: All {len(vehicles)} boats active, USV-{leader_id:02d} is leader")
        
        # 5s — Upload patrol and start AUTO
        await asyncio.sleep(5)
        self._log_event("mission", "Demo: Uploading patrol missions to fleet")
        center_lat, center_lon = -33.8568, 151.2153
        for vid in vehicles:
            wps = [
                {"lat": center_lat - 0.002, "lon": center_lon - 0.002 + vid * 0.001, "alt": 0},
                {"lat": center_lat + 0.002, "lon": center_lon + 0.002 + vid * 0.001, "alt": 0},
                {"lat": center_lat, "lon": center_lon + 0.003 + vid * 0.001, "alt": 0},
            ]
            self.upload_mission(vid, wps)
        
        await asyncio.sleep(2)
        for vid in vehicles:
            self.set_mode(vid, "AUTO")
        
        # 15s — Simulate leader failure
        await asyncio.sleep(8)
        self._log_event("system", f"Demo: Simulating failure on leader USV-{leader_id:02d}", "warning")
        self.simulate_failure(leader_id)
        
        # 18s — Election should happen automatically via mesh layer
        await asyncio.sleep(3)
        self._log_event("system", "Demo: Election triggered, waiting for new leader...")
        
        # 25s — Fleet continues
        await asyncio.sleep(7)
        remaining = [v for v in vehicles if v != leader_id]
        self._log_event("system", f"Demo: Remaining boats continuing patrol seamlessly")
        
        # 35s — Restore
        await asyncio.sleep(10)
        self._log_event("system", f"Demo: Restoring USV-{leader_id:02d}")
        self.simulate_restore(leader_id)
        
        # 50s — Demo complete
        await asyncio.sleep(15)
        self._log_event("system", "🎬 Demo sequence completed")

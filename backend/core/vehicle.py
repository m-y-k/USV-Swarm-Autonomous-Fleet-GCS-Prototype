"""
Vehicle state model — represents a single USV's current state.
All telemetry received via MAVLink is stored here.
"""
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class GPSPosition:
    lat: float = 0.0
    lon: float = 0.0
    alt: float = 0.0
    fix_type: int = 0  # 0=no fix, 2=2D, 3=3D
    satellites: int = 0


@dataclass
class Attitude:
    roll: float = 0.0   # degrees
    pitch: float = 0.0  # degrees
    yaw: float = 0.0    # degrees (heading)


@dataclass
class Vehicle:
    vehicle_id: int
    name: str = ""
    
    # Connection
    connected: bool = False
    last_heartbeat: float = 0.0
    mavlink_port: int = 0
    
    # Position & Motion
    position: GPSPosition = field(default_factory=GPSPosition)
    attitude: Attitude = field(default_factory=Attitude)
    groundspeed: float = 0.0  # m/s
    heading: float = 0.0      # degrees 0-360
    
    # System Status
    armed: bool = False
    mode: str = "MANUAL"
    battery_voltage: float = 0.0
    battery_remaining: int = 100  # percentage
    
    # Mesh Network
    is_leader: bool = False
    mesh_peers: list = field(default_factory=list)  # IDs of reachable peers
    signal_strength: dict = field(default_factory=dict)  # peer_id -> strength (0-100)
    
    def __post_init__(self):
        if not self.name:
            self.name = f"USV-{self.vehicle_id:02d}"
    
    @property
    def is_alive(self) -> bool:
        """Vehicle is alive if heartbeat received within last 5 seconds."""
        return (time.time() - self.last_heartbeat) < 5.0
    
    @property
    def connection_age(self) -> float:
        """Seconds since last heartbeat."""
        return time.time() - self.last_heartbeat
    
    def to_dict(self) -> dict:
        """Serialize to dict for WebSocket transmission."""
        return {
            "id": self.vehicle_id,
            "name": self.name,
            "connected": self.connected,
            "is_alive": self.is_alive,
            "position": {
                "lat": self.position.lat,
                "lon": self.position.lon,
                "alt": self.position.alt,
                "fix_type": self.position.fix_type,
                "satellites": self.position.satellites,
            },
            "heading": self.heading,
            "groundspeed": round(self.groundspeed, 2),
            "attitude": {
                "roll": round(self.attitude.roll, 1),
                "pitch": round(self.attitude.pitch, 1),
                "yaw": round(self.attitude.yaw, 1),
            },
            "armed": self.armed,
            "mode": self.mode,
            "battery": {
                "voltage": round(self.battery_voltage, 1),
                "remaining": self.battery_remaining,
            },
            "mesh": {
                "is_leader": self.is_leader,
                "peers": self.mesh_peers,
                "signal_strength": self.signal_strength,
            },
        }

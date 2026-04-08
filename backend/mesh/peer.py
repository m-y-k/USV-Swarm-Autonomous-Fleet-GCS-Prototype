"""
Peer — represents a single node in the mesh network.
Each USV is a peer. The GCS can also be a peer (node_id=0).
"""
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from enum import Enum


class PeerState(str, Enum):
    ACTIVE = "active"
    DEGRADED = "degraded"     # High latency / weak signal
    UNREACHABLE = "unreachable"
    OFFLINE = "offline"


@dataclass
class MeshMessage:
    """A message routed through the mesh network."""
    msg_id: str
    source_id: int
    dest_id: int          # -1 for broadcast
    msg_type: str         # "heartbeat", "telemetry", "command", "election", "relay"
    payload: dict
    hops: List[int] = field(default_factory=list)  # Node IDs this message traversed
    ttl: int = 5          # Max hops before message is dropped
    timestamp: float = field(default_factory=time.time)


@dataclass
class Peer:
    """A node in the mesh network."""
    node_id: int
    name: str = ""
    lat: float = 0.0
    lon: float = 0.0
    state: PeerState = PeerState.OFFLINE
    last_heartbeat: float = 0.0
    
    # Which peers can this node directly reach?
    direct_peers: List[int] = field(default_factory=list)
    
    # Signal strength to each direct peer (0-100)
    signal_strength: Dict[int, float] = field(default_factory=dict)
    
    # Message queue for this peer
    outbox: List[MeshMessage] = field(default_factory=list)
    inbox: List[MeshMessage] = field(default_factory=list)
    
    # Leader election
    is_leader: bool = False
    voted_for: Optional[int] = None
    election_term: int = 0
    
    def __post_init__(self):
        if not self.name:
            self.name = f"NODE-{self.node_id:02d}"
    
    @property
    def is_alive(self) -> bool:
        return (time.time() - self.last_heartbeat) < 3.0
    
    def update_position(self, lat: float, lon: float):
        self.lat = lat
        self.lon = lon
    
    def to_dict(self) -> dict:
        return {
            "node_id": self.node_id,
            "name": self.name,
            "lat": self.lat,
            "lon": self.lon,
            "state": self.state.value,
            "is_alive": self.is_alive,
            "direct_peers": self.direct_peers,
            "signal_strength": self.signal_strength,
            "is_leader": self.is_leader,
            "election_term": self.election_term,
        }

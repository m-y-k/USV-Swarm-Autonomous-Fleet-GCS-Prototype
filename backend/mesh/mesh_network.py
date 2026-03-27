"""
Mesh Network — Simulates peer-to-peer communication between USVs.

In production: this would run on actual mesh radios (Rajant, Silvus, etc.)
In simulation: signal strength is calculated from GPS distance between boats.

Features:
  - Distance-based signal strength calculation
  - Automatic peer discovery
  - Multi-hop message routing (if A can't reach C, route through B)
  - Link quality degradation and failure simulation
  - Topology graph for UI visualization
"""
import asyncio
import math
import time
import uuid
from typing import Dict, List, Optional, Tuple, Callable

from mesh.peer import Peer, PeerState, MeshMessage
from mesh.leader_election import LeaderElection


# ─── Configuration ─────────────────────────────────────────
MESH_CONFIG = {
    "max_range_meters": 2000,       # Max comm range in meters
    "strong_signal_range": 500,     # Range for strong signal (>80%)
    "degraded_range": 1500,         # Range where signal degrades (40-80%)
    "heartbeat_interval": 1.0,      # Seconds between mesh heartbeats
    "peer_timeout": 5.0,            # Seconds before peer is considered lost
    "max_hops": 5,                  # Max relay hops for a message
}


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two GPS coordinates."""
    R = 6371000  # Earth's radius in meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    
    a = (math.sin(dphi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c


def calculate_signal_strength(distance_m: float) -> float:
    """
    Calculate signal strength (0-100) based on distance.
    Models a realistic signal decay curve.
    """
    max_range = MESH_CONFIG["max_range_meters"]
    strong_range = MESH_CONFIG["strong_signal_range"]
    
    if distance_m <= 0:
        return 100.0
    if distance_m >= max_range:
        return 0.0
    if distance_m <= strong_range:
        # Strong signal zone: 80-100%
        return 100.0 - (distance_m / strong_range) * 20.0
    
    # Degradation zone: exponential decay from 80% to 0%
    normalized = (distance_m - strong_range) / (max_range - strong_range)
    return max(0.0, 80.0 * (1.0 - normalized ** 1.5))


class MeshNetwork:
    """
    Manages the mesh network topology between USV nodes.
    Handles peer discovery, signal simulation, message routing, and leader election.
    """
    
    def __init__(self, on_topology_change: Optional[Callable] = None):
        self.peers: Dict[int, Peer] = {}
        self.leader_election = LeaderElection(on_leader_change=self._on_leader_change)
        self.on_topology_change = on_topology_change
        
        # Message routing table: dest_id -> next_hop_id
        self.routing_table: Dict[int, int] = {}
        
        # Network statistics
        self.stats = {
            "messages_sent": 0,
            "messages_relayed": 0,
            "messages_dropped": 0,
            "elections_held": 0,
        }
        
        # Topology edges for UI visualization
        self.edges: List[dict] = []
        
        # Event log
        self.network_log: List[dict] = []
    
    def add_node(self, node_id: int, lat: float = 0.0, lon: float = 0.0):
        """Add a USV as a mesh network node."""
        peer = Peer(node_id=node_id, lat=lat, lon=lon)
        peer.last_heartbeat = time.time()
        peer.state = PeerState.ACTIVE
        self.peers[node_id] = peer
        self.leader_election.register_peer(peer)
        self._log(f"Node {peer.name} joined mesh network")
    
    def update_node_position(self, node_id: int, lat: float, lon: float):
        """Update a node's GPS position (called from MAVLink telemetry)."""
        if node_id in self.peers:
            self.peers[node_id].update_position(lat, lon)
            self.peers[node_id].last_heartbeat = time.time()
            self.peers[node_id].state = PeerState.ACTIVE
    
    async def run(self):
        """Main mesh network loop — runs topology updates and leader monitoring."""
        # Start leader election monitor in background
        asyncio.create_task(self.leader_election.monitor_leader())
        
        while True:
            self._update_topology()
            self._update_routing_table()
            self._process_message_queues()
            
            if self.on_topology_change:
                await self.on_topology_change(self.get_state())
            
            await asyncio.sleep(MESH_CONFIG["heartbeat_interval"])
    
    def _update_topology(self):
        """
        Recalculate mesh topology based on current positions.
        Determines which nodes can directly communicate.
        """
        self.edges = []
        alive_peers = [p for p in self.peers.values() if p.is_alive]
        
        for i, peer_a in enumerate(alive_peers):
            peer_a.direct_peers = []
            peer_a.signal_strength = {}
            
            for peer_b in alive_peers:
                if peer_a.node_id == peer_b.node_id:
                    continue
                
                # Calculate distance and signal
                dist = haversine_distance(
                    peer_a.lat, peer_a.lon,
                    peer_b.lat, peer_b.lon
                )
                signal = calculate_signal_strength(dist)
                
                if signal > 0:
                    peer_a.direct_peers.append(peer_b.node_id)
                    peer_a.signal_strength[peer_b.node_id] = round(signal, 1)
                    
                    # Add edge (avoid duplicates)
                    edge_key = tuple(sorted([peer_a.node_id, peer_b.node_id]))
                    existing = any(
                        (e["from"], e["to"]) == edge_key or (e["to"], e["from"]) == edge_key
                        for e in self.edges
                    )
                    if not existing:
                        self.edges.append({
                            "from": edge_key[0],
                            "to": edge_key[1],
                            "distance": round(dist, 1),
                            "signal": round(signal, 1),
                            "state": (
                                "strong" if signal > 70
                                else "degraded" if signal > 30
                                else "weak"
                            ),
                        })
                
                # Update peer state based on signal
                if signal > 70:
                    peer_a.state = PeerState.ACTIVE
                elif signal > 30:
                    peer_a.state = PeerState.DEGRADED
        
        # Check for offline peers
        for peer in self.peers.values():
            if not peer.is_alive:
                peer.state = PeerState.OFFLINE
                peer.direct_peers = []
                peer.signal_strength = {}
    
    def _update_routing_table(self):
        """
        Build routing table using BFS (shortest path in hops).
        For each destination, find the best next hop.
        """
        self.routing_table = {}
        
        for dest_id in self.peers:
            for source_id in self.peers:
                if source_id == dest_id:
                    continue
                
                # BFS from source to dest
                next_hop = self._find_next_hop(source_id, dest_id)
                if next_hop is not None:
                    key = (source_id, dest_id)
                    self.routing_table[key] = next_hop
    
    def _find_next_hop(self, source_id: int, dest_id: int) -> Optional[int]:
        """BFS to find next hop from source to destination."""
        if source_id not in self.peers or dest_id not in self.peers:
            return None
        
        visited = {source_id}
        queue = [(source_id, [source_id])]
        
        while queue:
            current, path = queue.pop(0)
            peer = self.peers.get(current)
            if not peer:
                continue
            
            for neighbor_id in peer.direct_peers:
                if neighbor_id == dest_id:
                    # Found! Return the first hop after source
                    return path[1] if len(path) > 1 else neighbor_id
                
                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    queue.append((neighbor_id, path + [neighbor_id]))
        
        return None  # No route found
    
    def send_message(self, source_id: int, dest_id: int, msg_type: str, payload: dict) -> bool:
        """
        Send a message through the mesh network.
        Returns True if message was routed, False if no route found.
        """
        msg = MeshMessage(
            msg_id=str(uuid.uuid4())[:8],
            source_id=source_id,
            dest_id=dest_id,
            msg_type=msg_type,
            payload=payload,
            hops=[source_id],
        )
        
        source = self.peers.get(source_id)
        if not source:
            return False
        
        # Check if destination is directly reachable
        if dest_id in source.direct_peers:
            dest = self.peers.get(dest_id)
            if dest:
                msg.hops.append(dest_id)
                dest.inbox.append(msg)
                self.stats["messages_sent"] += 1
                return True
        
        # Need to relay — find next hop
        route_key = (source_id, dest_id)
        next_hop_id = self.routing_table.get(route_key)
        
        if next_hop_id is not None:
            next_hop = self.peers.get(next_hop_id)
            if next_hop:
                msg.hops.append(next_hop_id)
                next_hop.outbox.append(msg)  # Goes to outbox for relay
                self.stats["messages_sent"] += 1
                self._log(f"Routing: {source_id} → {next_hop_id} → ... → {dest_id}")
                return True
        
        self.stats["messages_dropped"] += 1
        self._log(f"NO ROUTE: {source_id} → {dest_id} (message dropped)")
        return False
    
    def broadcast(self, source_id: int, msg_type: str, payload: dict):
        """Broadcast a message to all reachable peers."""
        for peer_id in self.peers:
            if peer_id != source_id:
                self.send_message(source_id, peer_id, msg_type, payload)
    
    def _process_message_queues(self):
        """Process relay queues — forward messages that need multi-hop routing."""
        for peer in self.peers.values():
            # Process outbox (messages to relay)
            while peer.outbox:
                msg = peer.outbox.pop(0)
                
                if msg.ttl <= 0:
                    self.stats["messages_dropped"] += 1
                    continue
                
                msg.ttl -= 1
                
                # Check if we're the destination
                if msg.dest_id == peer.node_id:
                    peer.inbox.append(msg)
                    continue
                
                # Forward to next hop
                route_key = (peer.node_id, msg.dest_id)
                next_hop_id = self.routing_table.get(route_key)
                
                if next_hop_id and next_hop_id in self.peers:
                    msg.hops.append(next_hop_id)
                    next_peer = self.peers[next_hop_id]
                    
                    if msg.dest_id == next_hop_id:
                        next_peer.inbox.append(msg)
                    else:
                        next_peer.outbox.append(msg)
                    
                    self.stats["messages_relayed"] += 1
            
            # Process inbox (received messages)
            while peer.inbox:
                msg = peer.inbox.pop(0)
                if msg.msg_type == "election":
                    # Peer received an election message from a lower ID node
                    self.leader_election.process_election_response(peer.node_id)
    
    # ─── Simulation Controls ───────────────────────────────────
    
    def simulate_link_drop(self, node_id: int):
        """Simulate a node losing all connections (for demo)."""
        if node_id in self.peers:
            peer = self.peers[node_id]
            peer.last_heartbeat = 0
            peer.state = PeerState.OFFLINE
            self._log(f"LINK DROP: {peer.name} lost all connections")
            
            # Trigger leader election if this was the leader
            self.leader_election.force_leader_failure(node_id)
    
    def simulate_link_restore(self, node_id: int):
        """Restore a node's connection (for demo)."""
        if node_id in self.peers:
            peer = self.peers[node_id]
            peer.last_heartbeat = time.time()
            peer.state = PeerState.ACTIVE
            self._log(f"LINK RESTORED: {peer.name} back online")
    
    # ─── State Export ──────────────────────────────────────────
    
    def get_state(self) -> dict:
        """Get full mesh network state for UI."""
        return {
            "nodes": {nid: p.to_dict() for nid, p in self.peers.items()},
            "edges": self.edges,
            "routing_table": {
                f"{k[0]}->{k[1]}": v for k, v in self.routing_table.items()
            },
            "leader": self.leader_election.get_state(),
            "stats": self.stats,
            "log": self.network_log[-30:],
        }
    
    def _on_leader_change(self, new_leader_id: int, old_leader_id: Optional[int]):
        """Callback when leader changes."""
        self.stats["elections_held"] += 1
        new_name = self.peers[new_leader_id].name if new_leader_id in self.peers else "?"
        old_name = self.peers[old_leader_id].name if old_leader_id and old_leader_id in self.peers else "None"
        self._log(f"LEADER CHANGE: {old_name} → {new_name}")
    
    def _log(self, message: str):
        entry = {"time": time.time(), "message": message}
        self.network_log.append(entry)
        print(f"[Mesh] {message}")

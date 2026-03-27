"""
Leader Election — Bully Algorithm for USV Fleet

How it works:
1. Each node has a unique ID (higher = higher priority)
2. When a node detects the leader is down, it starts an election
3. It sends ELECTION messages to all nodes with higher IDs
4. If no higher node responds, it becomes the leader
5. If a higher node responds, that node takes over the election
6. The winner sends VICTORY to all nodes

In USV context:
- Leader coordinates fleet movements
- Leader aggregates and relays telemetry to GCS
- If leader goes down (comms lost, hardware failure), a new leader is elected
- Election happens automatically with zero human intervention
"""
import asyncio
import time
import uuid
from typing import Dict, Optional, Callable, List

from mesh.peer import Peer, PeerState, MeshMessage


class LeaderElection:
    """Bully Algorithm implementation for mesh network leader election."""
    
    def __init__(self, on_leader_change: Optional[Callable] = None):
        self.peers: Dict[int, Peer] = {}
        self.current_leader_id: Optional[int] = None
        self.election_in_progress: bool = False
        self.election_timeout: float = 3.0  # seconds to wait for response
        self.heartbeat_timeout: float = 5.0  # seconds before leader is considered dead
        self.on_leader_change = on_leader_change
        
        # Election state
        self._election_start_time: float = 0
        self._waiting_for_response: bool = False
        self._election_initiator: Optional[int] = None
        
        # Log for UI
        self.election_log: List[dict] = []
    
    def register_peer(self, peer: Peer):
        """Add a peer to the election pool."""
        self.peers[peer.node_id] = peer
        self._log(f"Peer {peer.name} registered for election")
    
    def remove_peer(self, node_id: int):
        """Remove a peer (went offline)."""
        if node_id in self.peers:
            name = self.peers[node_id].name
            del self.peers[node_id]
            self._log(f"Peer {name} removed from election pool")
            
            # If removed peer was leader, trigger election
            if node_id == self.current_leader_id:
                self._log(f"Leader {name} went offline! Triggering election...")
                self.current_leader_id = None
                self.start_election()
    
    def start_election(self, initiator_id: Optional[int] = None):
        """
        Start a new leader election.
        
        If initiator_id is given, that node starts it.
        Otherwise, the lowest alive node that detects leader failure starts it.
        """
        if self.election_in_progress:
            return
        
        self.election_in_progress = True
        self._election_start_time = time.time()
        
        # Get all alive peers sorted by ID
        alive_peers = sorted(
            [p for p in self.peers.values() if p.is_alive],
            key=lambda p: p.node_id
        )
        
        if not alive_peers:
            self._log("No alive peers — election cancelled")
            self.election_in_progress = False
            return
        
        # Initiator is the lowest ID alive node (or specified)
        if initiator_id and initiator_id in self.peers:
            initiator = self.peers[initiator_id]
        else:
            initiator = alive_peers[0]
        
        self._election_initiator = initiator.node_id
        self._log(f"Election started by {initiator.name}")
        
        # Bully algorithm: send ELECTION to all higher-ID nodes
        higher_peers = [p for p in alive_peers if p.node_id > initiator.node_id]
        
        if not higher_peers:
            # No higher peers — initiator wins
            self._declare_winner(initiator.node_id)
            return
        
        # Send election messages to higher peers
        for peer in higher_peers:
            msg = MeshMessage(
                msg_id=str(uuid.uuid4())[:8],
                source_id=initiator.node_id,
                dest_id=peer.node_id,
                msg_type="election",
                payload={"term": initiator.election_term + 1},
            )
            peer.inbox.append(msg)
            self._log(f"ELECTION msg: {initiator.name} → {peer.name}")
        
        # Set timeout — if no response, initiator wins
        self._waiting_for_response = True
    
    def process_election_response(self, responder_id: int):
        """
        A higher-ID node responds to an election.
        This means the higher node takes over the election process.
        """
        if responder_id not in self.peers:
            return
        
        responder = self.peers[responder_id]
        self._log(f"ALIVE response from {responder.name} — taking over election")
        
        # The responder now runs its own election against even higher nodes
        alive_higher = [
            p for p in self.peers.values()
            if p.is_alive and p.node_id > responder_id
        ]
        
        if not alive_higher:
            self._declare_winner(responder_id)
        else:
            # Continue cascading up
            self._election_initiator = responder_id
            self._election_start_time = time.time()
            self._waiting_for_response = True
            for peer in alive_higher:
                msg = MeshMessage(
                    msg_id=str(uuid.uuid4())[:8],
                    source_id=responder_id,
                    dest_id=peer.node_id,
                    msg_type="election",
                    payload={"term": responder.election_term + 1},
                )
                peer.inbox.append(msg)
    
    def _declare_winner(self, winner_id: int):
        """Declare the election winner and notify all peers."""
        if winner_id not in self.peers:
            self.election_in_progress = False
            self._waiting_for_response = False
            return
        
        winner = self.peers[winner_id]
        old_leader = self.current_leader_id
        
        # Update all peers
        for peer in self.peers.values():
            peer.is_leader = (peer.node_id == winner_id)
            peer.election_term += 1
        
        self.current_leader_id = winner_id
        self.election_in_progress = False
        self._waiting_for_response = False
        
        # Send VICTORY broadcast
        for peer in self.peers.values():
            if peer.node_id != winner_id:
                msg = MeshMessage(
                    msg_id=str(uuid.uuid4())[:8],
                    source_id=winner_id,
                    dest_id=peer.node_id,
                    msg_type="victory",
                    payload={"leader_id": winner_id, "term": winner.election_term},
                )
                peer.inbox.append(msg)
        
        self._log(f"VICTORY: {winner.name} is the new leader (term {winner.election_term})")
        
        # Callback
        if self.on_leader_change and old_leader != winner_id:
            self.on_leader_change(winner_id, old_leader)
    
    async def monitor_leader(self):
        """
        Continuous loop: check if the leader is still alive.
        If leader heartbeat times out, start a new election.
        """
        while True:
            if self.current_leader_id is not None:
                leader = self.peers.get(self.current_leader_id)
                if leader and not leader.is_alive:
                    self._log(f"Leader {leader.name} heartbeat timeout!")
                    self.current_leader_id = None
                    self.start_election()
            
            # Check election timeout
            if self._waiting_for_response:
                elapsed = time.time() - self._election_start_time
                if elapsed > self.election_timeout:
                    # No response from higher nodes — initiator wins
                    if self._election_initiator is not None:
                        self._log("Election timeout — no response from higher nodes")
                        self._declare_winner(self._election_initiator)
                    self._waiting_for_response = False
            
            # If no leader and no election, start one
            if self.current_leader_id is None and not self.election_in_progress:
                alive = [p for p in self.peers.values() if p.is_alive]
                if alive:
                    self.start_election()
            
            await asyncio.sleep(1.0)
    
    def force_leader_failure(self, node_id: int):
        """
        Simulate a leader failure for demo purposes.
        Marks the node as offline and triggers re-election.
        """
        if node_id in self.peers:
            peer = self.peers[node_id]
            peer.last_heartbeat = 0  # Force timeout
            peer.state = PeerState.OFFLINE
            self._log(f"SIMULATED FAILURE: {peer.name} went offline")
            
            if node_id == self.current_leader_id:
                self.current_leader_id = None
                self.start_election()
    
    def get_state(self) -> dict:
        """Get full election state for UI."""
        return {
            "current_leader": self.current_leader_id,
            "election_in_progress": self.election_in_progress,
            "peers": {nid: p.to_dict() for nid, p in self.peers.items()},
            "log": self.election_log[-20:],  # Last 20 entries
        }
    
    def _log(self, message: str):
        """Add to election log."""
        entry = {"time": time.time(), "message": message}
        self.election_log.append(entry)
        print(f"[Election] {message}")

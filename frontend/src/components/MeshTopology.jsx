/**
 * MeshTopology — Network graph visualization.
 * Spec §4.3.4: SVG force graph showing nodes, edges, signal strength.
 */
import React, { useMemo } from 'react';
import { formatSignal, formatDistance } from '../utils/formatters';

export default function MeshTopology({ meshState, vehicles, selectedVehicleId }) {
  if (!meshState || !meshState.nodes) {
    return (
      <div className="mesh-topology-placeholder">
        <span className="telemetry-label">Waiting for mesh data...</span>
      </div>
    );
  }

  const nodes = Object.values(meshState.nodes || {});
  const edges = meshState.edges || [];
  const stats = meshState.stats || {};
  const leader = meshState.leader || {};

  // Arrange nodes in a circle layout
  const width = 100;
  const height = 100;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.32;

  const nodePositions = useMemo(() => {
    const positions = {};
    nodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1) - Math.PI / 2;
      positions[node.node_id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
    return positions;
  }, [nodes.length]);

  const getEdgeColor = (signal) => {
    if (signal > 70) return '#10b981';
    if (signal > 30) return '#f59e0b';
    return '#ef4444';
  };

  const getEdgeDash = (signal) => {
    if (signal > 70) return '';
    if (signal > 30) return '3,2';
    return '1,2';
  };

  const getNodeColor = (node) => {
    if (node.state === 'offline') return '#64748b';
    if (node.is_leader) return '#3b82f6';
    if (node.state === 'degraded') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="mesh-topology">
      <div className="mesh-graph-container">
        <svg viewBox="0 0 100 100" className="mesh-graph-svg">
          {/* Edges */}
          {edges.map((edge, i) => {
            const from = nodePositions[edge.from];
            const to = nodePositions[edge.to];
            if (!from || !to) return null;

            return (
              <g key={`edge-${i}`}>
                <line
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke={getEdgeColor(edge.signal)}
                  strokeWidth="0.6"
                  strokeDasharray={getEdgeDash(edge.signal)}
                  opacity="0.7"
                />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2 - 1.5}
                  textAnchor="middle"
                  fill="var(--text-dim)"
                  fontSize="3"
                  fontFamily="var(--font-mono)"
                >
                  {Math.round(edge.signal)}%
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map(node => {
            const pos = nodePositions[node.node_id];
            if (!pos) return null;
            const color = getNodeColor(node);
            const isSelected = selectedVehicleId === node.node_id;

            return (
              <g key={`node-${node.node_id}`}>
                {/* Glow */}
                <circle
                  cx={pos.x} cy={pos.y} r="7"
                  fill={color}
                  opacity="0.1"
                />
                {/* Selection ring */}
                {isSelected && (
                  <circle
                    cx={pos.x} cy={pos.y} r="8.5"
                    fill="none"
                    stroke="var(--accent-bright)"
                    strokeWidth="0.5"
                    opacity="0.8"
                  />
                )}
                {/* Node circle */}
                <circle
                  cx={pos.x} cy={pos.y} r="6"
                  fill="var(--bg-tertiary)"
                  stroke={color}
                  strokeWidth="1"
                />
                {/* Leader crown */}
                {node.is_leader && (
                  <text
                    x={pos.x} y={pos.y - 8}
                    textAnchor="middle"
                    fontSize="5"
                  >👑</text>
                )}
                {/* Node name */}
                <text
                  x={pos.x} y={pos.y + 1.2}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="3.2"
                  fontFamily="var(--font-mono)"
                  fontWeight="600"
                >
                  {node.name?.replace('NODE-', '')}
                </text>
                {/* State label */}
                <text
                  x={pos.x} y={pos.y + 12}
                  textAnchor="middle"
                  fill={color}
                  fontSize="2.5"
                  fontFamily="var(--font-display)"
                  textTransform="uppercase"
                >
                  {node.state}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Stats bar */}
      <div className="mesh-stats-bar">
        <div className="mesh-stat-item">
          <span className="telemetry-label">Sent</span>
          <span className="telemetry-value">{stats.messages_sent || 0}</span>
        </div>
        <div className="mesh-stat-item">
          <span className="telemetry-label">Relayed</span>
          <span className="telemetry-value">{stats.messages_relayed || 0}</span>
        </div>
        <div className="mesh-stat-item">
          <span className="telemetry-label">Dropped</span>
          <span className="telemetry-value">{stats.messages_dropped || 0}</span>
        </div>
        <div className="mesh-stat-item">
          <span className="telemetry-label">Elections</span>
          <span className="telemetry-value">{stats.elections_held || 0}</span>
        </div>
      </div>
    </div>
  );
}

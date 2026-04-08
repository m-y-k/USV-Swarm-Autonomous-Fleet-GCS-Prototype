/**
 * EventLog — Scrollable, filterable event log panel.
 * Spec §4.11: Timestamped entries with category filtering, search, export.
 * Phase 7: Added search, export (JSON/CSV), Command category.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

function categorizeMessage(msg, source) {
  if (!msg) return 'system';
  if (source === 'command') return 'command';
  const lower = msg.toLowerCase();
  if (lower.includes('election') || lower.includes('leader') || lower.includes('victory') || lower.includes('alive')) return 'election';
  if (lower.includes('mesh') || lower.includes('node') || lower.includes('link') || lower.includes('signal') || lower.includes('route')) return 'mesh';
  if (lower.includes('mission') || lower.includes('waypoint')) return 'mission';
  if (lower.includes('command') || lower.includes('armed') || lower.includes('disarmed') || lower.includes('mode set')) return 'command';
  if (lower.includes('failure') || lower.includes('offline') || lower.includes('drop') || lower.includes('error') || lower.includes('gps loss')) return 'error';
  if (lower.includes('restore') || lower.includes('online')) return 'info';
  return 'system';
}

const CATEGORY_COLORS = {
  system: 'var(--text-dim)',
  mesh: 'var(--accent)',
  election: 'var(--status-leader)',
  mission: 'var(--status-online)',
  command: 'var(--accent-bright)',
  error: 'var(--status-offline)',
  info: 'var(--text-secondary)',
};

const CATEGORY_LABELS = {
  all: 'All',
  system: 'System',
  mesh: 'Mesh',
  election: 'Election',
  mission: 'Mission',
  command: 'Command',
  error: 'Errors',
};

function formatLogTime(timestamp) {
  if (!timestamp) return '--:--:--';
  const d = new Date(timestamp * 1000);
  return d.toLocaleTimeString('en-GB', { hour12: false });
}

export default function EventLog({ meshState, connected, vehicleCount, events = [] }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logEndRef = useRef(null);
  const logBodyRef = useRef(null);

  // Combine all log sources
  const allLogs = [];

  // Backend events (from fleet_manager.event_log)
  if (events && events.length > 0) {
    events.forEach(entry => {
      allLogs.push({
        time: entry.time,
        message: entry.message,
        source: entry.category || 'system',
        level: entry.level || 'info',
      });
    });
  }

  // Mesh network log
  if (meshState?.log) {
    meshState.log.forEach(entry => {
      allLogs.push({ time: entry.time, message: entry.message, source: 'mesh' });
    });
  }

  // Election log
  if (meshState?.leader?.log) {
    meshState.leader.log.forEach(entry => {
      allLogs.push({ time: entry.time, message: entry.message, source: 'election' });
    });
  }

  // Deduplicate by time+message and sort
  const seen = new Set();
  const deduplicated = allLogs.filter(entry => {
    const key = `${entry.time?.toFixed(2)}-${entry.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  deduplicated.sort((a, b) => (a.time || 0) - (b.time || 0));

  // Apply category filter
  let filtered = filter === 'all'
    ? deduplicated
    : deduplicated.filter(entry => categorizeMessage(entry.message, entry.source) === filter);

  // Apply search filter
  if (search.trim()) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(entry =>
      entry.message?.toLowerCase().includes(searchLower)
    );
  }

  const display = filtered.slice(-100);

  // Auto-scroll when new entries arrive
  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [display.length, autoScroll]);

  // Detect manual scroll to disable auto-scroll
  const handleScroll = useCallback(() => {
    if (!logBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logBodyRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
    setAutoScroll(isAtBottom);
  }, []);

  // Export functions
  const exportJSON = () => {
    const data = JSON.stringify(deduplicated, null, 2);
    downloadFile(data, 'usv-event-log.json', 'application/json');
  };

  const exportCSV = () => {
    const header = 'Timestamp,Category,Message\n';
    const rows = deduplicated.map(entry => {
      const time = formatLogTime(entry.time);
      const cat = categorizeMessage(entry.message, entry.source);
      const msg = `"${(entry.message || '').replace(/"/g, '""')}"`;
      return `${time},${cat},${msg}`;
    }).join('\n');
    downloadFile(header + rows, 'usv-event-log.csv', 'text/csv');
  };

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="panel event-log-panel">
      <div className="panel-header">
        <h3>Event Log</h3>
        <div className="event-log-controls">
          {/* Search */}
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="event-log-search"
          />

          {/* Category filter */}
          <select value={filter} onChange={e => setFilter(e.target.value)} className="event-log-filter">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          {/* Export */}
          <div className="event-log-export">
            <button className="btn btn-sm" onClick={exportJSON} title="Export as JSON">
              📥 JSON
            </button>
            <button className="btn btn-sm" onClick={exportCSV} title="Export as CSV">
              📥 CSV
            </button>
          </div>

          <span className="telemetry-label">
            {connected ? `${filtered.length} events` : 'Offline'}
          </span>
        </div>
      </div>
      <div className="event-log-body" ref={logBodyRef} onScroll={handleScroll}>
        {display.length > 0 ? (
          display.map((entry, i) => {
            const cat = categorizeMessage(entry.message, entry.source);
            const level = entry.level || 'info';
            return (
              <div key={i} className={`log-entry-mini ${level === 'error' ? 'log-error' : level === 'warning' ? 'log-warning' : ''}`}>
                <span className="log-time">
                  {formatLogTime(entry.time)}
                </span>
                <span
                  className="log-cat-dot"
                  style={{ background: CATEGORY_COLORS[cat] }}
                  title={cat}
                />
                <span className="log-cat-label">{cat}</span>
                <span className="log-msg">{entry.message}</span>
              </div>
            );
          })
        ) : (
          <span className="telemetry-label" style={{ padding: '4px 8px' }}>
            {connected ? (search ? 'No matching events' : 'No events yet') : 'Connect backend to see events...'}
          </span>
        )}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

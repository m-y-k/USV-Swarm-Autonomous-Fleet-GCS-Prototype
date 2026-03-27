/**
 * USV Fleet Command — WebSocket Hook
 * 
 * Connects to the Python backend at ws://localhost:8000/ws
 * Receives fleet state at 5 Hz, sends commands back.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_URL, RECONNECT_DELAY_MS } from '../utils/constants';

export function useWebSocket() {
  const [fleetState, setFleetState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        console.log('[WS] Connected to backend');
        setConnected(true);
        // Clear any pending reconnect
        if (reconnectTimer.current) {
          clearTimeout(reconnectTimer.current);
          reconnectTimer.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setFleetState(data);
          setLastUpdate(Date.now());
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        // Guard: only update state if this is still the active connection.
        // React StrictMode double-invokes effects, creating ws2 before ws1's
        // async onclose fires. Without this check ws1.onclose would null out
        // wsRef.current (which already points to ws2), breaking sendCommand.
        if (wsRef.current !== ws) return;
        setConnected(false);
        wsRef.current = null;
        // Auto-reconnect
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = (err) => {
        console.error('[WS] Error:', err);
        if (wsRef.current === ws) ws.close();
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[WS] Connection failed:', err);
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
    }
  }, []);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  /**
   * Send a command to the backend.
   * @param {object} command — e.g. { type: 'arm', vehicle_id: 0 }
   */
  const sendCommand = useCallback((command) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(command));
      console.log('[WS] Sent command:', command);
    } else {
      console.warn('[WS] Cannot send — not connected');
    }
  }, []);

  return {
    fleetState,
    connected,
    lastUpdate,
    sendCommand,
  };
}

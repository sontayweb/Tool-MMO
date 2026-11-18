import { useEffect, useRef, useState, useCallback } from 'react';

const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

export interface WSMessage {
  type: 'account_result' | 'stats_update' | 'job_completed';
  data: any;
}

export function useJobWebSocket(
  jobId: string | null,
  onMessageReceived?: (msg: WSMessage) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);

  const connect = useCallback(() => {
    if (!jobId) return;

    const wsUrl = `${WS_BASE_URL}/ws/${jobId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      // Ping keepalive every 15s
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 15000);
    };

    ws.onmessage = (event) => {
      try {
        if (event.data === 'pong') return;
        const parsed: WSMessage = JSON.parse(event.data);
        if (onMessageReceived) {
          onMessageReceived(parsed);
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing message:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      clearInterval(pingIntervalRef.current);
    };

    ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err);
      ws.close();
    };
  }, [jobId, onMessageReceived]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      clearInterval(pingIntervalRef.current);
    };
  }, [connect]);

  return { isConnected };
}

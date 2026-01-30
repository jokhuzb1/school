import { useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { getSseToken } from '../services/sse';

interface SSEEvent {
  type: 'connected' | 'attendance';
  schoolId?: string;
  event?: {
    id: string;
    studentId: string | null;
    eventType: 'IN' | 'OUT';
    timestamp: string;
    student?: {
      id: string;
      name: string;
      classId?: string | null;
      class?: { name: string } | null;
    } | null;
  };
}

interface UseAttendanceSSEOptions {
  onEvent?: (event: SSEEvent['event']) => void;
  enabled?: boolean;
}

export const useAttendanceSSE = (
  schoolId: string | null,
  options: UseAttendanceSSEOptions = {}
) => {
  const { onEvent, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(async () => {
    if (!schoolId || !enabled) return;

    const useShortToken =
      import.meta.env.PROD ||
      import.meta.env.VITE_SSE_USE_TOKEN_ENDPOINT === "true";
    let token = localStorage.getItem('token');
    if (!token) {
      setError('No auth token');
      return;
    }
    if (useShortToken) {
      try {
        token = await getSseToken();
      } catch (err) {
        setError("Failed to get SSE token");
        return;
      }
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Create SSE connection with token in URL (EventSource doesn't support headers)
    const url = `${API_BASE_URL}/schools/${schoolId}/events/stream?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        
        if (data.type === 'connected') {
          setIsConnected(true);
        } else if (data.type === 'attendance' && data.event) {
          onEvent?.(data.event);
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost');
      eventSource.close();

      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [schoolId, enabled, onEvent]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return {
    isConnected,
    error,
    reconnect: connect,
  };
};

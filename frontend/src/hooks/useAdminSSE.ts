import { useEffect, useState, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

// Admin SSE event types
interface AdminSSEEvent {
  type: 'connected' | 'attendance_event' | 'school_stats_update' | 'connection_stats';
  role?: string;
  serverTime?: string;
  connectionStats?: {
    total: number;
    bySchool: Record<string, number>;
  };
  schoolId?: string;
  schoolName?: string;
  data?: {
    totalStudents?: number;
    presentToday?: number;
    lateToday?: number;
    absentToday?: number;
    currentlyInSchool?: number;
    event?: {
      id: string;
      studentId: string | null;
      eventType: 'IN' | 'OUT';
      timestamp: string;
      student?: {
        id: string;
        name: string;
        class?: { name: string } | null;
      } | null;
    };
  };
  event?: {
    id: string;
    studentId: string | null;
    eventType: 'IN' | 'OUT';
    timestamp: string;
    student?: {
      id: string;
      name: string;
      class?: { name: string } | null;
    } | null;
  };
  stats?: {
    total: number;
    bySchool: Record<string, number>;
  };
}

interface UseAdminSSEOptions {
  onAttendanceEvent?: (event: AdminSSEEvent) => void;
  onStatsUpdate?: (event: AdminSSEEvent) => void;
  onConnectionStats?: (stats: AdminSSEEvent['connectionStats']) => void;
  enabled?: boolean;
}

export const useAdminSSE = (options: UseAdminSSEOptions = {}) => {
  const { 
    onAttendanceEvent, 
    onStatsUpdate, 
    onConnectionStats,
    enabled = true 
  } = options;
  
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState<AdminSSEEvent['connectionStats'] | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const connect = useCallback(() => {
    if (!enabled) return;

    const token = localStorage.getItem('token');
    if (!token) {
      setError('No auth token');
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Create SSE connection
    const url = `${API_BASE_URL}/admin/events/stream?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0; // Reset reconnect attempts on successful connection
    };

    eventSource.onmessage = (e) => {
      try {
        const data: AdminSSEEvent = JSON.parse(e.data);
        
        switch (data.type) {
          case 'connected':
            setIsConnected(true);
            if (data.connectionStats) {
              setConnectionStats(data.connectionStats);
              onConnectionStats?.(data.connectionStats);
            }
            break;
            
          case 'attendance_event':
            onAttendanceEvent?.(data);
            break;
            
          case 'school_stats_update':
            onStatsUpdate?.(data);
            break;
            
          case 'connection_stats':
            if (data.stats) {
              setConnectionStats(data.stats);
              onConnectionStats?.(data.stats);
            }
            break;
        }
      } catch (err) {
        console.error('Admin SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError('Connection lost');
      eventSource.close();

      // Exponential backoff for reconnection
      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      } else {
        setError('Max reconnection attempts reached');
      }
    };
  }, [enabled, onAttendanceEvent, onStatsUpdate, onConnectionStats]);

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

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setIsConnected(false);
  }, []);

  return {
    isConnected,
    error,
    connectionStats,
    reconnect: connect,
    disconnect,
  };
};

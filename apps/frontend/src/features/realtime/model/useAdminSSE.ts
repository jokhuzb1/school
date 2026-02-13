import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@shared/config";
import { getSseToken } from "@shared/api";

interface AdminSSEEvent {
  type: "connected" | "attendance_event" | "school_stats_update" | "connection_stats";
  role?: string;
  serverTime?: string;
  scope?: "started" | "active";
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
    excusedToday?: number;
    pendingEarlyCount?: number;
    latePendingCount?: number;
    currentlyInSchool?: number;
    event?: {
      id: string;
      studentId: string | null;
      eventType: "IN" | "OUT";
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
    eventType: "IN" | "OUT";
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
  onConnectionStats?: (stats: AdminSSEEvent["connectionStats"]) => void;
  enabled?: boolean;
}

export const useAdminSSE = (options: UseAdminSSEOptions = {}) => {
  const { onAttendanceEvent, onStatsUpdate, onConnectionStats, enabled = true } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStats, setConnectionStats] = useState<AdminSSEEvent["connectionStats"] | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;

  const connect = useCallback(async () => {
    if (!enabled) return;

    const useShortToken = import.meta.env.PROD || import.meta.env.VITE_SSE_USE_TOKEN_ENDPOINT === "true";
    let token = localStorage.getItem("token");
    if (!token) {
      setError("No auth token");
      return;
    }
    if (useShortToken) {
      try {
        token = await getSseToken();
      } catch {
        setError("Failed to get SSE token");
        return;
      }
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const url = `${API_BASE_URL}/admin/events/stream?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
      reconnectAttempts.current = 0;
    };

    eventSource.onmessage = (e) => {
      try {
        const data: AdminSSEEvent = JSON.parse(e.data);
        switch (data.type) {
          case "connected":
            setIsConnected(true);
            if (data.connectionStats) {
              setConnectionStats(data.connectionStats);
              onConnectionStats?.(data.connectionStats);
            }
            break;
          case "attendance_event":
            onAttendanceEvent?.(data);
            break;
          case "school_stats_update":
            onStatsUpdate?.(data);
            break;
          case "connection_stats":
            if (data.stats) {
              setConnectionStats(data.stats);
              onConnectionStats?.(data.stats);
            }
            break;
        }
      } catch (err) {
        console.error("Admin SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError("Connection lost");
      eventSource.close();

      if (reconnectAttempts.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current++;
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, delay);
      } else {
        setError("Max reconnection attempts reached");
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

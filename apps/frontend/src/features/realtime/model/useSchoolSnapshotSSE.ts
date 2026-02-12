import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@shared/config";
import { getSseToken } from "@shared/api";

export interface SchoolSnapshotStats {
  totalStudents: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  currentlyInSchool: number;
  pendingEarly: number;
  pendingLate: number;
}

export interface SchoolSnapshotPayload {
  type: "school_snapshot";
  schoolId: string;
  scope: "started" | "active";
  timestamp: string;
  stats: SchoolSnapshotStats;
  weeklyStats?: Array<{
    date: string;
    dayName: string;
    present: number;
    late: number;
    absent: number;
  }>;
}

interface SnapshotSSEEvent {
  type: "connected" | "school_snapshot";
  schoolId?: string;
  scope?: "started" | "active";
  serverTime?: string;
  stats?: SchoolSnapshotStats;
  timestamp?: string;
  weeklyStats?: SchoolSnapshotPayload["weeklyStats"];
}

interface UseSchoolSnapshotSSEOptions {
  onSnapshot?: (snapshot: SchoolSnapshotPayload) => void;
  enabled?: boolean;
}

export const useSchoolSnapshotSSE = (
  schoolId: string | null,
  options: UseSchoolSnapshotSSEOptions = {},
) => {
  const { onSnapshot, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(async () => {
    if (!schoolId || !enabled) return;

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

    const url = `${API_BASE_URL}/schools/${schoolId}/snapshots/stream?token=${token}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    eventSource.onmessage = (e) => {
      try {
        const data: SnapshotSSEEvent = JSON.parse(e.data);
        if (data.type === "connected") {
          setIsConnected(true);
          return;
        }
        if (data.type === "school_snapshot") {
          onSnapshot?.(data as unknown as SchoolSnapshotPayload);
        }
      } catch (err) {
        console.error("Snapshot SSE parse error:", err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
      setError("Connection lost");
      eventSource.close();

      reconnectTimeoutRef.current = window.setTimeout(() => {
        connect();
      }, 5000);
    };
  }, [schoolId, enabled, onSnapshot]);

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

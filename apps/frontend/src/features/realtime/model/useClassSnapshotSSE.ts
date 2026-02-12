import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "@shared/config";
import type { SchoolSnapshotPayload, SchoolSnapshotStats } from "./useSchoolSnapshotSSE";
import { getSseToken } from "@shared/api";

export interface ClassSnapshotPayload extends Omit<SchoolSnapshotPayload, "type" | "schoolId"> {
  type: "class_snapshot";
  schoolId: string;
  classId: string;
}

interface SnapshotSSEEvent {
  type: "connected" | "class_snapshot";
  schoolId?: string;
  classId?: string;
  scope?: "started" | "active";
  serverTime?: string;
  stats?: SchoolSnapshotStats;
  timestamp?: string;
  weeklyStats?: ClassSnapshotPayload["weeklyStats"];
}

interface UseClassSnapshotSSEOptions {
  onSnapshot?: (snapshot: ClassSnapshotPayload) => void;
  enabled?: boolean;
}

export const useClassSnapshotSSE = (
  schoolId: string | null,
  classId: string | null,
  options: UseClassSnapshotSSEOptions = {},
) => {
  const { onSnapshot, enabled = true } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(async () => {
    if (!schoolId || !classId || !enabled) return;

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

    const url = `${API_BASE_URL}/schools/${schoolId}/classes/${classId}/snapshots/stream?token=${token}`;
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
        if (data.type === "class_snapshot") {
          onSnapshot?.(data as unknown as ClassSnapshotPayload);
        }
      } catch (err) {
        console.error("Class snapshot SSE parse error:", err);
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
  }, [schoolId, classId, enabled, onSnapshot]);

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

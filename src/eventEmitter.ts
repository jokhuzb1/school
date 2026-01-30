import { EventEmitter } from 'events';
import Redis from "ioredis";
import { REDIS_URL } from "./config";

// Global event emitter for real-time attendance events
export const attendanceEmitter = new EventEmitter();

// Allow massive concurrent SSE connections for high-load scenarios
// 10,000+ concurrent connections support
attendanceEmitter.setMaxListeners(0); // 0 = unlimited listeners

// SuperAdmin dashboard uchun global event emitter
export const adminEmitter = new EventEmitter();
adminEmitter.setMaxListeners(0); // unlimited for scalability

const ATTENDANCE_CHANNEL = "attendance_events";

let pub: Redis | null = null;
let sub: Redis | null = null;

if (REDIS_URL) {
  pub = new Redis(REDIS_URL);
  sub = new Redis(REDIS_URL);

  sub.subscribe(ATTENDANCE_CHANNEL, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("Redis subscribe error:", err);
    }
  });

  sub.on("message", (channel, message) => {
    if (channel !== ATTENDANCE_CHANNEL) return;
    try {
      const payload = JSON.parse(message);
      attendanceEmitter.emit("attendance", payload);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Redis message parse error:", err);
    }
  });
}

export const emitAttendance = (payload: AttendanceEventPayload) => {
  if (pub) {
    pub.publish(ATTENDANCE_CHANNEL, JSON.stringify(payload)).catch(() => {
      attendanceEmitter.emit("attendance", payload);
    });
    return;
  }
  attendanceEmitter.emit("attendance", payload);
};

// Connection tracking for monitoring
let activeConnections = 0;
const connectionsBySchool: Map<string, number> = new Map();

export const trackConnection = (schoolId: string, action: 'connect' | 'disconnect') => {
  if (action === 'connect') {
    activeConnections++;
    connectionsBySchool.set(schoolId, (connectionsBySchool.get(schoolId) || 0) + 1);
  } else {
    activeConnections--;
    const current = connectionsBySchool.get(schoolId) || 1;
    if (current <= 1) {
      connectionsBySchool.delete(schoolId);
    } else {
      connectionsBySchool.set(schoolId, current - 1);
    }
  }
};

export const getConnectionStats = () => ({
  total: activeConnections,
  bySchool: Object.fromEntries(connectionsBySchool),
});

// Event types
export interface AttendanceEventPayload {
  schoolId: string;
  event: {
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

// Admin dashboard uchun aggregated event
export interface AdminEventPayload {
  type: 'school_stats_update' | 'attendance_event';
  schoolId: string;
  schoolName?: string;
  data: {
    totalStudents?: number;
    presentToday?: number;
    lateToday?: number;
    absentToday?: number;
    currentlyInSchool?: number;
    event?: AttendanceEventPayload['event'];
  };
}

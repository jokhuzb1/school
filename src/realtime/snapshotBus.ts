import { EventEmitter } from "events";
import Redis from "ioredis";
import type {
  ClassSnapshotPayload,
  SchoolSnapshotPayload,
} from "./snapshot.service";
import { REDIS_URL } from "../config";

const schoolEmitters = new Map<string, EventEmitter>();
const classEmitters = new Map<string, EventEmitter>();
const classSubscriberCounts = new Map<string, number>();
const adminEmitter = new EventEmitter();

adminEmitter.setMaxListeners(0);

const SCHOOL_SNAPSHOT_CHANNEL = "school_snapshot_events";
const CLASS_SNAPSHOT_CHANNEL = "class_snapshot_events";

let pub: Redis | null = null;
let sub: Redis | null = null;

if (REDIS_URL) {
  pub = new Redis(REDIS_URL);
  sub = new Redis(REDIS_URL);

  sub.subscribe(SCHOOL_SNAPSHOT_CHANNEL, CLASS_SNAPSHOT_CHANNEL, (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error("Redis subscribe error:", err);
    }
  });

  sub.on("message", (channel, message) => {
    try {
      const payload = JSON.parse(message);
      if (channel === SCHOOL_SNAPSHOT_CHANNEL) {
        const emitter = getSchoolEmitter(payload.schoolId);
        emitter.emit("snapshot", payload);
        adminEmitter.emit("snapshot", payload);
      } else if (channel === CLASS_SNAPSHOT_CHANNEL) {
        const key = `${payload.schoolId}:${payload.classId}`;
        const emitter = getClassEmitter(key);
        emitter.emit("snapshot", payload);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Redis snapshot parse error:", err);
    }
  });
}

const getSchoolEmitter = (schoolId: string) => {
  let emitter = schoolEmitters.get(schoolId);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    schoolEmitters.set(schoolId, emitter);
  }
  return emitter;
};

const getClassEmitter = (key: string) => {
  let emitter = classEmitters.get(key);
  if (!emitter) {
    emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    classEmitters.set(key, emitter);
  }
  return emitter;
};

export function emitSchoolSnapshot(snapshot: SchoolSnapshotPayload) {
  if (pub) {
    pub.publish(SCHOOL_SNAPSHOT_CHANNEL, JSON.stringify(snapshot)).catch(() => {
      const emitter = getSchoolEmitter(snapshot.schoolId);
      emitter.emit("snapshot", snapshot);
      adminEmitter.emit("snapshot", snapshot);
    });
    return;
  }
  const emitter = getSchoolEmitter(snapshot.schoolId);
  emitter.emit("snapshot", snapshot);
  adminEmitter.emit("snapshot", snapshot);
}

export function emitClassSnapshot(snapshot: ClassSnapshotPayload) {
  if (pub) {
    pub.publish(CLASS_SNAPSHOT_CHANNEL, JSON.stringify(snapshot)).catch(() => {
      const key = `${snapshot.schoolId}:${snapshot.classId}`;
      const emitter = getClassEmitter(key);
      emitter.emit("snapshot", snapshot);
    });
    return;
  }
  const key = `${snapshot.schoolId}:${snapshot.classId}`;
  const emitter = getClassEmitter(key);
  emitter.emit("snapshot", snapshot);
}

export function onSchoolSnapshot(
  schoolId: string,
  handler: (snapshot: SchoolSnapshotPayload) => void,
) {
  const emitter = getSchoolEmitter(schoolId);
  emitter.on("snapshot", handler);
  return () => emitter.off("snapshot", handler);
}

export function onClassSnapshot(
  schoolId: string,
  classId: string,
  handler: (snapshot: ClassSnapshotPayload) => void,
) {
  const key = `${schoolId}:${classId}`;
  const emitter = getClassEmitter(key);
  emitter.on("snapshot", handler);
  classSubscriberCounts.set(key, (classSubscriberCounts.get(key) || 0) + 1);
  return () => {
    emitter.off("snapshot", handler);
    const next = (classSubscriberCounts.get(key) || 1) - 1;
    if (next <= 0) {
      classSubscriberCounts.delete(key);
    } else {
      classSubscriberCounts.set(key, next);
    }
  };
}

export function onAdminSnapshot(
  handler: (snapshot: SchoolSnapshotPayload) => void,
) {
  adminEmitter.on("snapshot", handler);
  return () => adminEmitter.off("snapshot", handler);
}

export function getActiveClassKeys(): string[] {
  return Array.from(classSubscriberCounts.keys());
}

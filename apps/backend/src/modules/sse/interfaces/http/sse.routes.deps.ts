import {
  AdminEventPayload,
  adminEmitter,
  attendanceEmitter,
  AttendanceEventPayload,
  getConnectionStats,
  trackConnection,
} from "../../../../eventEmitter";
import prisma from "../../../../prisma";
import {
  onAdminSnapshot,
  onClassSnapshot,
  onSchoolSnapshot,
} from "../../../../realtime/snapshotBus";
import {
  computeClassSnapshot,
  computeSchoolSnapshot,
} from "../../../../realtime/snapshot.service";
import { IS_PROD } from "../../../../config";

export type SseHttpDeps = {
  attendanceEmitter: typeof attendanceEmitter;
  adminEmitter: typeof adminEmitter;
  trackConnection: typeof trackConnection;
  getConnectionStats: typeof getConnectionStats;
  onAdminSnapshot: typeof onAdminSnapshot;
  onClassSnapshot: typeof onClassSnapshot;
  onSchoolSnapshot: typeof onSchoolSnapshot;
  computeClassSnapshot: typeof computeClassSnapshot;
  computeSchoolSnapshot: typeof computeSchoolSnapshot;
  prisma: typeof prisma;
  IS_PROD: typeof IS_PROD;
};

export type { AttendanceEventPayload, AdminEventPayload };

export function createSseHttpDeps(): SseHttpDeps {
  return {
    attendanceEmitter,
    adminEmitter,
    trackConnection,
    getConnectionStats,
    onAdminSnapshot,
    onClassSnapshot,
    onSchoolSnapshot,
    computeClassSnapshot,
    computeSchoolSnapshot,
    prisma,
    IS_PROD,
  };
}

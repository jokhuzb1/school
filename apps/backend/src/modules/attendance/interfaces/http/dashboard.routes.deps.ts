import prisma from "../../../../prisma";
import {
  AttendanceHttpPrismaRepository,
  createAttendanceHttpPrismaRepository,
} from "../../infrastructure/attendance-http.prisma-repository";
import {
  addDaysUtc,
  dateKeyToUtcDate,
  getDateOnlyInZone,
  getDateRangeInZone,
  type DateRangeType,
} from "../../../../utils/date";
import {
  getTeacherAllowedClassIds,
  requireRoles,
  requireSchoolScope,
} from "../../../../utils/authz";
import { sendHttpError } from "../../../../utils/httpErrors";
import {
  calculateAttendancePercent,
  getActiveClassIds,
  getNowMinutesInZone,
  getStartedClassIds,
} from "../../../../utils/attendanceStatus";
import {
  ClassCountRow,
  computeNoScanSplit,
  getClassBreakdown,
  getPendingNotArrivedList,
  getStatusCountsByRange,
  getWeeklyStatusMap,
} from "../../../attendance";
import { normalizeAbsentCount } from "./dashboard.routes.helpers";

export type DashboardHttpDeps = {
  attendanceRepo: AttendanceHttpPrismaRepository;
  addDaysUtc: typeof addDaysUtc;
  dateKeyToUtcDate: typeof dateKeyToUtcDate;
  getDateOnlyInZone: typeof getDateOnlyInZone;
  getDateRangeInZone: typeof getDateRangeInZone;
  getTeacherAllowedClassIds: typeof getTeacherAllowedClassIds;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
  calculateAttendancePercent: typeof calculateAttendancePercent;
  getActiveClassIds: typeof getActiveClassIds;
  getNowMinutesInZone: typeof getNowMinutesInZone;
  getStartedClassIds: typeof getStartedClassIds;
  computeNoScanSplit: typeof computeNoScanSplit;
  getClassBreakdown: typeof getClassBreakdown;
  getPendingNotArrivedList: typeof getPendingNotArrivedList;
  getStatusCountsByRange: typeof getStatusCountsByRange;
  getWeeklyStatusMap: typeof getWeeklyStatusMap;
  normalizeAbsentCount: typeof normalizeAbsentCount;
};

export function createDashboardHttpDeps(): DashboardHttpDeps {
  return {
    attendanceRepo: createAttendanceHttpPrismaRepository(prisma),
    addDaysUtc,
    dateKeyToUtcDate,
    getDateOnlyInZone,
    getDateRangeInZone,
    getTeacherAllowedClassIds,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    calculateAttendancePercent,
    getActiveClassIds,
    getNowMinutesInZone,
    getStartedClassIds,
    computeNoScanSplit,
    getClassBreakdown,
    getPendingNotArrivedList,
    getStatusCountsByRange,
    getWeeklyStatusMap,
    normalizeAbsentCount,
  };
}

export type { ClassCountRow, DateRangeType };

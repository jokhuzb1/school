import ExcelJS from "exceljs";
import prisma from "../../../../prisma";
import {
  AttendanceHttpPrismaRepository,
  createAttendanceHttpPrismaRepository,
} from "../../infrastructure/attendance-http.prisma-repository";
import { logAudit } from "../../../../utils/audit";
import {
  getTeacherClassFilter,
  requireAttendanceTeacherScope,
  requireRoles,
  requireSchoolScope,
} from "../../../../utils/authz";
import { addDaysUtc, getDateOnlyInZone } from "../../../../utils/date";
import { sendHttpError } from "../../../../utils/httpErrors";
import {
  computeAttendanceStatus,
  getNowMinutesInZone,
} from "../../../../utils/attendanceStatus";

export type AttendanceHttpDeps = {
  attendanceRepo: AttendanceHttpPrismaRepository;
  ExcelJS: typeof ExcelJS;
  addDaysUtc: typeof addDaysUtc;
  getDateOnlyInZone: typeof getDateOnlyInZone;
  getTeacherClassFilter: typeof getTeacherClassFilter;
  requireAttendanceTeacherScope: typeof requireAttendanceTeacherScope;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
  computeAttendanceStatus: typeof computeAttendanceStatus;
  getNowMinutesInZone: typeof getNowMinutesInZone;
  logAudit: typeof logAudit;
};

export function createAttendanceHttpDeps(): AttendanceHttpDeps {
  return {
    attendanceRepo: createAttendanceHttpPrismaRepository(prisma),
    ExcelJS,
    addDaysUtc,
    getDateOnlyInZone,
    getTeacherClassFilter,
    requireAttendanceTeacherScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    computeAttendanceStatus,
    getNowMinutesInZone,
    logAudit,
  };
}

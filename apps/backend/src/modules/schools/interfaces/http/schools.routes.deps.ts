import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { WEBHOOK_ENFORCE_SECRET, WEBHOOK_SECRET_HEADER } from "../../../../config";
import prisma from "../../../../prisma";
import { buildUserContext, logAudit } from "../../../../utils/audit";
import { requireRoles, requireSchoolScope } from "../../../../utils/authz";
import { addDaysUtc, getDateOnlyInZone } from "../../../../utils/date";
import {
  calculateAttendancePercent,
  getActiveClassIds,
  getNowMinutesInZone,
  getStartedClassIds,
} from "../../../../utils/attendanceStatus";
import { sendHttpError } from "../../../../utils/httpErrors";
import {
  ClassCountRow,
  computeNoScanSplit,
  getStatusCountsByRange,
} from "../../../attendance";
import { recordDeviceOperation } from "../../../devices/services/device-ops-metrics";

export function sanitizeSchool<
  T extends { webhookSecretIn?: string; webhookSecretOut?: string },
>(school: T) {
  const { webhookSecretIn, webhookSecretOut, ...rest } = school as any;
  return rest as Omit<T, "webhookSecretIn" | "webhookSecretOut">;
}

export type SchoolsHttpDeps = {
  prisma: typeof prisma;
  uuidv4: typeof uuidv4;
  bcrypt: typeof bcrypt;
  WEBHOOK_ENFORCE_SECRET: typeof WEBHOOK_ENFORCE_SECRET;
  WEBHOOK_SECRET_HEADER: typeof WEBHOOK_SECRET_HEADER;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
  addDaysUtc: typeof addDaysUtc;
  getDateOnlyInZone: typeof getDateOnlyInZone;
  calculateAttendancePercent: typeof calculateAttendancePercent;
  getActiveClassIds: typeof getActiveClassIds;
  getNowMinutesInZone: typeof getNowMinutesInZone;
  getStartedClassIds: typeof getStartedClassIds;
  buildUserContext: typeof buildUserContext;
  logAudit: typeof logAudit;
  computeNoScanSplit: typeof computeNoScanSplit;
  getStatusCountsByRange: typeof getStatusCountsByRange;
  recordDeviceOperation: typeof recordDeviceOperation;
  sanitizeSchool: typeof sanitizeSchool;
};

export function createSchoolsHttpDeps(): SchoolsHttpDeps {
  return {
    prisma,
    uuidv4,
    bcrypt,
    WEBHOOK_ENFORCE_SECRET,
    WEBHOOK_SECRET_HEADER,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    addDaysUtc,
    getDateOnlyInZone,
    calculateAttendancePercent,
    getActiveClassIds,
    getNowMinutesInZone,
    getStartedClassIds,
    buildUserContext,
    logAudit,
    computeNoScanSplit,
    getStatusCountsByRange,
    recordDeviceOperation,
    sanitizeSchool,
  };
}

export type { ClassCountRow };

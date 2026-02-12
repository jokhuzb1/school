import prisma from "../../../../prisma";
import { buildUserContext, logAudit } from "../../../../utils/audit";
import {
  requireClassSchoolScope,
  requireRoles,
  requireSchoolScope,
} from "../../../../utils/authz";
import { addDaysUtc, dateKeyToUtcDate, getDateKeyInZone } from "../../../../utils/date";
import { sendHttpError } from "../../../../utils/httpErrors";

export type ClassesHttpDeps = {
  prisma: typeof prisma;
  addDaysUtc: typeof addDaysUtc;
  dateKeyToUtcDate: typeof dateKeyToUtcDate;
  getDateKeyInZone: typeof getDateKeyInZone;
  requireClassSchoolScope: typeof requireClassSchoolScope;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
  buildUserContext: typeof buildUserContext;
  logAudit: typeof logAudit;
};

export function createClassesHttpDeps(): ClassesHttpDeps {
  return {
    prisma,
    addDaysUtc,
    dateKeyToUtcDate,
    getDateKeyInZone,
    requireClassSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    buildUserContext,
    logAudit,
  };
}

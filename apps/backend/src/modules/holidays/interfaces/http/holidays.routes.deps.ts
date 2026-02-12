import prisma from "../../../../prisma";
import {
  requireHolidaySchoolScope,
  requireRoles,
  requireSchoolScope,
} from "../../../../utils/authz";
import { sendHttpError } from "../../../../utils/httpErrors";

export type HolidaysHttpDeps = {
  prisma: typeof prisma;
  requireHolidaySchoolScope: typeof requireHolidaySchoolScope;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
};

export function createHolidaysHttpDeps(): HolidaysHttpDeps {
  return {
    prisma,
    requireHolidaySchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
  };
}

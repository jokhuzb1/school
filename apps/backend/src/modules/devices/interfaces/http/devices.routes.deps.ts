import prisma from "../../../../prisma";
import { buildUserContext, logAudit } from "../../../../utils/audit";
import {
  requireDeviceSchoolScope,
  requireRoles,
  requireSchoolScope,
} from "../../../../utils/authz";
import { sendHttpError } from "../../../../utils/httpErrors";
import {
  getDeviceOperationMetrics,
  recordDeviceOperation,
} from "../../services/device-ops-metrics";

export type DevicesHttpDeps = {
  prisma: typeof prisma;
  requireDeviceSchoolScope: typeof requireDeviceSchoolScope;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  sendHttpError: typeof sendHttpError;
  buildUserContext: typeof buildUserContext;
  logAudit: typeof logAudit;
  getDeviceOperationMetrics: typeof getDeviceOperationMetrics;
  recordDeviceOperation: typeof recordDeviceOperation;
};

export function createDevicesHttpDeps(): DevicesHttpDeps {
  return {
    prisma,
    requireDeviceSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    buildUserContext,
    logAudit,
    getDeviceOperationMetrics,
    recordDeviceOperation,
  };
}

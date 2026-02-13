import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import {
  DEVICE_AUTO_REGISTER_ENABLED,
  DEVICE_STUDENT_ID_LENGTH,
  DEVICE_STUDENT_ID_STRATEGY,
  PROVISIONING_TOKEN,
} from "../../../../config";
import prisma from "../../../../prisma";
import {
  StudentsHttpPrismaRepository,
  createStudentsHttpPrismaRepository,
} from "../../infrastructure/students-http.prisma-repository";
import {
  getTeacherClassFilter,
  requireRoles,
  requireSchoolScope,
  requireStudentSchoolScope,
  requireTeacherClassScope,
} from "../../../../utils/authz";
import {
  addDaysUtc,
  getDateOnlyInZone,
  getDateRangeInZone,
  type DateRangeType,
} from "../../../../utils/date";
import {
  calculateAttendancePercent,
  computeAttendanceStatus,
  type EffectiveStatus,
  getNowMinutesInZone,
} from "../../../../utils/attendanceStatus";
import { sendHttpError } from "../../../../utils/httpErrors";
import {
  acquireImportLocks,
  createImportJob,
  getIdempotentResult,
  getImportJob,
  getImportMetrics,
  incrementImportJobRetry,
  recordImportMetrics,
  releaseImportLocks,
  setIdempotentResult,
  updateImportJob,
} from "../../services/import-runtime.service";
import {
  buildDuplicateStudentWhere,
  buildFullName,
  computeProvisioningStatus,
  ensureProvisioningAuth,
  generateDeviceStudentId,
  isBase64,
  logProvisioningEvent,
  normalizeBase64,
  normalizeGender,
  normalizeHeader,
  normalizeNamePart,
  saveStudentFaceImage,
  splitFullName,
  STUDENT_HAS_SPLIT_NAME_FIELDS,
} from "./students.routes.helpers";

export type StudentsHttpDeps = {
  studentsRepo: StudentsHttpPrismaRepository;
  ExcelJS: typeof ExcelJS;
  Prisma: typeof Prisma;
  addDaysUtc: typeof addDaysUtc;
  getDateOnlyInZone: typeof getDateOnlyInZone;
  getDateRangeInZone: typeof getDateRangeInZone;
  requireRoles: typeof requireRoles;
  requireSchoolScope: typeof requireSchoolScope;
  requireStudentSchoolScope: typeof requireStudentSchoolScope;
  requireTeacherClassScope: typeof requireTeacherClassScope;
  getTeacherClassFilter: typeof getTeacherClassFilter;
  sendHttpError: typeof sendHttpError;
  calculateAttendancePercent: typeof calculateAttendancePercent;
  computeAttendanceStatus: typeof computeAttendanceStatus;
  getNowMinutesInZone: typeof getNowMinutesInZone;
  DEVICE_AUTO_REGISTER_ENABLED: typeof DEVICE_AUTO_REGISTER_ENABLED;
  PROVISIONING_TOKEN: typeof PROVISIONING_TOKEN;
  DEVICE_STUDENT_ID_STRATEGY: typeof DEVICE_STUDENT_ID_STRATEGY;
  DEVICE_STUDENT_ID_LENGTH: typeof DEVICE_STUDENT_ID_LENGTH;
  acquireImportLocks: typeof acquireImportLocks;
  createImportJob: typeof createImportJob;
  getIdempotentResult: typeof getIdempotentResult;
  getImportJob: typeof getImportJob;
  getImportMetrics: typeof getImportMetrics;
  incrementImportJobRetry: typeof incrementImportJobRetry;
  recordImportMetrics: typeof recordImportMetrics;
  releaseImportLocks: typeof releaseImportLocks;
  setIdempotentResult: typeof setIdempotentResult;
  updateImportJob: typeof updateImportJob;
  normalizeHeader: typeof normalizeHeader;
  normalizeNamePart: typeof normalizeNamePart;
  buildFullName: typeof buildFullName;
  splitFullName: typeof splitFullName;
  normalizeGender: typeof normalizeGender;
  STUDENT_HAS_SPLIT_NAME_FIELDS: typeof STUDENT_HAS_SPLIT_NAME_FIELDS;
  buildDuplicateStudentWhere: typeof buildDuplicateStudentWhere;
  logProvisioningEvent: typeof logProvisioningEvent;
  normalizeBase64: typeof normalizeBase64;
  isBase64: typeof isBase64;
  saveStudentFaceImage: typeof saveStudentFaceImage;
  ensureProvisioningAuth: typeof ensureProvisioningAuth;
  computeProvisioningStatus: typeof computeProvisioningStatus;
  generateDeviceStudentId: typeof generateDeviceStudentId;
};

export function createStudentsHttpDeps(): StudentsHttpDeps {
  return {
    studentsRepo: createStudentsHttpPrismaRepository(prisma),
    ExcelJS,
    Prisma,
    addDaysUtc,
    getDateOnlyInZone,
    getDateRangeInZone,
    requireRoles,
    requireSchoolScope,
    requireStudentSchoolScope,
    requireTeacherClassScope,
    getTeacherClassFilter,
    sendHttpError,
    calculateAttendancePercent,
    computeAttendanceStatus,
    getNowMinutesInZone,
    DEVICE_AUTO_REGISTER_ENABLED,
    PROVISIONING_TOKEN,
    DEVICE_STUDENT_ID_STRATEGY,
    DEVICE_STUDENT_ID_LENGTH,
    acquireImportLocks,
    createImportJob,
    getIdempotentResult,
    getImportJob,
    getImportMetrics,
    incrementImportJobRetry,
    recordImportMetrics,
    releaseImportLocks,
    setIdempotentResult,
    updateImportJob,
    normalizeHeader,
    normalizeNamePart,
    buildFullName,
    splitFullName,
    normalizeGender,
    STUDENT_HAS_SPLIT_NAME_FIELDS,
    buildDuplicateStudentWhere,
    logProvisioningEvent,
    normalizeBase64,
    isBase64,
    saveStudentFaceImage,
    ensureProvisioningAuth,
    computeProvisioningStatus,
    generateDeviceStudentId,
  };
}

export type { DateRangeType, EffectiveStatus };

import prisma from '../prisma';

export type AppRole = 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'GUARD';

export class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

function logAccessDenied(params: {
  user?: any;
  reason: string;
  scopeSchoolId?: string;
}) {
  const schoolId = params.scopeSchoolId || params.user?.schoolId || null;
  if (!schoolId) return;
  prisma.provisioningLog.create({
    data: {
      schoolId,
      level: "WARN",
      eventType: "ACCESS_DENIED",
      stage: "AUTHZ",
      status: "FAILED",
      message: params.reason,
      actorId: params.user?.sub || null,
      actorRole: params.user?.role || null,
      actorName: params.user?.name || null,
      source: "BACKEND_API",
      payload: {
        requestedSchoolId: params.scopeSchoolId || null,
      },
    },
  }).catch(() => null);
}

export function isSuperAdmin(user: any): boolean {
  return user?.role === 'SUPER_ADMIN';
}

export function requireRoles(user: any, roles: AppRole[]) {
  if (isSuperAdmin(user)) return;
  if (!user?.role || !roles.includes(user.role)) {
    logAccessDenied({
      user,
      reason: `Role not allowed. required=${roles.join(",")}, actual=${user?.role || "none"}`,
    });
    throw new ForbiddenError('forbidden');
  }
}

export function requireSchoolScope(user: any, schoolId: string) {
  if (isSuperAdmin(user)) return;
  if (!user?.schoolId || user.schoolId !== schoolId) {
    logAccessDenied({
      user,
      reason: "School scope mismatch",
      scopeSchoolId: schoolId,
    });
    throw new ForbiddenError('forbidden');
  }
}

// For endpoints that only have :id, we must load the resource and validate its schoolId
export async function requireClassSchoolScope(user: any, classId: string) {
  const cls = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, schoolId: true } });
  if (!cls) throw new NotFoundError('not found');
  requireSchoolScope(user, cls.schoolId);
  return cls;
}

export async function requireStudentSchoolScope(user: any, studentId: string) {
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, classId: true } });
  if (!student) throw new NotFoundError('not found');
  requireSchoolScope(user, student.schoolId);
  return student;
}

export async function requireDeviceSchoolScope(user: any, deviceId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { id: true, schoolId: true } });
  if (!device) throw new NotFoundError('not found');
  requireSchoolScope(user, device.schoolId);
  return device;
}

export async function requireHolidaySchoolScope(user: any, holidayId: string) {
  const holiday = await prisma.holiday.findUnique({ where: { id: holidayId }, select: { id: true, schoolId: true } });
  if (!holiday) throw new NotFoundError('not found');
  requireSchoolScope(user, holiday.schoolId);
  return holiday;
}

export async function requireNvrSchoolScope(user: any, nvrId: string) {
  const nvr = await prisma.nvr.findUnique({
    where: { id: nvrId },
  });
  if (!nvr) throw new NotFoundError('not found');
  requireSchoolScope(user, nvr.schoolId);
  return nvr;
}

export async function requireCameraAreaSchoolScope(user: any, areaId: string) {
  const area = await prisma.cameraArea.findUnique({
    where: { id: areaId },
    select: { id: true, schoolId: true },
  });
  if (!area) throw new NotFoundError('not found');
  requireSchoolScope(user, area.schoolId);
  return area;
}

export async function requireCameraSchoolScope(user: any, cameraId: string) {
  const camera = await prisma.camera.findUnique({
    where: { id: cameraId },
  });
  if (!camera) throw new NotFoundError('not found');
  requireSchoolScope(user, camera.schoolId);
  return camera;
}

export async function requireAttendanceSchoolScope(user: any, attendanceId: string) {
  const att = await prisma.dailyAttendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, schoolId: true, studentId: true },
  });
  if (!att) throw new NotFoundError('not found');
  requireSchoolScope(user, att.schoolId);
  return att;
}

export async function requireAttendanceTeacherScope(user: any, attendanceId: string) {
  // Applies only to TEACHER; SUPER_ADMIN bypass inside other helpers
  const att = await prisma.dailyAttendance.findUnique({
    where: { id: attendanceId },
    select: { id: true, schoolId: true, student: { select: { classId: true } } },
  });
  if (!att) throw new NotFoundError('not found');
  requireSchoolScope(user, att.schoolId);

  if (user?.role === 'TEACHER') {
    const classId = att.student?.classId;
    if (!classId) throw new ForbiddenError('forbidden');
    await requireTeacherClassScope(user, classId);
  }

  return att;
}

export async function getTeacherAllowedClassIds(userId: string): Promise<string[]> {
  const rows = await prisma.teacherClass.findMany({ where: { teacherId: userId }, select: { classId: true } });
  return rows.map((r) => r.classId);
}

export async function getTeacherClassFilter(params: {
  teacherId: string;
  requestedClassId?: string | null;
}): Promise<{ allowedClassIds: string[]; classFilter: string | { in: string[] } }> {
  const { teacherId, requestedClassId } = params;
  const allowedClassIds = await getTeacherAllowedClassIds(teacherId);

  if (requestedClassId) {
    if (!allowedClassIds.includes(requestedClassId)) {
      throw new ForbiddenError('forbidden');
    }
    return { allowedClassIds, classFilter: requestedClassId };
  }

  return {
    allowedClassIds,
    classFilter: { in: allowedClassIds.length ? allowedClassIds : ['__none__'] },
  };
}

export async function requireTeacherClassScope(user: any, classId: string) {
  if (isSuperAdmin(user)) return;
  if (user?.role !== 'TEACHER') return; // Only enforce class-scope for teachers

  const allowed = await prisma.teacherClass.findUnique({
    where: { teacherId_classId: { teacherId: user.sub, classId } } as any,
    select: { classId: true },
  });

  if (!allowed) throw new ForbiddenError('forbidden');
}

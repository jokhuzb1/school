import { FastifyInstance } from "fastify";
import { AttendanceHttpDeps } from "./attendance.routes.deps";

export function registerAttendanceTodayAndReportRoutes(
  fastify: FastifyInstance,
  deps: AttendanceHttpDeps,
) {
  const { attendanceRepo,
    addDaysUtc,
    getDateOnlyInZone,
    getTeacherClassFilter,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    computeAttendanceStatus,
    getNowMinutesInZone,
  } = deps;

  fastify.get(
    "/schools/:schoolId/attendance/today",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { classId, status } = request.query as any;

        const school = await attendanceRepo.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true, absenceCutoffMinutes: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";
        const cutoff = school?.absenceCutoffMinutes ?? 180;
        const today = getDateOnlyInZone(new Date(), tz);
        const tomorrow = addDaysUtc(today, 1);
        const nowMinutes = getNowMinutesInZone(new Date(), tz);

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const studentWhere: any = { schoolId, isActive: true };
        if (user.role === "TEACHER") {
          const { classFilter } = await getTeacherClassFilter({
            teacherId: user.sub,
            requestedClassId: classId,
          });
          studentWhere.classId = classFilter;
        } else if (classId) {
          studentWhere.classId = classId;
        }

        const students = await attendanceRepo.student.findMany({
          where: studentWhere,
          include: { class: true },
        });

        const studentIds = students.map((s) => s.id);

        const records = await attendanceRepo.dailyAttendance.findMany({
          where: {
            schoolId,
            date: { gte: today, lt: tomorrow },
            studentId: { in: studentIds },
          },
        });

        const recordsMap = new Map(records.map((r) => [r.studentId, r]));

        const result = students.map((student) => {
          const record = recordsMap.get(student.id);
          const effectiveStatus = computeAttendanceStatus({
            dbStatus: record?.status || null,
            classStartTime: student.class?.startTime || null,
            absenceCutoffMinutes: cutoff,
            nowMinutes,
          });

          return {
            id: record?.id || null,
            studentId: student.id,
            schoolId: student.schoolId,
            date: today,
            status: effectiveStatus,
            firstScanTime: record?.firstScanTime || null,
            lastScanTime: record?.lastScanTime || null,
            lastInTime: record?.lastInTime || null,
            lastOutTime: record?.lastOutTime || null,
            currentlyInSchool: record?.currentlyInSchool || false,
            scanCount: record?.scanCount || 0,
            lateMinutes: record?.lateMinutes || null,
            notes: record?.notes || null,
            student: student,
          };
        });

        if (status) {
          return result.filter((r) => r.status === status);
        }

        return result;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/attendance/report",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { startDate, endDate, classId, status } = request.query as any;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const fromDate = new Date(`${startDate}T00:00:00Z`);
        const toDate = new Date(`${endDate}T23:59:59Z`);

        const where: any = {
          schoolId,
          date: { gte: fromDate, lte: toDate },
        };

        if (classId) {
          if (user.role === "TEACHER") {
            const allowed = await attendanceRepo.teacherClass.findUnique({
              where: {
                teacherId_classId: { teacherId: user.sub, classId },
              } as any,
              select: { classId: true },
            });
            if (!allowed) return reply.status(403).send({ error: "forbidden" });
          }
          where.student = { classId };
        } else if (user.role === "TEACHER") {
          const rows = await attendanceRepo.teacherClass.findMany({
            where: { teacherId: user.sub },
            select: { classId: true },
          });
          const classIds = rows.map((r) => r.classId);
          where.student = {
            classId: { in: classIds.length ? classIds : ["__none__"] },
          };
        }

        if (status) {
          where.status = status;
        }

        const records = await attendanceRepo.dailyAttendance.findMany({
          where,
          include: {
            student: { include: { class: true } },
          },
          orderBy: { date: "desc" },
        });
        return records;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


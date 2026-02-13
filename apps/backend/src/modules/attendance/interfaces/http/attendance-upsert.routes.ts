import { FastifyInstance } from "fastify";
import { AttendanceHttpDeps } from "./attendance.routes.deps";

export function registerAttendanceUpsertRoutes(
  fastify: FastifyInstance,
  deps: AttendanceHttpDeps,
) {
  const { attendanceRepo, requireRoles, requireSchoolScope, sendHttpError, logAudit } =
    deps;

  fastify.post(
    "/schools/:schoolId/attendance/upsert",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { studentId, date, status, notes } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER"]);
        requireSchoolScope(user, schoolId);

        if (user.role === "TEACHER") {
          const student = await attendanceRepo.student.findUnique({
            where: { id: studentId },
            select: { classId: true },
          });
          if (!student)
            return reply.status(404).send({ error: "student not found" });

          if (!student.classId) {
            return reply
              .status(400)
              .send({ error: "student has no assigned class" });
          }

          const allowed = await attendanceRepo.teacherClass.findUnique({
            where: {
              teacherId_classId: {
                teacherId: user.sub,
                classId: student.classId,
              },
            },
          });
          if (!allowed) return reply.status(403).send({ error: "forbidden" });

          if (status && status !== "EXCUSED") {
            return reply
              .status(403)
              .send({ error: "Teachers can only mark as EXCUSED" });
          }
        }

        const dateObj = new Date(date);

        const existing = await attendanceRepo.dailyAttendance.findUnique({
          where: {
            studentId_date: { studentId, date: dateObj },
          },
        });

        const record = await attendanceRepo.dailyAttendance.upsert({
          where: {
            studentId_date: { studentId, date: dateObj },
          },
          update: {
            status,
            notes,
            schoolId,
          },
          create: {
            studentId,
            date: dateObj,
            status,
            notes,
            schoolId,
          },
        });

        logAudit(fastify, {
          action: "attendance.record.upsert",
          level: "info",
          message: "Upsert orqali holat oâ€˜zgardi",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId,
          studentId,
          extra: {
            oldStatus: existing?.status,
            newStatus: record.status,
            notes,
          },
        });

        return record;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


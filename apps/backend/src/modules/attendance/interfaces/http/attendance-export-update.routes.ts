import { FastifyInstance } from "fastify";
import { AttendanceHttpDeps } from "./attendance.routes.deps";

export function registerAttendanceExportAndUpdateRoutes(
  fastify: FastifyInstance,
  deps: AttendanceHttpDeps,
) {
  const { attendanceRepo,
    ExcelJS,
    requireAttendanceTeacherScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    logAudit,
  } = deps;

  fastify.post(
    "/schools/:schoolId/attendance/export",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { startDate, endDate, classId, status } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const fromDate = new Date(`${startDate}T00:00:00Z`);
        const toDate = new Date(`${endDate}T23:59:59Z`);

        const where: any = { schoolId, date: { gte: fromDate, lte: toDate } };
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
          include: { student: true },
          orderBy: { date: "desc" },
        });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Attendance");
        ws.columns = [
          { header: "Student", key: "student" },
          { header: "Date", key: "date" },
          { header: "Status", key: "status" },
          { header: "Notes", key: "notes" },
        ];
        records.forEach((r) => {
          ws.addRow({
            student: r.student.name,
            date: r.date.toISOString().slice(0, 10),
            status: r.status,
            notes: (r as any).notes || "",
          });
        });

        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        reply.header(
          "Content-Disposition",
          'attachment; filename="attendance.xlsx"',
        );

        const buffer = await wb.xlsx.writeBuffer();
        return reply.send(buffer);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/attendance/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const data = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER"]);
        await requireAttendanceTeacherScope(user, id);

        const existing = await attendanceRepo.dailyAttendance.findUnique({
          where: { id },
        });
        if (!existing) {
          return reply.status(404).send({ error: "not found" });
        }

        if (user.role === "TEACHER") {
          const safe: any = {};
          if (data.notes !== undefined) safe.notes = data.notes;
          if (data.status !== undefined) {
            if (data.status !== "EXCUSED") {
              return reply.status(403).send({ error: "forbidden" });
            }
            safe.status = "EXCUSED";
          }
          const updated = await attendanceRepo.dailyAttendance.update({
            where: { id },
            data: safe,
          });
          logAudit(fastify, {
            action: "attendance.record.update",
            level: "info",
            message: "O'qituvchi holatni yangiladi",
            userId: user.sub,
            userRole: user.role,
            requestId: request.id,
            schoolId: existing.schoolId,
            studentId: existing.studentId,
            extra: {
              recordId: id,
              oldStatus: existing.status,
              newStatus: updated.status,
              notes: safe.notes,
            },
          });
          return updated;
        }

        const updated = await attendanceRepo.dailyAttendance.update({
          where: { id },
          data,
        });

        logAudit(fastify, {
          action: "attendance.record.update",
          level: "info",
          message: "School admin status oâ€˜zgartirdi",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId: existing.schoolId,
          studentId: existing.studentId,
          extra: {
            recordId: id,
            oldStatus: existing.status,
            newStatus: updated.status,
            notes: data.notes,
          },
        });

        return updated;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/attendance/bulk",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        const { ids, status, notes } = request.body as {
          ids: string[];
          status: string;
          notes?: string;
        };

        requireRoles(user, ["SCHOOL_ADMIN"]);

        const updateData: any = { status };
        if (notes !== undefined) updateData.notes = notes;

        const where: any = { id: { in: ids } };
        if (user.role !== "SUPER_ADMIN") {
          where.schoolId = user.schoolId;
        }

        const result = await attendanceRepo.dailyAttendance.updateMany({
          where,
          data: updateData,
        });
        logAudit(fastify, {
          action: "attendance.bulk.update",
          level: "info",
          message: "Bulk holat yangilandi",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          extra: { ids, status, notes },
        });
        return { updated: result.count };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


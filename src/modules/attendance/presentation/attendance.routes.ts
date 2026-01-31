import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import ExcelJS from "exceljs";
import { addDaysUtc, getDateOnlyInZone } from "../../../utils/date";
import {
  getTeacherClassFilter,
  requireRoles,
  requireSchoolScope,
  requireAttendanceTeacherScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import {
  computeAttendanceStatus,
  getNowMinutesInZone,
} from "../../../utils/attendanceStatus";
import { logAudit } from "../../../utils/audit";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/attendance/today",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { classId, status } = request.query as any;

        const school = await prisma.school.findUnique({
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

        // 1. Get students filter
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

        // 2. Fetch all matching students
        const students = await prisma.student.findMany({
          where: studentWhere,
          include: { class: true },
        });

        const studentIds = students.map((s) => s.id);

        // 3. Fetch existing attendance records for today
        const records = await prisma.dailyAttendance.findMany({
          where: {
            schoolId,
            date: { gte: today, lt: tomorrow },
            studentId: { in: studentIds },
          },
        });

        // 4. Create a map for quick lookup
        const recordsMap = new Map(records.map((r) => [r.studentId, r]));

        // 5. Merge and compute status
        const result = students.map((student) => {
          const record = recordsMap.get(student.id);
          const effectiveStatus = computeAttendanceStatus({
            dbStatus: record?.status || null,
            classStartTime: student.class?.startTime || null,
            absenceCutoffMinutes: cutoff,
            nowMinutes,
          });

          return {
            id: record?.id || null, // null means no record in DB yet
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

        // 6. Filter by status if requested
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
          // Teacher must not request another class
          if (user.role === "TEACHER") {
            const allowed = await prisma.teacherClass.findUnique({
              where: {
                teacherId_classId: { teacherId: user.sub, classId },
              } as any,
              select: { classId: true },
            });
            if (!allowed) return reply.status(403).send({ error: "forbidden" });
          }
          where.student = { classId };
        } else if (user.role === "TEACHER") {
          const rows = await prisma.teacherClass.findMany({
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

        const records = await prisma.dailyAttendance.findMany({
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
            const allowed = await prisma.teacherClass.findUnique({
              where: {
                teacherId_classId: { teacherId: user.sub, classId },
              } as any,
              select: { classId: true },
            });
            if (!allowed) return reply.status(403).send({ error: "forbidden" });
          }
          where.student = { classId };
        } else if (user.role === "TEACHER") {
          const rows = await prisma.teacherClass.findMany({
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

        const records = await prisma.dailyAttendance.findMany({
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

        const existing = await prisma.dailyAttendance.findUnique({
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
          const updated = await prisma.dailyAttendance.update({
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

        const updated = await prisma.dailyAttendance.update({
          where: { id },
          data,
        });

        logAudit(fastify, {
          action: "attendance.record.update",
          level: "info",
          message: "School admin status o‘zgartirdi",
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

        const result = await prisma.dailyAttendance.updateMany({
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

  // New endpoint for upserting attendance (marking even if no record exists)
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

        // If teacher, check if student is in their class
        if (user.role === "TEACHER") {
          const student = await prisma.student.findUnique({
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

          const allowed = await prisma.teacherClass.findUnique({
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

        const existing = await prisma.dailyAttendance.findUnique({
          where: {
            studentId_date: { studentId, date: dateObj },
          },
        });

        const record = await prisma.dailyAttendance.upsert({
          where: {
            studentId_date: { studentId, date: dateObj },
          },
          update: {
            status,
            notes,
            schoolId, // ensure schoolId is set
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
          message: "Upsert orqali holat o‘zgardi",
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

import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import ExcelJS from "exceljs";
import {
  addDaysUtc,
  getDateOnlyInZone,
  getDateRangeInZone,
  DateRangeType,
} from "../../../utils/date";
import {
  requireRoles,
  requireSchoolScope,
  requireStudentSchoolScope,
  requireTeacherClassScope,
  getTeacherClassFilter,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import {
  calculateAttendancePercent,
  computeAttendanceStatus,
  getNowMinutesInZone,
  EffectiveStatus,
} from "../../../utils/attendanceStatus";

export default async function (fastify: FastifyInstance) {
  // Students list with period-based attendance stats
  fastify.get(
    "/schools/:schoolId/students",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const {
          page = 1,
          search = "",
          classId,
          period,
          startDate,
          endDate,
        } = request.query as any;
        const take = 50;
        const skip = (Number(page) - 1) * take;

        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        // Vaqt oralig'ini hisoblash
        const school = await prisma.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true, absenceCutoffMinutes: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";
        const absenceCutoffMinutes = school?.absenceCutoffMinutes ?? 180;
        const dateRange = getDateRangeInZone(
          period || "today",
          tz,
          startDate,
          endDate,
        );
        const isSingleDay =
          dateRange.startDate.getTime() === dateRange.endDate.getTime();
        const today = getDateOnlyInZone(new Date(), tz);
        const isToday =
          isSingleDay && dateRange.startDate.getTime() === today.getTime();

        const where: any = {
          schoolId,
          isActive: true,
        };

        if (search) {
          where.name = { contains: search, mode: "insensitive" };
        }

        if (user.role === "TEACHER") {
          const { classFilter } = await getTeacherClassFilter({
            teacherId: user.sub,
            requestedClassId: classId,
          });
          where.classId = classFilter;
        } else {
          if (classId) {
            where.classId = classId;
          }
        }

        const [students, total] = await Promise.all([
          prisma.student.findMany({
            where,
            skip,
            take,
            include: { class: true },
            orderBy: { name: "asc" },
          }),
          prisma.student.count({ where }),
        ]);

        const studentIds = students.map((s) => s.id);

        // Vaqt oralig'iga qarab attendance olish
        const dateFilter = {
          date: {
            gte: dateRange.startDate,
            lt: addDaysUtc(dateRange.endDate, 1),
          },
        };

        const periodAttendance = await prisma.dailyAttendance.findMany({
          where: {
            studentId: { in: studentIds },
            ...dateFilter,
          },
          select: {
            studentId: true,
            status: true,
            firstScanTime: true,
            date: true,
          },
        });

        // Har bir student uchun statistikani hisoblash
        const studentStatsMap = new Map<
          string,
          {
            presentCount: number;
            lateCount: number;
            absentCount: number;
            excusedCount: number;
            totalDays: number;
            lastStatus: string | null;
            lastFirstScan: Date | null;
          }
        >();

        // Studentlar uchun boshlang'ich qiymatlar
        studentIds.forEach((id) => {
          studentStatsMap.set(id, {
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            excusedCount: 0,
            totalDays: 0,
            lastStatus: null,
            lastFirstScan: null,
          });
        });

        // Attendance ma'lumotlarini yig'ish
        periodAttendance.forEach((a) => {
          const stats = studentStatsMap.get(a.studentId);
          if (stats) {
            stats.totalDays++;
            if (a.status === "PRESENT") stats.presentCount++;
            else if (a.status === "LATE") stats.lateCount++;
            else if (a.status === "ABSENT") stats.absentCount++;
            else if (a.status === "EXCUSED") stats.excusedCount++;

            // Oxirgi sanani saqlash (bugun yoki oxirgi kun uchun)
            if (
              !stats.lastFirstScan ||
              (a.firstScanTime && a.date > (stats.lastFirstScan as any))
            ) {
              stats.lastStatus = a.status;
              stats.lastFirstScan = a.firstScanTime;
            }
          }
        });

        // Add attendance stats to each student
        const now = new Date();
        const nowMinutes = getNowMinutesInZone(now, tz);

        const studentsWithStatus = students.map((s) => {
          const stats = studentStatsMap.get(s.id);
          let todayEffectiveStatus: EffectiveStatus | null = null;

          if (isSingleDay) {
            if (isToday) {
              // Use centralized utility for consistent status calculation
              todayEffectiveStatus = computeAttendanceStatus({
                dbStatus: stats?.lastStatus || null,
                classStartTime: s.class?.startTime || null,
                absenceCutoffMinutes,
                nowMinutes,
              });
            } else {
              // Past date with no record => absent, future date => pending
              todayEffectiveStatus =
                (stats?.lastStatus as EffectiveStatus) ||
                (dateRange.startDate.getTime() < today.getTime()
                  ? "ABSENT"
                  : "PENDING_EARLY");
            }
          }
          return {
            ...s,
            // Bitta kun uchun - to'g'ridan-to'g'ri status
            todayStatus: isSingleDay ? stats?.lastStatus || null : null,
            todayFirstScan: isSingleDay ? stats?.lastFirstScan || null : null,
            todayEffectiveStatus: isSingleDay ? todayEffectiveStatus : null,
            // Ko'p kunlik statistika
            periodStats: !isSingleDay
              ? {
                  presentCount: stats?.presentCount || 0,
                  lateCount: stats?.lateCount || 0,
                  absentCount: stats?.absentCount || 0,
                  excusedCount: stats?.excusedCount || 0,
                  totalDays: stats?.totalDays || 0,
                  attendancePercent: stats
                    ? calculateAttendancePercent(
                        stats.presentCount,
                        stats.lateCount,
                        stats.totalDays,
                      )
                    : 0,
                }
              : null,
          };
        });

        // Umumiy statistika
        const overallStats = {
          total,
          present: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "PRESENT")
                .length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.presentCount || 0),
                0,
              ),
          late: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "LATE").length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.lateCount || 0),
                0,
              ),
          absent: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "ABSENT")
                .length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.absentCount || 0),
                0,
              ),
          excused: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "EXCUSED")
                .length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.excusedCount || 0),
                0,
              ),
          pending: isSingleDay
            ? studentsWithStatus.filter(
                (s) =>
                  s.todayEffectiveStatus === "PENDING_EARLY" ||
                  s.todayEffectiveStatus === "PENDING_LATE",
              ).length
            : 0,
          pendingEarly: isSingleDay
            ? studentsWithStatus.filter(
                (s) => s.todayEffectiveStatus === "PENDING_EARLY",
              ).length
            : 0,
          pendingLate: isSingleDay
            ? studentsWithStatus.filter(
                (s) => s.todayEffectiveStatus === "PENDING_LATE",
              ).length
            : 0,
        };

        return {
          data: studentsWithStatus,
          total,
          page: Number(page),
          period: period || "today",
          periodLabel: dateRange.label,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
          isSingleDay,
          stats: overallStats,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/students",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const body = request.body;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        // ✅ classId majburiy
        if (!body.classId) {
          return reply.status(400).send({ error: "Sinf tanlanishi shart" });
        }

        // Sinf mavjudligini tekshirish
        const classExists = await prisma.class.findFirst({
          where: { id: body.classId, schoolId },
        });
        if (!classExists) {
          return reply.status(400).send({ error: "Bunday sinf topilmadi" });
        }

        const student = await prisma.student.create({
          data: { ...body, schoolId },
        });
        return student;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/students/export",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const students = await prisma.student.findMany({
          where: { schoolId, isActive: true },
          include: { class: true },
          orderBy: { name: "asc" },
        });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Students");
        ws.columns = [
          { header: "Name", key: "name", width: 30 },
          { header: "Device ID", key: "deviceStudentId", width: 15 },
          { header: "Class", key: "class", width: 15 },
          { header: "Parent Name", key: "parentName", width: 25 },
          { header: "Parent Phone", key: "parentPhone", width: 20 },
        ];

        students.forEach((s) => {
          ws.addRow({
            name: s.name,
            deviceStudentId: s.deviceStudentId,
            class: s.class?.name || "",
            parentName: s.parentName || "",
            parentPhone: s.parentPhone || "",
          });
        });

        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        reply.header(
          "Content-Disposition",
          'attachment; filename="students.xlsx"',
        );

        const buffer = await wb.xlsx.writeBuffer();
        return reply.send(buffer);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/students/template",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Students");
        ws.columns = [
          { header: "Name", key: "name", width: 30 },
          { header: "Device ID", key: "deviceStudentId", width: 15 },
          { header: "Class", key: "class", width: 15 },
          { header: "Parent Name", key: "parentName", width: 25 },
          { header: "Parent Phone", key: "parentPhone", width: 20 },
        ];

        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        reply.header(
          "Content-Disposition",
          'attachment; filename="students-template.xlsx"',
        );

        const buffer = await wb.xlsx.writeBuffer();
        return reply.send(buffer);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/students/import",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { createMissingClass } = request.query as any;
        const allowCreateMissingClass = String(createMissingClass) === "true";

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const files = request.body?.file;
        const file = Array.isArray(files) ? files[0] : files;
        if (!file || !file.data) {
          return reply.status(400).send({ error: "No file uploaded" });
        }

        const filename = String(file.filename || "");
        const mimetype = String(file.mimetype || "").toLowerCase();
        if (!filename.toLowerCase().endsWith(".xlsx")) {
          return reply.status(400).send({ error: "Invalid file type" });
        }
        if (
          mimetype &&
          mimetype !==
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ) {
          return reply.status(400).send({ error: "Invalid file type" });
        }

        const buffer = file.data;
        if (buffer.length > 5 * 1024 * 1024) {
          return reply.status(400).send({ error: "File too large" });
        }

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.getWorksheet(1);
        if (!ws) return reply.status(400).send({ error: "Invalid sheet" });

        const expectedHeaders = [
          "name",
          "device id",
          "class",
          "parent name",
          "parent phone",
        ];
        const headerValues = expectedHeaders.map((_, idx) =>
          String(ws.getRow(1).getCell(idx + 1).text || "")
            .trim()
            .toLowerCase(),
        );
        const headerMismatch = expectedHeaders.some(
          (h, i) => headerValues[i] !== h,
        );
        if (headerMismatch) {
          return reply.status(400).send({
            error: "Header mismatch. Please use the exported template.",
          });
        }

        const classRows = await prisma.class.findMany({
          where: { schoolId },
          select: { id: true, name: true },
        });
        const classMap = new Map(
          classRows.map((c) => [c.name.trim().toLowerCase(), c]),
        );

        const seenDeviceIds = new Set<string>();
        let importedCount = 0;
        let skippedCount = 0;
        const errors: Array<{ row: number; message: string }> = [];

        const lastRow = ws.actualRowCount || ws.rowCount;
        const rows: Array<{
          row: number;
          name: string;
          deviceStudentId: string;
          className: string;
          parentName: string;
          parentPhone: string;
        }> = [];
        const missingClassNames = new Set<string>();

        for (let i = 2; i <= lastRow; i++) {
          const row = ws.getRow(i);
          const name = row.getCell(1).text.trim();
          const deviceStudentId = row.getCell(2).text.trim();
          const className = row.getCell(3).text.trim();
          const parentName = row.getCell(4).text.trim();
          const parentPhone = row.getCell(5).text.trim();

          if (!name || !deviceStudentId) {
            skippedCount++;
            errors.push({ row: i, message: "Name and Device ID are required" });
            continue;
          }
          if (seenDeviceIds.has(deviceStudentId)) {
            skippedCount++;
            errors.push({ row: i, message: "Duplicate Device ID in file" });
            continue;
          }
          seenDeviceIds.add(deviceStudentId);

          if (className) {
            const key = className.toLowerCase();
            if (!classMap.has(key)) {
              if (!allowCreateMissingClass) {
                skippedCount++;
                errors.push({
                  row: i,
                  message: "Class not found (enable createMissingClass)",
                });
                continue;
              }
              missingClassNames.add(className);
            }
          }

          rows.push({
            row: i,
            name,
            deviceStudentId,
            className,
            parentName,
            parentPhone,
          });
        }

        if (allowCreateMissingClass && missingClassNames.size > 0) {
          const createOps = Array.from(missingClassNames).map((name) =>
            prisma.class.create({
              data: { name, schoolId, gradeLevel: 1, startTime: "08:00" },
            }),
          );
          const created = await prisma.$transaction(createOps);
          created.forEach((cls) => {
            classMap.set(cls.name.trim().toLowerCase(), cls);
          });
        }

        const ops = rows.map((r) => {
          const classId = r.className
            ? classMap.get(r.className.toLowerCase())?.id || null
            : null;
          return prisma.student.upsert({
            where: {
              schoolId_deviceStudentId: {
                schoolId,
                deviceStudentId: r.deviceStudentId,
              },
            },
            update: {
              name: r.name,
              classId,
              parentName: r.parentName || null,
              parentPhone: r.parentPhone || null,
              isActive: true,
            },
            create: {
              name: r.name,
              deviceStudentId: r.deviceStudentId,
              classId,
              parentName: r.parentName || null,
              parentPhone: r.parentPhone || null,
              schoolId,
            },
          });
        });

        const chunkSize = 200;
        for (let i = 0; i < ops.length; i += chunkSize) {
          const chunk = ops.slice(i, i + chunkSize);
          await prisma.$transaction(chunk);
          importedCount += chunk.length;
        }

        return { imported: importedCount, skipped: skippedCount, errors };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        const student = await requireStudentSchoolScope(user, id);

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        const fullStudent = await prisma.student.findUnique({
          where: { id },
          include: { class: true },
        });
        if (!fullStudent) return reply.status(404).send({});
        return fullStudent;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/students/:id/attendance",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        const student = await requireStudentSchoolScope(user, id);

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        const attendance = await prisma.dailyAttendance.findMany({
          where: { studentId: id },
          orderBy: { date: "desc" },
        });
        return attendance;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Kirdi-chiqdi eventlar tarixi
  fastify.get(
    "/students/:id/events",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const { date } = request.query as { date?: string };

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        const student = await requireStudentSchoolScope(user, id);

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        const where: any = { studentId: id };
        if (date) {
          const startOfDay = new Date(`${date}T00:00:00Z`);
          const endOfDay = new Date(`${date}T23:59:59Z`);
          where.timestamp = { gte: startOfDay, lte: endOfDay };
        }

        const events = await prisma.attendanceEvent.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: 100,
          include: {
            device: true,
          },
        });
        return events;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const data = request.body;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        await requireStudentSchoolScope(user, id);

        const student = await prisma.student.update({ where: { id }, data });
        return student;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        await requireStudentSchoolScope(user, id);

        const student = await prisma.student.update({
          where: { id },
          data: { isActive: false },
        });
        return student;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

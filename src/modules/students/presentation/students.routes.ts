import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
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
import {
  DEVICE_AUTO_REGISTER_ENABLED,
  PROVISIONING_TOKEN,
  DEVICE_STUDENT_ID_STRATEGY,
  DEVICE_STUDENT_ID_LENGTH,
} from "../../../config";
import crypto from "crypto";

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\*/, "")
    .trim()
    .toLowerCase();
}

type ProvisioningAuth = { user: any | null; tokenAuth: boolean };

async function ensureProvisioningAuth(
  request: any,
  reply: any,
  schoolId: string,
): Promise<ProvisioningAuth | null> {
  try {
    await request.jwtVerify();
    const user = request.user;
    requireRoles(user, ["SCHOOL_ADMIN"]);
    requireSchoolScope(user, schoolId);
    return { user, tokenAuth: false };
  } catch {
    const token =
      (request.headers["x-provisioning-token"] as string | undefined) ||
      (request.headers["authorization"] as string | undefined)?.replace(
        /^Bearer\s+/i,
        "",
      );
    if (PROVISIONING_TOKEN && token === PROVISIONING_TOKEN) {
      return { user: null, tokenAuth: true };
    }
    reply.status(401).send({ error: "Unauthorized" });
    return null;
  }
}

function computeProvisioningStatus(
  links: Array<{ status: "PENDING" | "SUCCESS" | "FAILED" }>,
): "PROCESSING" | "PARTIAL" | "CONFIRMED" | "FAILED" {
  if (links.length === 0) return "PROCESSING";
  const success = links.filter((l) => l.status === "SUCCESS").length;
  const failed = links.filter((l) => l.status === "FAILED").length;
  if (success === links.length) return "CONFIRMED";
  if (failed === links.length) return "FAILED";
  if (failed > 0) return "PARTIAL";
  return "PROCESSING";
}

async function generateDeviceStudentId(
  tx: Prisma.TransactionClient,
  schoolId: string,
): Promise<string> {
  const strategy = DEVICE_STUDENT_ID_STRATEGY;
  if (strategy === "numeric") {
    const length = Math.max(6, Math.min(20, DEVICE_STUDENT_ID_LENGTH || 10));
    for (let i = 0; i < 10; i++) {
      let value = "";
      while (value.length < length) {
        value += Math.floor(Math.random() * 10).toString();
      }
      value = value.substring(0, length);
      const existing = await tx.student.findUnique({
        where: {
          schoolId_deviceStudentId: { schoolId, deviceStudentId: value },
        },
        select: { id: true },
      });
      if (!existing) return value;
    }
    throw Object.assign(new Error("Failed to generate numeric device ID"), {
      statusCode: 500,
    });
  }
  return crypto.randomUUID();
}

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

        // Match iVMS "Person Information Template.xlsx" layout exactly:
        // - A1..A8: rules
        // - Row 9: headers
        // - Add one extra column at the end: Photo
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Sheet1");

        const rules = [
          "\tRule:",
          "\t1.The items with asterisk are required.",
          "\t2.Gender 1:Male 2:Female",
          "\t3.Date Format:YYYY/MM/DD",
          "\t4.Seperate the card numbers with semicolon.",
          "\t5.If the card number is started with 0, add ' before 0. For example, '012345.",
          "\t6.Separate the organization hierarchies with /.",
          "\t7.Format of Room No.:Take room 1 as an example, the room No. should be 1 or 1-1-1-1 (Project-Building-Unit-Room No.).",
        ];
        rules.forEach((text, idx) => {
          ws.getCell(`A${idx + 1}`).value = text;
        });

        const headers = [
          "*Person ID",
          "*Organization",
          "*Person Name",
          "*Gender",
          "Contact",
          "Email",
          "Effective Time",
          "Expiry Time",
          "Card No.",
          "Room No.",
          "Floor No.",
          "Photo",
        ];
        headers.forEach((h, idx) => {
          ws.getRow(9).getCell(idx + 1).value = h;
        });

        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        reply.header(
          "Content-Disposition",
          'attachment; filename="talabalar-shablon.xlsx"',
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
        // Template may include embedded photos; allow larger imports.
        if (buffer.length > 50 * 1024 * 1024) {
          return reply.status(400).send({ error: "File too large" });
        }

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const ws = wb.getWorksheet(1);
        if (!ws) return reply.status(400).send({ error: "Invalid sheet" });

        // Find header row (either row 1 for internal templates, or row 9 for iVMS-style template).
        let headerRowNumber = 1;
        for (let r = 1; r <= 30; r++) {
          const row = ws.getRow(r);
          const texts = Array.from({ length: 20 }, (_, i) =>
            normalizeHeader(String(row.getCell(i + 1).text || "")),
          ).filter(Boolean);
          if (
            texts.includes("person id") &&
            (texts.includes("person name") ||
              texts.includes("name") ||
              texts.includes("ism"))
          ) {
            headerRowNumber = r;
            break;
          }
          if (texts.includes("device id") && (texts.includes("name") || texts.includes("ism"))) {
            headerRowNumber = r;
            break;
          }
        }

        const headerRow = ws.getRow(headerRowNumber);
        const headerMap = new Map<string, number>();
        for (let c = 1; c <= 50; c++) {
          const raw = String(headerRow.getCell(c).text || "");
          const key = normalizeHeader(raw);
          if (!key) continue;
          if (!headerMap.has(key)) headerMap.set(key, c);
        }

        const isIvmsTemplate =
          headerMap.has("person id") &&
          headerMap.has("organization") &&
          headerMap.has("person name") &&
          headerMap.has("gender");

        const isLegacyInternal =
          headerMap.has("name") &&
          headerMap.has("device id") &&
          headerMap.has("class") &&
          headerMap.has("parent name") &&
          headerMap.has("parent phone");

        const isNewInternal =
          (headerMap.has("name") || headerMap.has("ism")) &&
          headerMap.has("person id") &&
          (headerMap.has("class") || headerMap.has("sinf")) &&
          (headerMap.has("parent name") || headerMap.has("ota-ona ismi")) &&
          (headerMap.has("parent phone") || headerMap.has("ota-ona telefoni"));

        if (!isIvmsTemplate && !isLegacyInternal && !isNewInternal) {
          return reply.status(400).send({
            error: "Header mismatch. Please use the exported template.",
          });
        }

        const dataStartRow = headerRowNumber + 1;
        const colName =
          headerMap.get("person name") ?? headerMap.get("name") ?? headerMap.get("ism");
        const colPersonId =
          headerMap.get("person id") ?? headerMap.get("device id");
        const colClass =
          headerMap.get("organization") ??
          headerMap.get("class") ??
          headerMap.get("sinf");
        const colParentName =
          headerMap.get("parent name") ?? headerMap.get("ota-ona ismi");
        const colParentPhone =
          headerMap.get("parent phone") ?? headerMap.get("ota-ona telefoni") ?? headerMap.get("contact");

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

        for (let i = dataStartRow; i <= lastRow; i++) {
          const row = ws.getRow(i);
          const name = colName ? row.getCell(colName).text.trim() : "";
          const deviceStudentId = colPersonId
            ? row.getCell(colPersonId).text.trim()
            : "";
          const className = colClass ? row.getCell(colClass).text.trim() : "";
          const parentName = colParentName
            ? row.getCell(colParentName).text.trim()
            : "";
          const parentPhone = colParentPhone
            ? row.getCell(colParentPhone).text.trim()
            : "";

          if (!name || !deviceStudentId) {
            skippedCount++;
            errors.push({
              row: i,
              message: isIvmsTemplate
                ? "Person Name and Person ID are required"
                : "Name and Person ID are required",
            });
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
        const data = request.body || {};

        requireRoles(user, ["SCHOOL_ADMIN"]);
        const studentScope = await requireStudentSchoolScope(user, id);

        // Allowlist fields and normalize empty strings to null
        const sanitized = {
          name: data.name,
          classId: data.classId,
          deviceStudentId:
            typeof data.deviceStudentId === "string" &&
            data.deviceStudentId.trim() === ""
              ? null
              : data.deviceStudentId,
          parentName:
            typeof data.parentName === "string" && data.parentName.trim() === ""
              ? null
              : data.parentName,
          parentPhone:
            typeof data.parentPhone === "string" && data.parentPhone.trim() === ""
              ? null
              : data.parentPhone,
        };

        if (!sanitized.name) {
          return reply.status(400).send({ error: "Ismni kiriting" });
        }

        if (!sanitized.classId) {
          return reply.status(400).send({ error: "Sinf tanlanishi shart" });
        }

        const classExists = await prisma.class.findFirst({
          where: { id: sanitized.classId, schoolId: studentScope.schoolId },
        });
        if (!classExists) {
          return reply.status(400).send({ error: "Bunday sinf topilmadi" });
        }

        const student = await prisma.student.update({
          where: { id },
          data: sanitized,
        });
        return student;
      } catch (err: any) {
        if (err?.code === "P2002") {
          return reply
            .status(400)
            .send({ error: "Qurilma ID takrorlangan" });
        }
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

  // Start provisioning: create/update student, then return provisioningId + deviceStudentId
  fastify.post(
    "/schools/:schoolId/students/provision",
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params as { schoolId: string };
        const auth = await ensureProvisioningAuth(request, reply, schoolId);
        if (!auth) return;

        const body = request.body || {};
        const studentPayload = body.student || body;
        const studentId = body.studentId as string | undefined;
        const requestId = body.requestId ? String(body.requestId) : undefined;
        const targetDeviceIds = Array.isArray(body.targetDeviceIds)
          ? (body.targetDeviceIds as string[])
          : [];
        const targetAllActive = body.targetAllActive !== false;

        if (!studentPayload?.name) {
          return reply.status(400).send({ error: "Name is required" });
        }

        let classId: string | null = null;
        const providedDeviceStudentId =
          typeof studentPayload.deviceStudentId === "string"
            ? studentPayload.deviceStudentId.trim()
            : "";

        if (
          providedDeviceStudentId &&
          DEVICE_STUDENT_ID_STRATEGY === "numeric" &&
          !/^\d+$/.test(providedDeviceStudentId)
        ) {
          return reply
            .status(400)
            .send({ error: "deviceStudentId must be numeric" });
        }
        if (studentPayload.classId) {
          const classExists = await prisma.class.findFirst({
            where: { id: String(studentPayload.classId), schoolId },
          });
          if (!classExists) {
            return reply.status(400).send({ error: "Class not found" });
          }
          classId = String(studentPayload.classId);
        }

        const result = await prisma.$transaction(async (tx) => {
          if (requestId) {
            const existing = await tx.studentProvisioning.findFirst({
              where: { requestId, schoolId },
              include: {
                student: true,
                devices: { include: { device: true } },
              },
            });
            if (existing) {
              return {
                student: existing.student,
                provisioning: existing,
                targetDevices: existing.devices.map((link: any) => link.device),
              };
            }
          }

          let studentRecord;
          let deviceStudentId =
            providedDeviceStudentId !== "" ? providedDeviceStudentId : null;

          if (studentId) {
            const existingStudent = await tx.student.findUnique({
              where: { id: studentId },
            });
            if (!existingStudent) {
              throw Object.assign(new Error("Student not found"), {
                statusCode: 404,
              });
            }
            if (existingStudent.schoolId !== schoolId) {
              throw Object.assign(new Error("forbidden"), { statusCode: 403 });
            }

            if (
              deviceStudentId &&
              existingStudent.deviceStudentId &&
              deviceStudentId !== existingStudent.deviceStudentId
            ) {
              throw Object.assign(
                new Error("DeviceStudentId mismatch"),
                { statusCode: 400 },
              );
            }

            deviceStudentId =
              existingStudent.deviceStudentId ||
              deviceStudentId ||
              (await generateDeviceStudentId(tx, schoolId));

            studentRecord = await tx.student.update({
              where: { id: existingStudent.id },
              data: {
                name: studentPayload.name,
                classId,
                parentName: studentPayload.parentName || null,
                parentPhone: studentPayload.parentPhone || null,
                deviceStudentId,
                isActive: true,
              },
            });
          } else {
            deviceStudentId =
              deviceStudentId || (await generateDeviceStudentId(tx, schoolId));
            studentRecord = await tx.student.upsert({
              where: {
                schoolId_deviceStudentId: { schoolId, deviceStudentId },
              },
              update: {
                name: studentPayload.name,
                classId,
                parentName: studentPayload.parentName || null,
                parentPhone: studentPayload.parentPhone || null,
                isActive: true,
              },
              create: {
                name: studentPayload.name,
                classId,
                parentName: studentPayload.parentName || null,
                parentPhone: studentPayload.parentPhone || null,
                deviceStudentId,
                schoolId,
              },
            });
          }

          const provisioning = await tx.studentProvisioning.create({
            data: {
              studentId: studentRecord.id,
              schoolId,
              status: "PROCESSING",
              requestId,
            },
          });

          let targetDevices: Array<{ id: string; deviceId: string }> = [];
          if (targetDeviceIds.length > 0) {
            targetDevices = await tx.device.findMany({
              where: { id: { in: targetDeviceIds }, schoolId },
              select: { id: true, deviceId: true },
            });
          } else if (targetAllActive) {
            targetDevices = await tx.device.findMany({
              where: { schoolId, isActive: true },
              select: { id: true, deviceId: true },
            });
          }

          if (targetDevices.length > 0) {
            await tx.studentDeviceLink.createMany({
              data: targetDevices.map((d) => ({
                studentId: studentRecord.id,
                deviceId: d.id,
                provisioningId: provisioning.id,
              })),
            });
          }

          let status = provisioning.status;
          let lastError: string | null = null;
          if ((targetDeviceIds.length > 0 || targetAllActive) && targetDevices.length === 0) {
            status = "FAILED";
            lastError = "No target devices found";
          }

          const updatedProvisioning = await tx.studentProvisioning.update({
            where: { id: provisioning.id },
            data: { status, lastError },
          });

          await tx.student.update({
            where: { id: studentRecord.id },
            data: {
              deviceSyncStatus: status,
              deviceSyncUpdatedAt: new Date(),
            },
          });

          return {
            student: studentRecord,
            provisioning: updatedProvisioning,
            targetDevices,
          };
        });

        return {
          student: result.student,
          studentId: result.student.id,
          provisioningId: result.provisioning.id,
          deviceStudentId: result.student.deviceStudentId,
          provisioningStatus: result.provisioning.status,
          targetDevices: result.targetDevices,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Provisioning status
  fastify.get("/provisioning/:id", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const provisioning = await prisma.studentProvisioning.findUnique({
        where: { id },
        include: {
          student: true,
          devices: { include: { device: true } },
        },
      });
      if (!provisioning) {
        return reply.status(404).send({ error: "Provisioning not found" });
      }

      const auth = await ensureProvisioningAuth(
        request,
        reply,
        provisioning.schoolId,
      );
      if (!auth) return;

      return provisioning;
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });

  // Report per-device result
  fastify.post("/provisioning/:id/device-result", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body || {};

      const status = String(body.status || "").toUpperCase() as
        | "SUCCESS"
        | "FAILED";
      if (!["SUCCESS", "FAILED"].includes(status)) {
        return reply.status(400).send({ error: "Invalid status" });
      }

      const provisioning = await prisma.studentProvisioning.findUnique({
        where: { id },
      });
      if (!provisioning) {
        return reply.status(404).send({ error: "Provisioning not found" });
      }

      const auth = await ensureProvisioningAuth(
        request,
        reply,
        provisioning.schoolId,
      );
      if (!auth) return;

      const deviceId = body.deviceId ? String(body.deviceId) : null;
      const deviceExternalId = body.deviceExternalId
        ? String(body.deviceExternalId)
        : null;

      if (!deviceId && !deviceExternalId) {
        return reply.status(400).send({ error: "deviceId or deviceExternalId is required" });
      }

      let device = null;
      if (deviceId) {
        device = await prisma.device.findFirst({
          where: { id: deviceId, schoolId: provisioning.schoolId },
        });
      } else if (deviceExternalId) {
        device = await prisma.device.findFirst({
          where: { deviceId: deviceExternalId, schoolId: provisioning.schoolId },
        });
      }

      if (!device && deviceExternalId && DEVICE_AUTO_REGISTER_ENABLED) {
        device = await prisma.device.create({
          data: {
            schoolId: provisioning.schoolId,
            deviceId: deviceExternalId,
            name: body.deviceName || `Auto ${deviceExternalId}`,
            type: body.deviceType || "ENTRANCE",
            location: body.deviceLocation || "Desktop provisioning",
            isActive: true,
          } as any,
        });
      }

      if (!device && body.deviceName) {
        const matches = await prisma.device.findMany({
          where: { schoolId: provisioning.schoolId, name: body.deviceName },
        });
        if (matches.length === 1) {
          device = matches[0];
        } else if (matches.length > 1) {
          return reply.status(400).send({ error: "Multiple devices with same name" });
        }
      }

      if (!device) {
        return reply.status(404).send({ error: "Device not found" });
      }

      const now = new Date();
      const result = await prisma.$transaction(async (tx) => {
        const link = await tx.studentDeviceLink.upsert({
          where: {
            provisioningId_deviceId: {
              provisioningId: id,
              deviceId: device.id,
            },
          } as any,
          update: {
            status,
            lastError: body.error || null,
            employeeNoOnDevice: body.employeeNoOnDevice || null,
            attemptCount: { increment: 1 },
            lastAttemptAt: now,
          },
          create: {
            studentId: provisioning.studentId,
            deviceId: device.id,
            provisioningId: id,
            status,
            lastError: body.error || null,
            employeeNoOnDevice: body.employeeNoOnDevice || null,
            attemptCount: 1,
            lastAttemptAt: now,
          },
        });

        const links = await tx.studentDeviceLink.findMany({
          where: { provisioningId: id },
          select: { status: true },
        });
        const overallStatus = computeProvisioningStatus(
          links as Array<{ status: "PENDING" | "SUCCESS" | "FAILED" }>,
        );

        const updatedProvisioning = await tx.studentProvisioning.update({
          where: { id },
          data: {
            status: overallStatus,
            lastError: status === "FAILED" ? body.error || null : null,
          },
        });

        await tx.student.update({
          where: { id: provisioning.studentId },
          data: {
            deviceSyncStatus: overallStatus,
            deviceSyncUpdatedAt: now,
          },
        });

        return { link, provisioning: updatedProvisioning };
      });

      return {
        ok: true,
        provisioningStatus: result.provisioning.status,
        deviceStatus: result.link.status,
      };
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });

  // Retry provisioning (reset failed links to pending)
  fastify.post("/provisioning/:id/retry", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body || {};

      const provisioning = await prisma.studentProvisioning.findUnique({
        where: { id },
      });
      if (!provisioning) {
        return reply.status(404).send({ error: "Provisioning not found" });
      }

      const auth = await ensureProvisioningAuth(
        request,
        reply,
        provisioning.schoolId,
      );
      if (!auth) return;

      const deviceIds = Array.isArray(body.deviceIds)
        ? (body.deviceIds as string[])
        : [];
      const deviceExternalIds = Array.isArray(body.deviceExternalIds)
        ? (body.deviceExternalIds as string[])
        : [];

      const now = new Date();
      const result = await prisma.$transaction(async (tx) => {
        let targetDeviceIds: string[] = [];
        if (deviceIds.length > 0) {
          targetDeviceIds = deviceIds;
        } else if (deviceExternalIds.length > 0) {
          const devices = await tx.device.findMany({
            where: {
              schoolId: provisioning.schoolId,
              deviceId: { in: deviceExternalIds },
            },
            select: { id: true },
          });
          targetDeviceIds = devices.map((d) => d.id);
        } else {
          const links = await tx.studentDeviceLink.findMany({
            where: { provisioningId: id, status: "FAILED" },
            select: { deviceId: true },
          });
          targetDeviceIds = links.map((l) => l.deviceId);
        }

        if (targetDeviceIds.length === 0) {
          return { updated: 0, targetDeviceIds: [] as string[] };
        }

        const updated = await tx.studentDeviceLink.updateMany({
          where: {
            provisioningId: id,
            deviceId: { in: targetDeviceIds },
          },
          data: {
            status: "PENDING",
            lastError: null,
            lastAttemptAt: now,
          },
        });

        await tx.studentProvisioning.update({
          where: { id },
          data: { status: "PROCESSING", lastError: null },
        });

        await tx.student.update({
          where: { id: provisioning.studentId },
          data: {
            deviceSyncStatus: "PROCESSING",
            deviceSyncUpdatedAt: now,
          },
        });

        return { updated: updated.count, targetDeviceIds };
      });

      return { ok: true, ...result };
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });
}

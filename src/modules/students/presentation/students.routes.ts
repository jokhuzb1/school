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
import fs from "fs";
import path from "path";
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
} from "../services/import-runtime.service";

function normalizeHeader(value: string): string {
  return value
    .trim()
    .replace(/^\*/, "")
    .trim()
    .toLowerCase();
}

function normalizeNamePart(value: string): string {
  return String(value || "").trim();
}

function buildFullName(lastName: string, firstName: string): string {
  const parts = [normalizeNamePart(lastName), normalizeNamePart(firstName)].filter(Boolean);
  return parts.join(" ").trim();
}

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const cleaned = normalizeNamePart(fullName);
  if (!cleaned) return { firstName: "", lastName: "" };
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(" "),
  };
}

function normalizeGender(value: unknown): "MALE" | "FEMALE" | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (["male", "erkak", "m", "1"].includes(raw)) return "MALE";
  if (["female", "ayol", "f", "2"].includes(raw)) return "FEMALE";
  return null;
}

const STUDENT_HAS_SPLIT_NAME_FIELDS = (() => {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "Student");
  const fields = new Set((model?.fields || []).map((f) => f.name));
  return fields.has("firstName") && fields.has("lastName");
})();

function buildDuplicateStudentWhere(params: {
  schoolId: string;
  classId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  excludeId?: string;
}): Prisma.StudentWhereInput {
  const candidates: Prisma.StudentWhereInput[] = [
    {
      name: {
        equals: params.fullName,
        mode: "insensitive",
      },
    },
  ];

  if (STUDENT_HAS_SPLIT_NAME_FIELDS) {
    candidates.push({
      firstName: {
        equals: params.firstName,
        mode: "insensitive",
      },
      lastName: {
        equals: params.lastName,
        mode: "insensitive",
      },
    });
  }

  const where: Prisma.StudentWhereInput = {
    schoolId: params.schoolId,
    classId: params.classId,
    isActive: true,
    OR: candidates,
  };

  if (params.excludeId) {
    where.NOT = { id: params.excludeId };
  }

  return where;
}

async function logProvisioningEvent(params: {
  schoolId: string;
  studentId?: string | null;
  provisioningId?: string | null;
  deviceId?: string | null;
  level?: "INFO" | "WARN" | "ERROR";
  stage: string;
  status?: string | null;
  message?: string | null;
  payload?: Record<string, any> | null;
}) {
  try {
    await prisma.provisioningLog.create({
      data: {
        schoolId: params.schoolId,
        studentId: params.studentId || null,
        provisioningId: params.provisioningId || null,
        deviceId: params.deviceId || null,
        level: params.level || "INFO",
        stage: params.stage,
        status: params.status || null,
        message: params.message || null,
        payload: params.payload || undefined,
      },
    });
  } catch (err) {
    console.error("[ProvisioningLog] Failed to write log:", err);
  }
}

function normalizeBase64(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) return "";
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma !== -1) {
    return trimmed.slice(comma + 1).trim();
  }
  return trimmed;
}

function isBase64(value: string): boolean {
  if (!value) return false;
  try {
    return Buffer.from(value, "base64").toString("base64") === value.replace(/\s+/g, "");
  } catch {
    return false;
  }
}

async function saveStudentFaceImage(params: {
  studentId: string;
  faceImageBase64: string;
}): Promise<string | null> {
  const base64 = normalizeBase64(params.faceImageBase64);
  if (!base64 || !isBase64(base64)) return null;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) return null;
  const uploadsDir = path.join(process.cwd(), "uploads", "student-faces");
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  const filename = `${params.studentId}.jpg`;
  const filePath = path.join(uploadsDir, filename);
  await fs.promises.writeFile(filePath, buffer);
  return `/uploads/student-faces/${filename}`;
}

type ProvisioningAuth = { user: any | null; tokenAuth: boolean };

async function ensureProvisioningAuth(
  request: any,
  reply: any,
  schoolId: string,
): Promise<ProvisioningAuth | null> {
  const tokenFromHeader =
    request.headers?.["x-provisioning-token"] ||
    request.headers?.["X-Provisioning-Token"];
  const tokenFromQuery = request.query?.provisioningToken;
  const authHeader = request.headers?.authorization as string | undefined;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : undefined;
  const providedToken = String(
    tokenFromHeader || tokenFromQuery || bearerToken || "",
  ).trim();

  if (PROVISIONING_TOKEN && providedToken === PROVISIONING_TOKEN) {
    return { user: null, tokenAuth: true };
  }

  try {
    await request.jwtVerify();
    const user = request.user;
    requireRoles(user, ["SCHOOL_ADMIN"]);
    requireSchoolScope(user, schoolId);
    return { user, tokenAuth: false };
  } catch {
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

  // School students with cross-device diagnostics (latest known provisioning result per device)
  fastify.get(
    "/schools/:schoolId/students/device-diagnostics",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { page = 1, search = "", classId } = request.query as any;
        const take = 50;
        const skip = (Number(page) - 1) * take;

        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

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
        } else if (classId) {
          where.classId = classId;
        }

        const [students, total, devices] = await Promise.all([
          prisma.student.findMany({
            where,
            skip,
            take,
            include: {
              class: { select: { id: true, name: true } },
            },
            orderBy: { name: "asc" },
          }),
          prisma.student.count({ where }),
          prisma.device.findMany({
            where: { schoolId, isActive: true },
            select: { id: true, name: true, deviceId: true, isActive: true },
            orderBy: { name: "asc" },
          }),
        ]);

        const studentIds = students.map((s) => s.id);
        const deviceIds = devices.map((d) => d.id);

        const links =
          studentIds.length === 0 || deviceIds.length === 0
            ? []
            : await prisma.studentDeviceLink.findMany({
                where: {
                  studentId: { in: studentIds },
                  deviceId: { in: deviceIds },
                },
                select: {
                  studentId: true,
                  deviceId: true,
                  status: true,
                  lastError: true,
                  updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
              });

        // Keep latest link per student/device pair.
        const latestByPair = new Map<string, (typeof links)[number]>();
        for (const link of links) {
          const key = `${link.studentId}:${link.deviceId}`;
          if (!latestByPair.has(key)) {
            latestByPair.set(key, link);
          }
        }

        const data = students.map((student) => {
          const perDevice = devices.map((device) => {
            const key = `${student.id}:${device.id}`;
            const link = latestByPair.get(key);
            if (!link) {
              return {
                deviceId: device.id,
                deviceName: device.name,
                deviceExternalId: device.deviceId,
                status: "MISSING",
                lastError: null,
                updatedAt: null,
              };
            }

            return {
              deviceId: device.id,
              deviceName: device.name,
              deviceExternalId: device.deviceId,
              status: link.status,
              lastError: link.lastError,
              updatedAt: link.updatedAt?.toISOString() || null,
            };
          });

          return {
            studentId: student.id,
            studentName: student.name,
            firstName: student.firstName,
            lastName: student.lastName,
            fatherName: student.fatherName,
            classId: student.classId,
            className: student.class?.name || null,
            deviceStudentId: student.deviceStudentId,
            photoUrl: student.photoUrl,
            devices: perDevice,
          };
        });

        return {
          devices,
          data,
          total,
          page: Number(page),
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Fast lookup from Hikvision employeeNo/deviceStudentId -> DB student detail.
  fastify.get(
    "/schools/:schoolId/students/by-device-student-id/:deviceStudentId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, deviceStudentId } = request.params as {
          schoolId: string;
          deviceStudentId: string;
        };
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const trimmedId = String(deviceStudentId || "").trim();
        if (!trimmedId) {
          return reply.status(400).send({ error: "deviceStudentId is required" });
        }

        const student = await prisma.student.findFirst({
          where: {
            schoolId,
            deviceStudentId: trimmedId,
            isActive: true,
          },
          include: {
            class: { select: { id: true, name: true } },
          },
        });

        if (!student) {
          return reply.status(404).send({ error: "Student not found" });
        }

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        return student;
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

        const firstName = normalizeNamePart(body.firstName || "");
        const lastName = normalizeNamePart(body.lastName || "");
        const fatherName = normalizeNamePart(body.fatherName || "");
        const gender = normalizeGender(body.gender);
        const fullName =
          firstName || lastName
            ? buildFullName(lastName, firstName)
            : normalizeNamePart(body.name || "");

        if (!firstName || !lastName) {
          return reply
            .status(400)
            .send({ error: "Ism va familiya majburiy" });
        }
        if (!gender) {
          return reply.status(400).send({ error: "Jinsi noto'g'ri yoki bo'sh" });
        }

        const existing = await prisma.student.findFirst({
          where: buildDuplicateStudentWhere({
            schoolId,
            classId: body.classId,
            firstName,
            lastName,
            fullName,
          }),
          select: { id: true },
        });
        if (existing) {
          return reply
            .status(409)
            .send({ error: "Bu sinfda bunday o'quvchi mavjud" });
        }

        const student = await prisma.student.create({
          data: {
            ...body,
            schoolId,
            name: fullName,
            firstName,
            lastName,
            fatherName: fatherName || null,
            gender,
          },
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
          { header: "Last Name", key: "lastName", width: 18 },
          { header: "First Name", key: "firstName", width: 18 },
          { header: "Father Name", key: "fatherName", width: 18 },
          { header: "Gender", key: "gender", width: 12 },
          { header: "Device ID", key: "deviceStudentId", width: 15 },
          { header: "Class", key: "class", width: 15 },
          { header: "Parent Phone", key: "parentPhone", width: 20 },
        ];

        students.forEach((s) => {
          ws.addRow({
            lastName: s.lastName || "",
            firstName: s.firstName || "",
            fatherName: s.fatherName || "",
            gender: s.gender === "FEMALE" ? "Female" : "Male",
            deviceStudentId: s.deviceStudentId,
            class: s.class?.name || "",
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

        ws.columns = [
          { width: 16 },
          { width: 20 },
          { width: 24 },
          { width: 12 },
          { width: 18 },
          { width: 22 },
          { width: 20 },
          { width: 20 },
          { width: 16 },
          { width: 14 },
          { width: 12 },
          { width: 12 },
        ];

        for (let row = 10; row <= 500; row++) {
          ws.getCell(`D${row}`).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"Male,Female"'],
            showErrorMessage: true,
            errorStyle: "stop",
            errorTitle: "Invalid value",
            error: "Only Male or Female is allowed",
          };
          for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
            ws.getCell(`${col}${row}`).protection = { locked: false };
          }
        }

        await ws.protect("students-template-lock", {
          selectLockedCells: true,
          selectUnlockedCells: true,
          formatCells: false,
          formatColumns: false,
          formatRows: false,
          insertColumns: false,
          insertRows: false,
          insertHyperlinks: false,
          deleteColumns: false,
          deleteRows: false,
          sort: false,
          autoFilter: false,
          pivotTables: false,
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
              texts.includes("ism") ||
              (texts.includes("first name") && texts.includes("last name")) ||
              (texts.includes("ism") && texts.includes("familiya")))
          ) {
            headerRowNumber = r;
            break;
          }
          if (
            texts.includes("device id") &&
            (texts.includes("name") ||
              texts.includes("ism") ||
              (texts.includes("first name") && texts.includes("last name")) ||
              (texts.includes("ism") && texts.includes("familiya")))
          ) {
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
          headerMap.has("gender") &&
          headerMap.has("class") &&
          headerMap.has("father name") &&
          headerMap.has("parent phone");

        const isNewInternal =
          (headerMap.has("name") ||
            headerMap.has("ism") ||
            (headerMap.has("first name") && headerMap.has("last name")) ||
            (headerMap.has("ism") && headerMap.has("familiya"))) &&
          headerMap.has("person id") &&
          (headerMap.has("class") || headerMap.has("sinf")) &&
          (headerMap.has("gender") || headerMap.has("jinsi")) &&
          (headerMap.has("father name") ||
            headerMap.has("otasining ismi")) &&
          (headerMap.has("parent phone") || headerMap.has("ota-ona telefoni"));

        if (!isIvmsTemplate && !isLegacyInternal && !isNewInternal) {
          return reply.status(400).send({
            error: "Header mismatch. Please use the exported template.",
          });
        }

        const dataStartRow = headerRowNumber + 1;
        const colName =
          headerMap.get("person name") ?? headerMap.get("name") ?? headerMap.get("ism");
        const colFirstName =
          headerMap.get("first name") ?? headerMap.get("ism");
        const colLastName =
          headerMap.get("last name") ?? headerMap.get("familiya");
        const colPersonId =
          headerMap.get("person id") ?? headerMap.get("device id");
        const colClass =
          headerMap.get("organization") ??
          headerMap.get("class") ??
          headerMap.get("sinf");
        const colParentName =
          headerMap.get("father name") ??
          headerMap.get("otasining ismi");
        const colGender = headerMap.get("gender") ?? headerMap.get("jinsi");
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
        const seenNameKeys = new Set<string>();
        let importedCount = 0;
        let skippedCount = 0;
        const errors: Array<{ row: number; message: string }> = [];

        const lastRow = ws.actualRowCount || ws.rowCount;
        const rows: Array<{
          row: number;
          name: string;
          firstName: string;
          lastName: string;
          fatherName: string;
          gender: "MALE" | "FEMALE";
          deviceStudentId: string;
          className: string;
          parentPhone: string;
        }> = [];
        const missingClassNames = new Set<string>();

        for (let i = dataStartRow; i <= lastRow; i++) {
          const row = ws.getRow(i);
          const name = colName ? row.getCell(colName).text.trim() : "";
          const firstNameRaw = colFirstName
            ? row.getCell(colFirstName).text.trim()
            : "";
          const lastNameRaw = colLastName
            ? row.getCell(colLastName).text.trim()
            : "";
          const nameParts =
            firstNameRaw || lastNameRaw ? { firstName: firstNameRaw, lastName: lastNameRaw } : splitFullName(name);
          const firstName = normalizeNamePart(nameParts.firstName);
          const lastName = normalizeNamePart(nameParts.lastName);
          const deviceStudentId = colPersonId
            ? row.getCell(colPersonId).text.trim()
            : "";
          const className = colClass ? row.getCell(colClass).text.trim() : "";
          const fatherName = colParentName
            ? row.getCell(colParentName).text.trim()
            : "";
          const gender = normalizeGender(
            colGender ? row.getCell(colGender).text.trim() : "",
          );
          const parentPhone = colParentPhone
            ? row.getCell(colParentPhone).text.trim()
            : "";

          if ((!firstName || !lastName) || !deviceStudentId) {
            skippedCount++;
            errors.push({
              row: i,
              message: isIvmsTemplate
                ? "Person Name and Person ID are required"
                : "Ism, familiya va Person ID majburiy",
            });
            continue;
          }
          if (seenDeviceIds.has(deviceStudentId)) {
            skippedCount++;
            errors.push({ row: i, message: "Duplicate Device ID in file" });
            continue;
          }
          seenDeviceIds.add(deviceStudentId);

          const nameKey = `${className.toLowerCase()}|${lastName.toLowerCase()}|${firstName.toLowerCase()}`;
          if (seenNameKeys.has(nameKey)) {
            skippedCount++;
            errors.push({ row: i, message: "Duplicate name in class (file)" });
            continue;
          }
          seenNameKeys.add(nameKey);
          if (!gender) {
            skippedCount++;
            errors.push({
              row: i,
              message: "Gender noto'g'ri. Faqat Male/Female (yoki 1/2)",
            });
            continue;
          }

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
            name: buildFullName(lastName, firstName),
            firstName,
            lastName,
            fatherName,
            gender,
            deviceStudentId,
            className,
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

        const classIdsToCheck = Array.from(
          new Set(
            rows
              .map((r) => classMap.get(r.className.toLowerCase())?.id || null)
              .filter((id): id is string => Boolean(id)),
          ),
        );
        const existingStudents = classIdsToCheck.length
          ? await prisma.student.findMany({
              where: {
                schoolId,
                classId: { in: classIdsToCheck },
                isActive: true,
              },
              select: { classId: true, firstName: true, lastName: true },
            })
          : [];
        const existingKeys = new Set(
          existingStudents.map(
            (s) =>
              `${s.classId}|${s.lastName?.toLowerCase() || ""}|${s.firstName?.toLowerCase() || ""}`,
          ),
        );

        const ops = rows.flatMap((r) => {
          const classId = r.className
            ? classMap.get(r.className.toLowerCase())?.id || null
            : null;
          if (classId) {
            const key = `${classId}|${r.lastName.toLowerCase()}|${r.firstName.toLowerCase()}`;
            if (existingKeys.has(key)) {
              skippedCount++;
              errors.push({ row: r.row, message: "Bu sinfda bunday o'quvchi mavjud" });
              return [];
            }
          }
          return [prisma.student.upsert({
            where: {
              schoolId_deviceStudentId: {
                schoolId,
                deviceStudentId: r.deviceStudentId,
              },
            },
            update: {
              name: r.name,
              firstName: r.firstName,
              lastName: r.lastName,
              fatherName: r.fatherName || null,
              gender: r.gender,
              classId,
              parentPhone: r.parentPhone || null,
              isActive: true,
            },
            create: {
              name: r.name,
              firstName: r.firstName,
              lastName: r.lastName,
              fatherName: r.fatherName || null,
              gender: r.gender,
              deviceStudentId: r.deviceStudentId,
              classId,
              parentPhone: r.parentPhone || null,
              schoolId,
            },
          })];
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
        const firstName = normalizeNamePart(data.firstName || "");
        const lastName = normalizeNamePart(data.lastName || "");
        const fatherName = normalizeNamePart(data.fatherName || "");
        const gender = normalizeGender(data.gender);
        const fullName =
          firstName || lastName
            ? buildFullName(lastName, firstName)
            : normalizeNamePart(data.name || "");

        const sanitized = {
          name: fullName,
          firstName,
          lastName,
          fatherName: fatherName || null,
          classId: data.classId,
          deviceStudentId:
            typeof data.deviceStudentId === "string" &&
            data.deviceStudentId.trim() === ""
              ? null
              : data.deviceStudentId,
          parentPhone:
            typeof data.parentPhone === "string" && data.parentPhone.trim() === ""
              ? null
              : data.parentPhone,
          gender: gender || undefined,
        };

        if (!firstName || !lastName) {
          return reply.status(400).send({ error: "Ism va familiya majburiy" });
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

        const duplicate = await prisma.student.findFirst({
          where: buildDuplicateStudentWhere({
            schoolId: studentScope.schoolId,
            classId: sanitized.classId,
            firstName,
            lastName,
            fullName,
            excludeId: id,
          }),
          select: { id: true },
        });
        if (duplicate) {
          return reply
            .status(409)
            .send({ error: "Bu sinfda bunday o'quvchi mavjud" });
        }

        if (data.faceImageBase64) {
          const photoUrl = await saveStudentFaceImage({
            studentId: id,
            faceImageBase64: data.faceImageBase64,
          });
          if (photoUrl) {
            (sanitized as any).photoUrl = photoUrl;
          }
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
      let auditSchoolId: string | null = null;
      let auditRequestId: string | undefined;
      let auditClassId: string | null = null;
      let auditFirstName = "";
      let auditLastName = "";
      let auditTargetDeviceIds: string[] = [];
      let auditTargetAllActive = true;
      try {
        const { schoolId } = request.params as { schoolId: string };
        auditSchoolId = schoolId;
        const auth = await ensureProvisioningAuth(request, reply, schoolId);
        if (!auth) return;

        const body = request.body || {};
        const studentPayload = body.student || body;
        const faceImageBase64 = studentPayload?.faceImageBase64 || body?.faceImageBase64 || "";
        const studentId = body.studentId as string | undefined;
        const requestId = body.requestId ? String(body.requestId) : undefined;
        const targetDeviceIds = Array.isArray(body.targetDeviceIds)
          ? (body.targetDeviceIds as string[])
          : [];
        const targetAllActive = body.targetAllActive !== false;
        auditRequestId = requestId;
        auditTargetDeviceIds = targetDeviceIds;
        auditTargetAllActive = targetAllActive;
        fastify.log.info(
          {
            schoolId,
            requestId,
            studentId,
            hasImage: Boolean(body?.faceImageBase64 || body?.faceImage),
            classId: studentPayload?.classId || body?.classId,
            targetDeviceIdsCount: targetDeviceIds.length,
            targetAllActive,
          },
          "students.provision start",
        );

        const payloadFirstName = normalizeNamePart(studentPayload?.firstName || "");
        const payloadLastName = normalizeNamePart(studentPayload?.lastName || "");
        const payloadFatherName = normalizeNamePart(studentPayload?.fatherName || "");
        const payloadGender = normalizeGender(studentPayload?.gender);
        const payloadName = normalizeNamePart(studentPayload?.name || "");
        const nameParts =
          payloadFirstName || payloadLastName
            ? { firstName: payloadFirstName, lastName: payloadLastName }
            : splitFullName(payloadName);
        const firstName = normalizeNamePart(nameParts.firstName);
        const lastName = normalizeNamePart(nameParts.lastName);
        auditFirstName = firstName;
        auditLastName = lastName;
        const fullName = buildFullName(lastName, firstName);

        if (!firstName || !lastName) {
          await logProvisioningEvent({
            schoolId,
            level: "ERROR",
            stage: "PROVISIONING_START",
            status: "FAILED",
            message: "Ism va familiya majburiy",
            payload: {
              requestId,
              targetDeviceIds,
              targetAllActive,
              classId: studentPayload.classId || null,
            },
          });
          return reply.status(400).send({ error: "Ism va familiya majburiy" });
        }
        if (!payloadGender) {
          await logProvisioningEvent({
            schoolId,
            level: "ERROR",
            stage: "PROVISIONING_START",
            status: "FAILED",
            message: "Gender noto'g'ri yoki bo'sh",
            payload: {
              requestId,
              targetDeviceIds,
              targetAllActive,
              classId: studentPayload.classId || null,
            },
          });
          return reply.status(400).send({ error: "Gender noto'g'ri yoki bo'sh" });
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
          await logProvisioningEvent({
            schoolId,
            level: "ERROR",
            stage: "PROVISIONING_START",
            status: "FAILED",
            message: "deviceStudentId must be numeric",
            payload: {
              requestId,
              targetDeviceIds,
              targetAllActive,
              classId: studentPayload.classId || null,
            },
          });
          return reply
            .status(400)
            .send({ error: "deviceStudentId must be numeric" });
        }
        if (studentPayload.classId) {
          console.log('[Provision] Checking class:', {
            classId: studentPayload.classId,
            classIdType: typeof studentPayload.classId,
            schoolId,
            schoolIdType: typeof schoolId,
          });
          
          const classExists = await prisma.class.findFirst({
            where: { id: String(studentPayload.classId), schoolId },
          });
          
          console.log('[Provision] Class lookup result:', {
            found: !!classExists,
            classExists: classExists ? { id: classExists.id, name: classExists.name } : null,
          });
          
          if (!classExists) {
            console.error('[Provision] Class not found in DB!', {
              searchedFor: { classId: String(studentPayload.classId), schoolId },
            });
            await logProvisioningEvent({
              schoolId,
              level: "ERROR",
              stage: "PROVISIONING_START",
              status: "FAILED",
              message: "Class not found",
              payload: {
                requestId,
                targetDeviceIds,
                targetAllActive,
                classId: String(studentPayload.classId),
              },
            });
            return reply.status(400).send({ error: "Class not found" });
          }
          classId = String(studentPayload.classId);
          auditClassId = classId;
        }
        if (!classId) {
          await logProvisioningEvent({
            schoolId,
            level: "ERROR",
            stage: "PROVISIONING_START",
            status: "FAILED",
            message: "Sinf tanlanishi shart",
            payload: {
              requestId,
              targetDeviceIds,
              targetAllActive,
              classId: null,
            },
          });
          return reply.status(400).send({ error: "Sinf tanlanishi shart" });
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

          let studentRecord: Prisma.StudentGetPayload<Record<string, never>>;
          let deviceStudentId =
            providedDeviceStudentId !== "" ? providedDeviceStudentId : null;

          const existingByName = await tx.student.findFirst({
            where: buildDuplicateStudentWhere({
              schoolId,
              classId,
              firstName,
              lastName,
              fullName,
              excludeId: studentId,
            }),
            select: { id: true },
          });
          if (existingByName && existingByName.id !== studentId) {
            throw Object.assign(new Error("Duplicate student in class"), {
              statusCode: 409,
            });
          }

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

            const updateData: Prisma.StudentUncheckedUpdateInput = {
              name: fullName,
              classId,
              parentPhone: studentPayload.parentPhone || null,
              deviceStudentId,
              isActive: true,
              gender: payloadGender,
            };
            if (STUDENT_HAS_SPLIT_NAME_FIELDS) {
              updateData.firstName = firstName;
              updateData.lastName = lastName;
              updateData.fatherName = payloadFatherName || null;
            }

            studentRecord = await tx.student.update({
              where: { id: existingStudent.id },
              data: updateData,
            });
          } else {
            deviceStudentId =
              deviceStudentId || (await generateDeviceStudentId(tx, schoolId));

            const upsertUpdateData: Prisma.StudentUncheckedUpdateInput = {
              name: fullName,
              classId,
              parentPhone: studentPayload.parentPhone || null,
              isActive: true,
              gender: payloadGender,
            };
            const upsertCreateData: Prisma.StudentUncheckedCreateInput = {
              name: fullName,
              classId,
              parentPhone: studentPayload.parentPhone || null,
              deviceStudentId,
              schoolId,
              gender: payloadGender,
            };
            if (STUDENT_HAS_SPLIT_NAME_FIELDS) {
              upsertUpdateData.firstName = firstName;
              upsertUpdateData.lastName = lastName;
              upsertUpdateData.fatherName = payloadFatherName || null;
              upsertCreateData.firstName = firstName;
              upsertCreateData.lastName = lastName;
              upsertCreateData.fatherName = payloadFatherName || null;
            }

            studentRecord = await tx.student.upsert({
              where: {
                schoolId_deviceStudentId: { schoolId, deviceStudentId },
              },
              update: upsertUpdateData,
              create: upsertCreateData,
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

          if (faceImageBase64) {
            const photoUrl = await saveStudentFaceImage({
              studentId: studentRecord.id,
              faceImageBase64,
            });
            if (photoUrl) {
              studentRecord = await tx.student.update({
                where: { id: studentRecord.id },
                data: { photoUrl },
              });
            }
          }

          return {
            student: studentRecord,
            provisioning: updatedProvisioning,
            targetDevices,
          };
        });

        await logProvisioningEvent({
          schoolId,
          studentId: result.student.id,
          provisioningId: result.provisioning.id,
          level: result.provisioning.status === "FAILED" ? "ERROR" : "INFO",
          stage: "PROVISIONING_START",
          status: result.provisioning.status,
          message: result.provisioning.lastError || null,
          payload: {
            requestId,
            targetDeviceIds,
            targetAllActive,
            classId,
          },
        });

        fastify.log.info(
          {
            schoolId,
            studentId: result.student.id,
            provisioningId: result.provisioning.id,
            status: result.provisioning.status,
            targetDevices: result.targetDevices.length,
          },
          "students.provision success",
        );
        return {
          student: result.student,
          studentId: result.student.id,
          provisioningId: result.provisioning.id,
          deviceStudentId: result.student.deviceStudentId,
          provisioningStatus: result.provisioning.status,
          targetDevices: result.targetDevices,
        };
      } catch (err: any) {
        fastify.log.error(
          { err, schoolId: auditSchoolId, requestId: auditRequestId },
          "students.provision failed",
        );
        if (auditSchoolId) {
          await logProvisioningEvent({
            schoolId: auditSchoolId,
            level: "ERROR",
            stage: "PROVISIONING_START",
            status: "FAILED",
            message: err?.message || "Provisioning start failed",
            payload: {
              requestId: auditRequestId,
              classId: auditClassId,
              firstName: auditFirstName,
              lastName: auditLastName,
              targetDeviceIds: auditTargetDeviceIds,
              targetAllActive: auditTargetAllActive,
            },
          });
        }
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

      fastify.log.info(
        {
          provisioningId: id,
          status,
          deviceId: body.deviceId,
          deviceExternalId: body.deviceExternalId,
          deviceName: body.deviceName,
        },
        "provisioning.device-result received",
      );

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
        await logProvisioningEvent({
          schoolId: provisioning.schoolId,
          studentId: provisioning.studentId,
          provisioningId: id,
          level: "ERROR",
          stage: "DEVICE_RESULT",
          status: "FAILED",
          message: "deviceId or deviceExternalId is required",
          payload: {
            deviceName: body.deviceName,
            deviceType: body.deviceType,
            deviceLocation: body.deviceLocation,
          },
        });
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
          await logProvisioningEvent({
            schoolId: provisioning.schoolId,
            studentId: provisioning.studentId,
            provisioningId: id,
            level: "ERROR",
            stage: "DEVICE_RESULT",
            status: "FAILED",
            message: "Multiple devices with same name",
            payload: {
              deviceName: body.deviceName,
              deviceExternalId,
            },
          });
          return reply.status(400).send({ error: "Multiple devices with same name" });
        }
      }

      if (!device) {
        await logProvisioningEvent({
          schoolId: provisioning.schoolId,
          studentId: provisioning.studentId,
          provisioningId: id,
          level: "ERROR",
          stage: "DEVICE_RESULT",
          status: "FAILED",
          message: "Device not found",
          payload: {
            deviceId,
            deviceExternalId,
            deviceName: body.deviceName,
          },
        });
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

      await logProvisioningEvent({
        schoolId: provisioning.schoolId,
        studentId: provisioning.studentId,
        provisioningId: id,
        deviceId: device.id,
        level: status === "FAILED" ? "ERROR" : "INFO",
        stage: "DEVICE_RESULT",
        status,
        message: body.error || null,
        payload: {
          deviceExternalId,
          deviceName: body.deviceName,
          deviceType: body.deviceType,
          deviceLocation: body.deviceLocation,
          employeeNoOnDevice: body.employeeNoOnDevice,
        },
      });

      return {
        ok: true,
        provisioningStatus: result.provisioning.status,
        deviceStatus: result.link.status,
      };
    } catch (err) {
      fastify.log.error({ err }, "provisioning.device-result failed");
      return sendHttpError(reply, err);
    }
  });

  // Provisioning logs (archive)
  fastify.get(
    "/schools/:schoolId/provisioning-logs",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params as { schoolId: string };
        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const query = request.query || {};
        const page = Math.max(1, Number(query.page) || 1);
        const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
        const skip = (page - 1) * limit;

        const where: Prisma.ProvisioningLogWhereInput = { schoolId };

        if (query.level) {
          const level = String(query.level).toUpperCase();
          if (["INFO", "WARN", "ERROR"].includes(level)) {
            where.level = level as any;
          }
        }
        if (query.stage) {
          where.stage = {
            contains: String(query.stage),
            mode: "insensitive",
          };
        }
        if (query.status) {
          where.status = {
            contains: String(query.status),
            mode: "insensitive",
          };
        }
        if (query.provisioningId) {
          where.provisioningId = String(query.provisioningId);
        }
        if (query.studentId) {
          where.studentId = String(query.studentId);
        }
        if (query.deviceId) {
          where.deviceId = String(query.deviceId);
        }

        const from = query.from ? new Date(String(query.from)) : null;
        const to = query.to ? new Date(String(query.to)) : null;
        if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
          return reply.status(400).send({ error: "Invalid from/to date" });
        }
        if (from || to) {
          where.createdAt = {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          };
        }

        if (query.q) {
          const q = String(query.q).trim();
          if (q) {
            where.OR = [
              { message: { contains: q, mode: "insensitive" } },
              { stage: { contains: q, mode: "insensitive" } },
              { status: { contains: q, mode: "insensitive" } },
              { provisioningId: { contains: q, mode: "insensitive" } },
              { studentId: { contains: q, mode: "insensitive" } },
              { deviceId: { contains: q, mode: "insensitive" } },
              { student: { is: { name: { contains: q, mode: "insensitive" } } } },
              { device: { is: { name: { contains: q, mode: "insensitive" } } } },
            ];
          }
        }

        const [data, total] = await prisma.$transaction([
          prisma.provisioningLog.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  firstName: true,
                  lastName: true,
                  deviceStudentId: true,
                },
              },
              device: {
                select: {
                  id: true,
                  name: true,
                  deviceId: true,
                  location: true,
                },
              },
            },
          }),
          prisma.provisioningLog.count({ where }),
        ]);

        return {
          data,
          total,
          page,
          limit,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/device-import/preview",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params as { schoolId: string };
        const user = request.user;
        const body = request.body || {};

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const rawRows = Array.isArray(body.rows) ? body.rows : [];
        if (rawRows.length === 0) {
          return reply.status(400).send({ error: "rows is required" });
        }

        const rows: Array<{
          employeeNo: string;
          firstName: string;
          lastName: string;
          classId: string;
        }> = rawRows.map((item: any) => ({
          employeeNo: String(item?.employeeNo || "").trim(),
          firstName: normalizeNamePart(item?.firstName || ""),
          lastName: normalizeNamePart(item?.lastName || ""),
          classId: String(item?.classId || "").trim(),
        }));

        const classIds: string[] = Array.from(
          new Set(rows.map((r) => r.classId).filter((v): v is string => Boolean(v))),
        );
        const employeeNos: string[] = Array.from(
          new Set(rows.map((r) => r.employeeNo).filter((v): v is string => Boolean(v))),
        );

        const [classes, existing] = await Promise.all([
          classIds.length === 0
            ? []
            : prisma.class.findMany({
                where: { schoolId, id: { in: classIds } },
                select: { id: true },
              }),
          employeeNos.length === 0
            ? []
            : prisma.student.findMany({
                where: { schoolId, deviceStudentId: { in: employeeNos } },
                select: { id: true, deviceStudentId: true },
              }),
        ]);

        const classSet = new Set(classes.map((c) => c.id));
        const existingMap = new Map(
          existing.map((s) => [String(s.deviceStudentId || ""), s.id]),
        );
        const dupCounter = new Map<string, number>();
        rows.forEach((r) =>
          dupCounter.set(r.employeeNo, (dupCounter.get(r.employeeNo) || 0) + 1),
        );

        let createCount = 0;
        let updateCount = 0;
        let invalidCount = 0;
        let duplicateCount = 0;
        let classErrorCount = 0;

        const previewRows = rows.map((row: {
          employeeNo: string;
          firstName: string;
          lastName: string;
          classId: string;
        }) => {
          const reasons: string[] = [];
          if (!row.employeeNo || !row.firstName || !row.lastName || !row.classId) {
            reasons.push("Majburiy maydonlar to'liq emas");
          }
          if ((dupCounter.get(row.employeeNo) || 0) > 1) {
            reasons.push("Duplicate employeeNo");
            duplicateCount += 1;
          }
          if (row.classId && !classSet.has(row.classId)) {
            reasons.push("Class topilmadi");
            classErrorCount += 1;
          }

          const existingStudentId = existingMap.get(row.employeeNo) || null;
          const action =
            reasons.length > 0
              ? "INVALID"
              : existingStudentId
              ? "UPDATE"
              : "CREATE";

          if (action === "CREATE") createCount += 1;
          if (action === "UPDATE") updateCount += 1;
          if (action === "INVALID") invalidCount += 1;

          return {
            ...row,
            action,
            reasons,
            existingStudentId,
          };
        });

        return {
          total: rows.length,
          createCount,
          updateCount,
          skipCount: invalidCount,
          invalidCount,
          duplicateCount,
          classErrorCount,
          rows: previewRows,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/device-import/commit",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const startedAtMs = Date.now();
      let jobId: string | null = null;
      let lockEmployeeNos: string[] = [];
      let retryMode = false;
      try {
        const { schoolId } = request.params as { schoolId: string };
        const user = request.user;
        const body = request.body || {};

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const idempotencyKey = String(body.idempotencyKey || "").trim();
        if (idempotencyKey) {
          const cached = getIdempotentResult(schoolId, idempotencyKey);
          if (cached) {
            return { ...cached, idempotent: true };
          }
        }

        const rawRows = Array.isArray(body.rows) ? body.rows : [];
        if (rawRows.length === 0) {
          return reply.status(400).send({ error: "rows is required" });
        }

        const rows: Array<{
          employeeNo: string;
          firstName: string;
          lastName: string;
          fatherName: string;
          classId: string;
          parentPhone: string;
          gender: "MALE" | "FEMALE";
        }> = rawRows.map((item: any) => ({
          employeeNo: String(item?.employeeNo || "").trim(),
          firstName: normalizeNamePart(item?.firstName || ""),
          lastName: normalizeNamePart(item?.lastName || ""),
          fatherName: normalizeNamePart(item?.fatherName || ""),
          classId: String(item?.classId || "").trim(),
          parentPhone: String(item?.parentPhone || "").trim(),
          gender: normalizeGender(item?.gender || "MALE") || "MALE",
        }));

        const classIds: string[] = Array.from(
          new Set(rows.map((r) => r.classId).filter((v): v is string => Boolean(v))),
        );
        const employeeNos: string[] = Array.from(
          new Set(rows.map((r) => r.employeeNo).filter((v): v is string => Boolean(v))),
        );
        lockEmployeeNos = employeeNos;
        retryMode = Boolean(body?.retryMode);

        const lock = acquireImportLocks(schoolId, employeeNos);
        if (!lock.ok) {
          return reply
            .status(409)
            .send({ error: "Import lock conflict", conflicts: lock.conflicts });
        }

        const [classes, existing] = await Promise.all([
          classIds.length === 0
            ? []
            : prisma.class.findMany({
                where: { schoolId, id: { in: classIds } },
                select: { id: true },
              }),
          employeeNos.length === 0
            ? []
            : prisma.student.findMany({
                where: { schoolId, deviceStudentId: { in: employeeNos } },
                select: {
                  id: true,
                  deviceStudentId: true,
                  firstName: true,
                  lastName: true,
                  classId: true,
                },
              }),
        ]);

        const classSet = new Set(classes.map((c) => c.id));
        const existingMap = new Map(
          existing.map((s) => [String(s.deviceStudentId || ""), s]),
        );
        const dupCounter = new Map<string, number>();
        rows.forEach((r) =>
          dupCounter.set(r.employeeNo, (dupCounter.get(r.employeeNo) || 0) + 1),
        );

        const invalidRows = rows.filter((row: {
          employeeNo: string;
          firstName: string;
          lastName: string;
          classId: string;
        }) => {
          if (!row.employeeNo || !row.firstName || !row.lastName || !row.classId) {
            return true;
          }
          if ((dupCounter.get(row.employeeNo) || 0) > 1) return true;
          if (!classSet.has(row.classId)) return true;
          return false;
        });

        if (invalidRows.length > 0) {
          return reply.status(400).send({
            error: "Validation failed",
            invalidCount: invalidRows.length,
          });
        }

        const created: Array<{ id: string; deviceStudentId: string | null }> = [];
        const updated: Array<{ id: string; deviceStudentId: string | null }> = [];
        const beforeAfter: Array<{
          employeeNo: string;
          before: any;
          after: any;
        }> = [];

        const localJobId = crypto.randomUUID();
        jobId = localJobId;
        createImportJob({
          id: localJobId,
          schoolId,
          totalRows: rows.length,
        });
        updateImportJob(localJobId, { status: "PROCESSING" as any });

        const students = await prisma.$transaction(async (tx) => {
          const out: Array<{
            id: string;
            deviceStudentId: string | null;
            firstName: string;
            lastName: string;
          }> = [];
          for (const row of rows) {
            const existingStudent = existingMap.get(row.employeeNo);
            const fullName = buildFullName(row.lastName, row.firstName);
            const result = await tx.student.upsert({
              where: {
                schoolId_deviceStudentId: {
                  schoolId,
                  deviceStudentId: row.employeeNo,
                },
              },
              update: {
                name: fullName,
                firstName: row.firstName,
                lastName: row.lastName,
                fatherName: row.fatherName || null,
                classId: row.classId,
                parentPhone: row.parentPhone || null,
                gender: row.gender,
                isActive: true,
              },
              create: {
                schoolId,
                deviceStudentId: row.employeeNo,
                name: fullName,
                firstName: row.firstName,
                lastName: row.lastName,
                fatherName: row.fatherName || null,
                classId: row.classId,
                parentPhone: row.parentPhone || null,
                gender: row.gender,
              },
            });

            beforeAfter.push({
              employeeNo: row.employeeNo,
              before: existingStudent
                ? {
                    id: existingStudent.id,
                    firstName: existingStudent.firstName,
                    lastName: existingStudent.lastName,
                    classId: existingStudent.classId,
                  }
                : null,
              after: {
                id: result.id,
                firstName: result.firstName,
                lastName: result.lastName,
                classId: result.classId,
              },
            });

            if (existingStudent) {
              updated.push({
                id: result.id,
                deviceStudentId: result.deviceStudentId,
              });
            } else {
              created.push({
                id: result.id,
                deviceStudentId: result.deviceStudentId,
              });
            }
            out.push({
              id: result.id,
              deviceStudentId: result.deviceStudentId,
              firstName: result.firstName,
              lastName: result.lastName,
            });
          }
          return out;
        });

        const durationMs = Date.now() - startedAtMs;
        updateImportJob(localJobId, {
          status: "SUCCESS" as any,
          processed: rows.length,
          success: rows.length,
          failed: 0,
          synced: 0,
          finishedAt: new Date(),
        });
        recordImportMetrics({
          schoolId,
          success: rows.length,
          failed: 0,
          synced: 0,
          latencyMs: durationMs,
          isRetry: retryMode,
        });

        const resultPayload = {
          ok: true,
          idempotent: false,
          jobId: localJobId,
          createdCount: created.length,
          updatedCount: updated.length,
          created,
          updated,
          students,
        };

        await logProvisioningEvent({
          schoolId,
          level: "INFO",
          stage: "DEVICE_IMPORT_COMMIT",
          status: "SUCCESS",
          message: `Import commit done (${rows.length} rows)`,
          payload: {
            actorId: user?.sub || null,
            actorRole: user?.role || null,
            sourceDeviceId: body?.sourceDeviceId || null,
            syncMode: body?.syncMode || "none",
            targetDeviceIds: Array.isArray(body?.targetDeviceIds)
              ? body.targetDeviceIds
              : [],
            jobId: localJobId,
            createdCount: created.length,
            updatedCount: updated.length,
            beforeAfter: beforeAfter.slice(0, 200),
          },
        });

        if (idempotencyKey) {
          setIdempotentResult(schoolId, idempotencyKey, resultPayload);
        }

        return resultPayload;
      } catch (err: any) {
        if (jobId) {
          updateImportJob(jobId, {
            status: "FAILED" as any,
            lastError: err?.message || "Import failed",
            finishedAt: new Date(),
          });
        }
        recordImportMetrics({
          schoolId: (request.params as any)?.schoolId || "",
          success: 0,
          failed: 1,
          synced: 0,
          latencyMs: Date.now() - startedAtMs,
          isRetry: retryMode,
        });
        return sendHttpError(reply, err);
      } finally {
        if ((request.params as any)?.schoolId && lockEmployeeNos.length > 0) {
          releaseImportLocks((request.params as any).schoolId, lockEmployeeNos);
        }
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/import-jobs/:jobId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, jobId } = request.params as {
          schoolId: string;
          jobId: string;
        };
        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const job = getImportJob(jobId);
        if (!job || job.schoolId !== schoolId) {
          return reply.status(404).send({ error: "Import job not found" });
        }
        return job;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/import-jobs/:jobId/retry",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, jobId } = request.params as {
          schoolId: string;
          jobId: string;
        };
        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const job = getImportJob(jobId);
        if (!job || job.schoolId !== schoolId) {
          return reply.status(404).send({ error: "Import job not found" });
        }
        const updated = incrementImportJobRetry(jobId);
        return { ok: true, job: updated };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/import-metrics",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params as { schoolId: string };
        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);
        return getImportMetrics(schoolId);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Device user import audit (UI import wizard telemetry)
  fastify.post(
    "/schools/:schoolId/import-audit",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params as { schoolId: string };
        const user = request.user;
        const body = request.body || {};

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const stage = String(body.stage || "DEVICE_IMPORT").trim().slice(0, 80);
        const status = String(body.status || "INFO").trim().slice(0, 40);
        const message =
          typeof body.message === "string" ? body.message.slice(0, 1000) : null;
        const payload =
          body.payload && typeof body.payload === "object"
            ? {
                ...(body.payload as Record<string, unknown>),
                actorId: user?.sub || null,
                actorRole: user?.role || null,
              }
            : {
                actorId: user?.sub || null,
                actorRole: user?.role || null,
              };

        const log = await prisma.provisioningLog.create({
          data: {
            schoolId,
            level: "INFO",
            stage,
            status,
            message,
            payload: payload || undefined,
          },
        });

        return { ok: true, id: log.id, createdAt: log.createdAt };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get("/provisioning/:id/logs", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
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

      const logs = await prisma.provisioningLog.findMany({
        where: { provisioningId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return logs;
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

      await logProvisioningEvent({
        schoolId: provisioning.schoolId,
        studentId: provisioning.studentId,
        provisioningId: id,
        level: "INFO",
        stage: "RETRY",
        status: "PROCESSING",
        message: result.updated === 0 ? "No devices to retry" : null,
        payload: {
          targetDeviceIds: result.targetDeviceIds,
        },
      });

      return { ok: true, ...result };
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });

}

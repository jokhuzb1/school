import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { requireRoles, requireSchoolScope } from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import { addDaysUtc, getDateOnlyInZone } from "../../../utils/date";
import { WEBHOOK_ENFORCE_SECRET, WEBHOOK_SECRET_HEADER } from "../../../config";
import {
  calculateAttendancePercent,
  getActiveClassIds,
  getNowMinutesInZone,
  getStartedClassIds,
} from "../../../utils/attendanceStatus";
import { logAudit } from "../../../utils/audit";
import {
  ClassCountRow,
  computeNoScanSplit,
  getStatusCountsByRange,
} from "../../attendance";
import { recordDeviceOperation } from "../../devices/services/device-ops-metrics";

function sanitizeSchool<T extends { webhookSecretIn?: string; webhookSecretOut?: string }>(
  school: T,
) {
  const { webhookSecretIn, webhookSecretOut, ...rest } = school as any;
  return rest as Omit<T, "webhookSecretIn" | "webhookSecretOut">;
}

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const user = request.user;
      if (user.role !== "SUPER_ADMIN")
        return reply.status(403).send({ error: "forbidden" });
      const { scope } = request.query as { scope?: "started" | "active" };
      const attendanceScope = scope === "active" ? "active" : "started";
      const schools = await prisma.school.findMany({
        include: {
          _count: { select: { students: true, classes: true, devices: true } },
        },
      });

      const now = new Date();
      const schoolsWithStats = await Promise.all(
        schools.map(async (school) => {
          const tz = school.timezone || "Asia/Tashkent";
          const today = getDateOnlyInZone(now, tz);
          const tomorrow = addDaysUtc(today, 1);

          const nowMinutes = getNowMinutesInZone(now, tz);

          const classes = await prisma.class.findMany({
            where: { schoolId: school.id },
            select: { id: true, startTime: true, endTime: true },
          });
          const activeClassIds = getActiveClassIds({
            classes,
            nowMinutes,
            absenceCutoffMinutes: school.absenceCutoffMinutes,
          });
          const startedClassIds = getStartedClassIds({
            classes,
            nowMinutes,
          });
          const effectiveClassIds =
            attendanceScope === "active" ? activeClassIds : startedClassIds;
          const effectiveClassIdsWithFallback =
            attendanceScope === "started" && effectiveClassIds.length === 0
              ? classes.map((cls) => cls.id)
              : effectiveClassIds;

          if (effectiveClassIdsWithFallback.length === 0) {
            return {
              ...school,
              todayStats: {
                present: 0,
                late: 0,
                absent: 0,
                excused: 0,
                pendingEarly: 0,
                pendingLate: 0,
                attendancePercent: 0,
              },
            };
          }

          const [statusResult, classStudentCounts] = await Promise.all([
            getStatusCountsByRange({
              schoolId: school.id,
              dateRange: { startDate: today, endDate: today },
              classIds: effectiveClassIdsWithFallback,
            }),
            prisma.student.groupBy({
              by: ["classId"],
              where: {
                schoolId: school.id,
                isActive: true,
                classId: { in: effectiveClassIdsWithFallback },
              },
              _count: true,
            }),
          ]);

          const classesForSplit: Array<{ id: string; startTime: string | null }> =
            classes
              .filter((cls) => effectiveClassIdsWithFallback.includes(cls.id))
              .map((cls) => ({ id: cls.id, startTime: cls.startTime || null }));

          const { noScanSplit, totalActiveStudents } = await computeNoScanSplit({
            schoolId: school.id,
            dateStart: today,
            dateEnd: tomorrow,
            classIds: effectiveClassIdsWithFallback,
            classes: classesForSplit,
            classStudentCounts: classStudentCounts as ClassCountRow[],
            absenceCutoffMinutes: school.absenceCutoffMinutes,
            nowMinutes,
          });

          const { present, late, absent, excused } = statusResult.counts;
          const attendancePercent = calculateAttendancePercent(
            present,
            late,
            totalActiveStudents,
          );

          return {
            ...school,
            todayStats: {
              present,
              late,
              absent: absent + noScanSplit.absent,
              excused,
              pendingEarly: noScanSplit.pendingEarly,
              pendingLate: noScanSplit.pendingLate,
              attendancePercent,
            },
          };
        }),
      );

      return schoolsWithStats;
    },
  );

  // Yangi maktab qo'shish - admin bilan birga
  fastify.post(
    "/",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const user = request.user;
      if (user.role !== "SUPER_ADMIN")
        return reply.status(403).send({ error: "forbidden" });
      
            const {
              name,
              address,
              phone,
              email,
              lateThresholdMinutes,
              absenceCutoffMinutes,
              // Admin ma'lumotlari
              adminName,
              adminEmail,
              adminPassword,
            } = request.body as any;
      
            // Email validatsiya
            if (adminEmail) {
              const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
              if (!emailRegex.test(adminEmail)) {
                return reply.status(400).send({ error: "Noto'g'ri email formati" });
              }
      
              // Email mavjudligini tekshirish
              const existingUser = await prisma.user.findUnique({
                where: { email: adminEmail },
              });
              if (existingUser) {
                return reply.status(400).send({ error: "Bu email allaqachon ro'yxatdan o'tgan" });
              }
            }
      
            // Parol validatsiya
            if (adminPassword && adminPassword.length < 6) {
              return reply.status(400).send({ error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" });
            }
      
            try {
              // Transaction bilan maktab va admin yaratish
              const result = await prisma.$transaction(async (tx) => {
                // Maktab yaratish
                          const school = await tx.school.create({
                            data: {
                              name,
                              address,
                              phone,
                              email,
                              lateThresholdMinutes: lateThresholdMinutes || 15,
                              absenceCutoffMinutes: absenceCutoffMinutes || 180,
                              webhookSecretIn: uuidv4(),
                              webhookSecretOut: uuidv4(),
                            },
                          });          // Admin yaratish (agar ma'lumotlar berilgan bo'lsa)
          let admin = null;
          if (adminName && adminEmail && adminPassword) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            admin = await tx.user.create({
              data: {
                name: adminName,
                email: adminEmail,
                password: hashedPassword,
                role: "SCHOOL_ADMIN",
                schoolId: school.id,
              },
            });
          }

          return { school, admin };
        });

        return {
          ...result.school,
          admin: result.admin ? {
            id: result.admin.id,
            name: result.admin.name,
            email: result.admin.email,
          } : null,
        };
      } catch (err: any) {
        console.error("School creation error:", err);
        if (err.code === "P2002") {
          return reply.status(400).send({ error: "Bu email allaqachon mavjud" });
        }
        return reply.status(500).send({ error: "Maktab yaratishda xatolik" });
      }
    },
  );

  fastify.get(
    "/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER', 'GUARD']);
        requireSchoolScope(user, id);

        const school = await prisma.school.findUnique({ where: { id } });
        if (!school) return reply.status(404).send({ error: "not found" });
        return sanitizeSchool(school);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, id);

        const {
          name,
          address,
          phone,
          email,
          lateThresholdMinutes,
          absenceCutoffMinutes,
          timezone,
        } = request.body;
        const existingSchool = await prisma.school.findUnique({ where: { id } });
        if (!existingSchool) {
          return reply.status(404).send({ error: "not found" });
        }
        const school = await prisma.school.update({
          where: { id },
          data: {
            name,
            address,
            phone,
            email,
            lateThresholdMinutes,
            absenceCutoffMinutes,
            timezone,
          },
        });
        logAudit(fastify, {
          action: "school.settings.update",
          level: "info",
          message: "Maktab sozlamalari o'zgartirildi",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId: school.id,
          extra: {
            oldLateThreshold: existingSchool.lateThresholdMinutes,
            newLateThreshold: lateThresholdMinutes,
            oldAbsenceCutoff: existingSchool.absenceCutoffMinutes,
            newAbsenceCutoff: absenceCutoffMinutes,
            oldTimezone: existingSchool.timezone,
            newTimezone: timezone,
          },
        });
        return school;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/:id/webhook-info",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, id);

        const school = await prisma.school.findUnique({ where: { id } });
        if (!school) return reply.status(404).send({ error: "Not found" });

        const inPath = `/webhook/${school.id}/in`;
        const outPath = `/webhook/${school.id}/out`;
        return {
          enforceSecret: WEBHOOK_ENFORCE_SECRET,
          secretHeaderName: WEBHOOK_SECRET_HEADER,

          // Base endpoints (recommended to keep secrets out of URLs when possible)
          inUrl: inPath,
          outUrl: outPath,

          // Hikvision/Device-friendly URLs (most devices can only set a URL, not custom headers)
          inUrlWithSecret: `${inPath}?secret=${school.webhookSecretIn}`,
          outUrlWithSecret: `${outPath}?secret=${school.webhookSecretOut}`,

          // For integrations that can send headers (server-to-server, custom clients, etc.)
          inSecret: school.webhookSecretIn,
          outSecret: school.webhookSecretOut,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/:id/webhook/rotate",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const startedAt = Date.now();
      try {
        const { id } = request.params;
        const { direction } = request.body as { direction?: "in" | "out" };
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, id);

        if (!direction || !["in", "out"].includes(direction)) {
          return reply.status(400).send({ error: "direction must be in|out" });
        }

        const data =
          direction === "in"
            ? { webhookSecretIn: uuidv4() }
            : { webhookSecretOut: uuidv4() };

        const school = await prisma.school.update({
          where: { id },
          data,
        });

        logAudit(fastify, {
          action: "school.webhook.rotate",
          level: "warn",
          message: `Webhook secret rotated (${direction})`,
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId: id,
          extra: { direction },
        });

        const inPath = `/webhook/${school.id}/in`;
        const outPath = `/webhook/${school.id}/out`;
        const response = {
          ok: true,
          info: {
            enforceSecret: WEBHOOK_ENFORCE_SECRET,
            secretHeaderName: WEBHOOK_SECRET_HEADER,
            inUrl: inPath,
            outUrl: outPath,
            inUrlWithSecret: `${inPath}?secret=${school.webhookSecretIn}`,
            outUrlWithSecret: `${outPath}?secret=${school.webhookSecretOut}`,
            inSecret: school.webhookSecretIn,
            outSecret: school.webhookSecretOut,
          },
        };
        recordDeviceOperation("webhook.rotate", true, Date.now() - startedAt);
        return response;
      } catch (err) {
        recordDeviceOperation("webhook.rotate", false, Date.now() - startedAt);
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/:id/webhook/test",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const startedAt = Date.now();
      try {
        const { id } = request.params;
        const { direction } = request.body as { direction?: "in" | "out" };
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, id);

        if (!direction || !["in", "out"].includes(direction)) {
          return reply.status(400).send({ error: "direction must be in|out" });
        }

        const school = await prisma.school.findUnique({ where: { id } });
        if (!school) return reply.status(404).send({ error: "Not found" });

        const path =
          direction === "in"
            ? `/webhook/${school.id}/in?secret=${school.webhookSecretIn}`
            : `/webhook/${school.id}/out?secret=${school.webhookSecretOut}`;

        logAudit(fastify, {
          action: "school.webhook.test",
          level: "info",
          message: `Webhook test requested (${direction})`,
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId: id,
          extra: { direction },
        });

        const response = {
          ok: true,
          direction,
          method: "POST",
          path,
          testedAt: new Date().toISOString(),
        };
        recordDeviceOperation("webhook.test", true, Date.now() - startedAt);
        return response;
      } catch (err) {
        recordDeviceOperation("webhook.test", false, Date.now() - startedAt);
        return sendHttpError(reply, err);
      }
    },
  );
}

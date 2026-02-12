import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsProvisioningLogsPreviewRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, requireRoles, requireSchoolScope, sendHttpError, normalizeNamePart } = deps;

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

        const where: any = { schoolId };

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
        if (query.eventType) {
          where.eventType = {
            contains: String(query.eventType),
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
        if (query.actorId) {
          where.actorId = String(query.actorId);
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
              { eventType: { contains: q, mode: "insensitive" } },
              { status: { contains: q, mode: "insensitive" } },
              { provisioningId: { contains: q, mode: "insensitive" } },
              { studentId: { contains: q, mode: "insensitive" } },
              { deviceId: { contains: q, mode: "insensitive" } },
              { actorId: { contains: q, mode: "insensitive" } },
              { actorName: { contains: q, mode: "insensitive" } },
              { student: { is: { name: { contains: q, mode: "insensitive" } } } },
              { device: { is: { name: { contains: q, mode: "insensitive" } } } },
            ];
          }
        }

        const [data, total] = await studentsRepo.$transaction([
          studentsRepo.provisioningLog.findMany({
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
          studentsRepo.provisioningLog.count({ where }),
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
            : studentsRepo.class.findMany({
                where: { schoolId, id: { in: classIds } },
                select: { id: true },
              }),
          employeeNos.length === 0
            ? []
            : studentsRepo.student.findMany({
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
}


import { FastifyInstance } from "fastify";
import { DashboardHttpDeps } from "./dashboard.routes.deps";

export function registerDashboardEventsRoutes(
  fastify: FastifyInstance,
  deps: DashboardHttpDeps,
) {
  const { attendanceRepo,
    addDaysUtc,
    dateKeyToUtcDate,
    getDateOnlyInZone,
    getTeacherAllowedClassIds,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
  } = deps;

  fastify.get(
    "/schools/:schoolId/events",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { limit = 10 } = request.query;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const school = await attendanceRepo.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";
        const today = getDateOnlyInZone(new Date(), tz);
        const tomorrow = addDaysUtc(today, 1);

        const allowedClassIds =
          user.role === "TEACHER"
            ? await getTeacherAllowedClassIds(user.sub)
            : [];

        const eventWhere: any = { schoolId };
        eventWhere.timestamp = { gte: today, lt: tomorrow };
        if (user.role === "TEACHER") {
          eventWhere.student = {
            classId: {
              in: allowedClassIds.length ? allowedClassIds : ["__none__"],
            },
          };
        }

        const events = await attendanceRepo.attendanceEvent.findMany({
          where: eventWhere,
          take: Number(limit),
          orderBy: { timestamp: "desc" },
          include: {
            student: {
              include: {
                class: true,
              },
            },
            device: true,
          },
        });

        return events;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/events/history",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { startDate, endDate, limit = 200, classId } = request.query as {
          startDate: string;
          endDate: string;
          limit?: number;
          classId?: string;
        };
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        if (!startDate || !endDate) {
          return reply.status(400).send({ error: "startDate and endDate required" });
        }

        const school = await attendanceRepo.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";

        const start = dateKeyToUtcDate(startDate);
        const end = addDaysUtc(dateKeyToUtcDate(endDate), 1);

        const allowedClassIds =
          user.role === "TEACHER"
            ? await getTeacherAllowedClassIds(user.sub)
            : [];

        const eventWhere: any = {
          schoolId,
          timestamp: { gte: start, lt: end },
        };

        if (classId) {
          if (user.role === "TEACHER" && !allowedClassIds.includes(classId)) {
            return reply.status(403).send({ error: "forbidden" });
          }
          eventWhere.student = { classId };
        } else if (user.role === "TEACHER") {
          eventWhere.student = {
            classId: {
              in: allowedClassIds.length ? allowedClassIds : ["__none__"],
            },
          };
        }

        const events = await attendanceRepo.attendanceEvent.findMany({
          where: eventWhere,
          take: Math.min(Number(limit) || 200, 500),
          orderBy: { timestamp: "desc" },
          include: {
            student: { include: { class: true } },
            device: true,
          },
        });

        return {
          timezone: tz,
          startDate,
          endDate,
          data: events,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


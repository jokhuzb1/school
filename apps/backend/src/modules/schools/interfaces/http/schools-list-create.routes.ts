import { FastifyInstance } from "fastify";
import { SchoolsHttpDeps } from "./schools.routes.deps";
import { createSchoolsService } from "../../application/schools.service";
import { createSchoolsPrismaRepository } from "../../infrastructure/schools.prisma-repository";

export function registerSchoolListAndCreateRoutes(
  fastify: FastifyInstance,
  deps: SchoolsHttpDeps,
) {
  const {
    prisma,
    uuidv4,
    bcrypt,
    requireRoles,
    requireSchoolScope,
    addDaysUtc,
    getDateOnlyInZone,
    calculateAttendancePercent,
    getActiveClassIds,
    getNowMinutesInZone,
    getStartedClassIds,
    computeNoScanSplit,
    getStatusCountsByRange,
  } = deps;
  const service = createSchoolsService(createSchoolsPrismaRepository(prisma));

  fastify.get(
    "/",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const user = request.user;
      if (user.role !== "SUPER_ADMIN")
        return reply.status(403).send({ error: "forbidden" });
      const { scope } = request.query as { scope?: "started" | "active" };
      return service.listSchoolsWithTodayStats({
        scope,
        addDaysUtc,
        getDateOnlyInZone,
        getNowMinutesInZone,
        getActiveClassIds,
        getStartedClassIds,
        getStatusCountsByRange,
        computeNoScanSplit: computeNoScanSplit as any,
        calculateAttendancePercent,
      });
    },
  );

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
        adminName,
        adminEmail,
        adminPassword,
      } = request.body as any;

      try {
        const created = await service.createSchool({
          name,
          address,
          phone,
          email,
          lateThresholdMinutes,
          absenceCutoffMinutes,
          adminName,
          adminEmail,
          adminPassword,
          uuidv4,
          hashPassword: bcrypt.hash.bind(bcrypt),
        });
        if ("statusCode" in created) {
          return reply
            .status((created as any).statusCode)
            .send({ error: (created as any).error });
        }

        return created;
      } catch (err: any) {
        console.error("School creation error:", err);
        if (err.code === "P2002") {
          return reply.status(400).send({ error: "Bu email allaqachon mavjud" });
        }
        return reply.status(500).send({ error: "Maktab yaratishda xatolik" });
      }
    },
  );
}

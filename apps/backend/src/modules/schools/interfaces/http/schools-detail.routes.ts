import { FastifyInstance } from "fastify";
import { createSchoolsService } from "../../application/schools.service";
import { createSchoolsPrismaRepository } from "../../infrastructure/schools.prisma-repository";
import { SchoolsHttpDeps } from "./schools.routes.deps";

export function registerSchoolDetailRoutes(
  fastify: FastifyInstance,
  deps: SchoolsHttpDeps,
) {
  const {
    prisma,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    buildUserContext,
    logAudit,
    sanitizeSchool,
  } = deps;
  const service = createSchoolsService(createSchoolsPrismaRepository(prisma));

  fastify.get(
    "/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, id);

        const school = await service.getSchoolById(id);
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

        requireRoles(user, ["SCHOOL_ADMIN"]);
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
        const existingSchool = await service.getSchoolById(id);
        if (!existingSchool) {
          return reply.status(404).send({ error: "not found" });
        }
        const school = await service.updateSchoolById(id, {
          name,
          address,
          phone,
          email,
          lateThresholdMinutes,
          absenceCutoffMinutes,
          timezone,
        });
        logAudit(fastify, {
          action: "school.settings.update",
          eventType: "SCHOOL_SETTINGS_UPDATE",
          level: "info",
          status: "SUCCESS",
          message: "Maktab sozlamalari o'zgartirildi",
          schoolId: school.id,
          ...buildUserContext(request),
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
}

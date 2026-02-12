import { FastifyInstance } from "fastify";
import { createSchoolsService } from "../../application/schools.service";
import { createSchoolsPrismaRepository } from "../../infrastructure/schools.prisma-repository";
import { SchoolsHttpDeps } from "./schools.routes.deps";

export function registerSchoolWebhookRoutes(
  fastify: FastifyInstance,
  deps: SchoolsHttpDeps,
) {
  const {
    prisma,
    uuidv4,
    WEBHOOK_ENFORCE_SECRET,
    WEBHOOK_SECRET_HEADER,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    buildUserContext,
    logAudit,
    recordDeviceOperation,
  } = deps;
  const service = createSchoolsService(createSchoolsPrismaRepository(prisma));

  fastify.get(
    "/:id/webhook-info",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, id);

        const school = await service.getSchoolById(id);
        if (!school) return reply.status(404).send({ error: "Not found" });

        const inPath = `/webhook/${school.id}/in`;
        const outPath = `/webhook/${school.id}/out`;
        return {
          enforceSecret: WEBHOOK_ENFORCE_SECRET,
          secretHeaderName: WEBHOOK_SECRET_HEADER,
          inUrl: inPath,
          outUrl: outPath,
          inUrlWithSecret: `${inPath}?secret=${school.webhookSecretIn}`,
          outUrlWithSecret: `${outPath}?secret=${school.webhookSecretOut}`,
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

        const school = await service.updateSchoolById(id, data);

        logAudit(fastify, {
          action: "school.webhook.rotate",
          eventType: "SCHOOL_WEBHOOK_ROTATE",
          level: "warn",
          status: "SUCCESS",
          message: `Webhook secret rotated (${direction})`,
          schoolId: id,
          ...buildUserContext(request),
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

        const school = await service.getSchoolById(id);
        if (!school) return reply.status(404).send({ error: "Not found" });

        const path =
          direction === "in"
            ? `/webhook/${school.id}/in?secret=${school.webhookSecretIn}`
            : `/webhook/${school.id}/out?secret=${school.webhookSecretOut}`;

        logAudit(fastify, {
          action: "school.webhook.test",
          eventType: "SCHOOL_WEBHOOK_TEST",
          level: "info",
          status: "SUCCESS",
          message: `Webhook test requested (${direction})`,
          schoolId: id,
          ...buildUserContext(request),
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

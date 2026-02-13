import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsImportJobsRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, requireRoles, requireSchoolScope, sendHttpError,
    getImportJob, getImportMetrics, incrementImportJobRetry
  } = deps;

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
                actorName: user?.name || null,
                actorIp: request.ip || null,
                userAgent: request.headers?.["user-agent"] || null,
              }
            : {
                actorId: user?.sub || null,
                actorRole: user?.role || null,
                actorName: user?.name || null,
                actorIp: request.ip || null,
                userAgent: request.headers?.["user-agent"] || null,
              };

        const log = await studentsRepo.provisioningLog.create({
          data: {
            schoolId,
            level: "INFO",
            eventType: stage,
            stage,
            status,
            message,
            actorId: user?.sub || null,
            actorRole: user?.role || null,
            actorName: user?.name || null,
            actorIp: request.ip || null,
            userAgent: request.headers?.["user-agent"] || null,
            source: "FRONTEND_UI",
            payload: payload || undefined,
          },
        });

        return { ok: true, id: log.id, createdAt: log.createdAt };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

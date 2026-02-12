import { FastifyInstance } from "fastify";
import {
  createSchoolClass,
  deleteClassById,
  findClassById,
  listSchoolClassesWithAttendance,
  updateClassById,
} from "../../application/classes.service";
import { createClassesPrismaRepository } from "../../infrastructure/classes.prisma-repository";
import { createClassesHttpDeps } from "./classes.routes.deps";

export default async function (fastify: FastifyInstance) {
  const {
    prisma,
    addDaysUtc,
    dateKeyToUtcDate,
    getDateKeyInZone,
    requireClassSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    buildUserContext,
    logAudit,
  } = createClassesHttpDeps();
  const repository = createClassesPrismaRepository(prisma);

  fastify.get(
    "/schools/:schoolId/classes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        return listSchoolClassesWithAttendance({
          repository,
          addDaysUtc,
          dateKeyToUtcDate,
          getDateKeyInZone,
          schoolId,
          user,
        });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/classes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { name, gradeLevel, startTime, endTime } = request.body;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const cls = await createSchoolClass(repository, {
          name,
          gradeLevel,
          schoolId,
          startTime,
          endTime,
        });
        logAudit(fastify, {
          action: "class.create",
          eventType: "CLASS_CREATE",
          level: "info",
          status: "SUCCESS",
          message: "Class created",
          schoolId,
          ...buildUserContext(request),
          extra: {
            classId: cls.id,
            name: cls.name,
            gradeLevel: cls.gradeLevel,
            startTime: cls.startTime,
            endTime: cls.endTime,
          },
        });
        return cls;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/classes/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const data = request.body;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        await requireClassSchoolScope(user, id);

        const existing = await findClassById(repository, id);
        if (!existing) {
          return reply.status(404).send({ error: "not found" });
        }

        const cls = await updateClassById(repository, id, data);
        logAudit(fastify, {
          action: "class.update",
          eventType: "CLASS_UPDATE",
          level: "info",
          status: "SUCCESS",
          message: "Class updated",
          schoolId: existing.schoolId,
          ...buildUserContext(request),
          extra: {
            classId: id,
            oldStartTime: existing.startTime,
            newStartTime: cls.startTime,
            oldEndTime: existing.endTime,
            newEndTime: cls.endTime,
          },
        });
        return cls;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/classes/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        await requireClassSchoolScope(user, id);

        const existing = await findClassById(repository, id);
        await deleteClassById(repository, id);
        if (existing) {
          logAudit(fastify, {
            action: "class.delete",
            eventType: "CLASS_DELETE",
            level: "warn",
            status: "SUCCESS",
            message: "Class deleted",
            schoolId: existing.schoolId,
            ...buildUserContext(request),
            extra: {
              classId: existing.id,
              name: existing.name,
              gradeLevel: existing.gradeLevel,
            },
          });
        }
        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

import { FastifyInstance } from "fastify";
import { createHolidaysHttpDeps } from "./holidays.routes.deps";
import { createHolidaysService } from "../../application/holidays.service";
import { createHolidaysPrismaRepository } from "../../infrastructure/holidays.prisma-repository";

export default async function (fastify: FastifyInstance) {
  const {
    prisma,
    requireRoles,
    requireSchoolScope,
    requireHolidaySchoolScope,
    sendHttpError,
  } = createHolidaysHttpDeps();
  const service = createHolidaysService(createHolidaysPrismaRepository(prisma));

  fastify.get(
    '/schools/:schoolId/holidays',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, schoolId);

        return service.listHolidays(schoolId);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    '/schools/:schoolId/holidays',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { date, name } = request.body;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, schoolId);

        return service.createHoliday({
          schoolId,
          date: new Date(date),
          name,
        });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    '/holidays/:id',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        await requireHolidaySchoolScope(user, id);

        await service.removeHoliday(id);
        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


import { FastifyInstance } from 'fastify';
import prisma from "../../../prisma";
import {
  requireRoles,
  requireSchoolScope,
  requireHolidaySchoolScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/schools/:schoolId/holidays',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, schoolId);

        return prisma.holiday.findMany({ where: { schoolId } });
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

        return prisma.holiday.create({ data: { schoolId, date: new Date(date), name } });
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

        await prisma.holiday.delete({ where: { id } });
        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


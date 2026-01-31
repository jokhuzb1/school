import { FastifyInstance } from 'fastify';
import prisma from "../../../prisma";
import {
  requireRoles,
  requireSchoolScope,
  requireDeviceSchoolScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/schools/:schoolId/devices',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN', 'GUARD']);
        requireSchoolScope(user, schoolId);

        return prisma.device.findMany({ where: { schoolId } });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    '/schools/:schoolId/devices',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { name, deviceId, type, location } = request.body;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, schoolId);

        const device = await prisma.device.create({ data: { name, deviceId, type, location, schoolId } });
        return device;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    '/devices/:id',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const data = request.body;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        await requireDeviceSchoolScope(user, id);

        return prisma.device.update({ where: { id }, data });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    '/devices/:id',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        await requireDeviceSchoolScope(user, id);

        return prisma.device.delete({ where: { id } });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


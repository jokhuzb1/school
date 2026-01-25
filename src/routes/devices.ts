import { FastifyInstance } from 'fastify';
import prisma from '../prisma';

export default async function (fastify: FastifyInstance) {
  fastify.get('/schools/:schoolId/devices', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { schoolId } = request.params;
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) return reply.status(403).send({ error: 'forbidden' });
    return prisma.device.findMany({ where: { schoolId } });
  });

  fastify.post('/schools/:schoolId/devices', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { schoolId } = request.params;
    const { name, deviceId, type, location } = request.body;
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) return reply.status(403).send({ error: 'forbidden' });
    const device = await prisma.device.create({ data: { name, deviceId, type, location, schoolId } });
    return device;
  });

  fastify.put('/devices/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const { id } = request.params;
    const data = request.body;
    return prisma.device.update({ where: { id }, data });
  });

  fastify.delete('/devices/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const { id } = request.params;
    return prisma.device.delete({ where: { id } });
  });
}

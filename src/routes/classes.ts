import { FastifyInstance } from 'fastify';
import prisma from '../prisma';

export default async function (fastify: FastifyInstance) {
  fastify.get('/schools/:schoolId/classes', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { schoolId } = request.params;
    // check permission: if not SUPER_ADMIN and not matching user's school -> forbidden
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) return reply.status(403).send({ error: 'forbidden' });
    return prisma.class.findMany({ where: { schoolId } });
  });

  fastify.post('/schools/:schoolId/classes', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { schoolId } = request.params;
    const { name, gradeLevel, startTime, endTime } = request.body;
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) return reply.status(403).send({ error: 'forbidden' });
    const cls = await prisma.class.create({ data: { name, gradeLevel, schoolId, startTime, endTime } });
    return cls;
  });

  fastify.put('/classes/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { id } = request.params;
    const data = request.body;
    const cls = await prisma.class.update({ where: { id }, data });
    return cls;
  });

  fastify.delete('/classes/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { id } = request.params;
    await prisma.class.delete({ where: { id } });
    return { ok: true };
  });
}

import { FastifyInstance } from 'fastify';
import prisma from '../prisma';

export default async function (fastify: FastifyInstance) {
  fastify.get('/schools/:schoolId/holidays', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const { schoolId } = request.params;
    return prisma.holiday.findMany({ where: { schoolId } });
  });

  fastify.post('/schools/:schoolId/holidays', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const { schoolId } = request.params;
    const { date, name } = request.body;
    return prisma.holiday.create({ data: { schoolId, date: new Date(date), name } });
  });

  fastify.delete('/holidays/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const { id } = request.params;
    await prisma.holiday.delete({ where: { id } });
    return { ok: true };
  });
}

import { FastifyInstance } from 'fastify';
import prisma from '../prisma';
import { v4 as uuidv4 } from 'uuid';

export default async function (fastify: FastifyInstance) {
  fastify.get('/', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN') return reply.status(403).send({ error: 'forbidden' });
    return prisma.school.findMany();
  });

  fastify.post('/', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN') return reply.status(403).send({ error: 'forbidden' });
    const { name, address, phone, email } = request.body;
    const school = await prisma.school.create({
      data: {
        name,
        address,
        phone,
        email
      }
    });
    return school;
  });

  fastify.get('/:id/webhook-info', async (request: any, reply) => {
    const { id } = request.params;
    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) return reply.status(404).send({ error: 'Not found' });
    const base = `${request.protocol}://${request.hostname}`;
    return {
      in: `${base}/webhook/${school.id}/in?secret=${school.webhookSecretIn}`,
      out: `${base}/webhook/${school.id}/out?secret=${school.webhookSecretOut}`
    };
  });
}

import { FastifyInstance } from 'fastify';
import prisma from '../prisma';
import bcrypt from 'bcryptjs';

export default async function (fastify: FastifyInstance) {
  fastify.post('/login', async (request: any, reply) => {
    const { email, password } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.status(401).send({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return reply.status(401).send({ error: 'Invalid credentials' });

    // Include user data in response for frontend context
    const token = fastify.jwt.sign({ sub: user.id, role: user.role, schoolId: user.schoolId });
    return { token, user };
  });

  fastify.get('/me', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const userId = (request.user as any).sub;
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { school: true } });
    return user;
  });

  fastify.post('/refresh', async (request: any) => {
    // simplistic refresh: verify and reissue
    try {
      await request.jwtVerify();
      const userId = request.user.sub;
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (!u) return { error: 'User not found' };
      const token = fastify.jwt.sign({ sub: u.id, role: u.role, schoolId: u.schoolId });
      return { token };
    } catch (err) {
      return { error: 'Invalid token' };
    }
  });
}

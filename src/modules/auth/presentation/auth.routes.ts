import { FastifyInstance } from 'fastify';
import prisma from "../../../prisma";
import bcrypt from 'bcryptjs';
import { IS_PROD, SSE_TOKEN_TTL_SECONDS } from "../../../config";

export default async function (fastify: FastifyInstance) {
  fastify.post('/login', async (request: any, reply) => {
    const { email, password } = request.body;
    fastify.log.info(
      {
        email,
        ip: request.ip,
        origin: request.headers?.origin,
        userAgent: request.headers?.['user-agent'],
      },
      'auth.login attempt'
    );
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      fastify.log.warn({ email }, 'auth.login user not found');
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      fastify.log.warn({ email, userId: user.id }, 'auth.login invalid password');
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ sub: user.id, role: user.role, schoolId: user.schoolId });
    fastify.log.info({ email, userId: user.id }, 'auth.login success');
    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    return { token, user: safeUser };
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

  // Short-lived token for SSE usage (prod-friendly)
  fastify.get('/sse-token', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const user = request.user as any;
    const expiresIn = IS_PROD ? SSE_TOKEN_TTL_SECONDS : 3600;
    const token = fastify.jwt.sign(
      { sub: user.sub, role: user.role, schoolId: user.schoolId, sse: true },
      { expiresIn }
    );
    return { token, expiresIn };
  });
}

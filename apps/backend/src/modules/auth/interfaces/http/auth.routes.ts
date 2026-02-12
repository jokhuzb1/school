import { FastifyInstance } from "fastify";
import { createAuthHttpDeps } from "./auth.routes.deps";
import {
  authenticateCredentials,
  getProfileUser,
  getRefreshUser,
} from "../../application/auth.service";
import { createAuthPrismaRepository } from "../../infrastructure/auth.prisma-repository";

export default async function (fastify: FastifyInstance) {
  const { prisma, bcrypt, IS_PROD, SSE_TOKEN_TTL_SECONDS, logAudit } =
    createAuthHttpDeps();
  const repository = createAuthPrismaRepository(prisma);

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
    const authResult = await authenticateCredentials({
      repository,
      email,
      password,
      comparePassword: bcrypt.compare.bind(bcrypt),
    });
    if (authResult.status === "USER_NOT_FOUND") {
      fastify.log.warn({ email }, 'auth.login user not found');
      logAudit(fastify, {
        action: "auth.login",
        eventType: "AUTH_LOGIN_FAILED",
        level: "warn",
        status: "FAILED",
        message: "Login failed: user not found",
        actorIp: request.ip,
        userAgent: request.headers?.["user-agent"],
        source: "BACKEND_API",
        extra: { email },
      });
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const user = authResult.user!;
    if (authResult.status === "INVALID_PASSWORD") {
      fastify.log.warn({ email, userId: user.id }, 'auth.login invalid password');
      logAudit(fastify, {
        action: "auth.login",
        eventType: "AUTH_LOGIN_FAILED",
        level: "warn",
        status: "FAILED",
        message: "Login failed: invalid password",
        userId: user.id,
        userRole: user.role,
        actorName: user.name,
        actorIp: request.ip,
        userAgent: request.headers?.["user-agent"],
        schoolId: user.schoolId || undefined,
        source: "BACKEND_API",
        extra: { email },
      });
      return reply.status(401).send({ error: 'Invalid credentials' });
    }

    const token = fastify.jwt.sign({ sub: user.id, role: user.role, schoolId: user.schoolId });
    fastify.log.info({ email, userId: user.id }, 'auth.login success');
    logAudit(fastify, {
      action: "auth.login",
      eventType: "AUTH_LOGIN_SUCCESS",
      level: "info",
      status: "SUCCESS",
      message: "Login success",
      userId: user.id,
      userRole: user.role,
      actorName: user.name,
      actorIp: request.ip,
      userAgent: request.headers?.["user-agent"],
      requestId: request.id,
      schoolId: user.schoolId || undefined,
      source: "BACKEND_API",
      extra: { email },
    });
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
    const user = await getProfileUser(repository, userId);
    return user;
  });

  fastify.post('/refresh', async (request: any) => {
    // simplistic refresh: verify and reissue
    try {
      await request.jwtVerify();
      const userId = request.user.sub;
      const u = await getRefreshUser(repository, userId);
      if (!u) {
        logAudit(fastify, {
          action: "auth.refresh",
          eventType: "AUTH_REFRESH_FAILED",
          level: "warn",
          status: "FAILED",
          message: "Token refresh failed: user not found",
          actorIp: request.ip,
          userAgent: request.headers?.["user-agent"],
          source: "BACKEND_API",
        });
        return { error: 'User not found' };
      }
      const token = fastify.jwt.sign({ sub: u.id, role: u.role, schoolId: u.schoolId });
      logAudit(fastify, {
        action: "auth.refresh",
        eventType: "AUTH_REFRESH_SUCCESS",
        level: "info",
        status: "SUCCESS",
        message: "Token refreshed",
        userId: u.id,
        userRole: u.role,
        actorName: u.name,
        actorIp: request.ip,
        userAgent: request.headers?.["user-agent"],
        schoolId: u.schoolId || undefined,
        source: "BACKEND_API",
      });
      return { token };
    } catch (err) {
      logAudit(fastify, {
        action: "auth.refresh",
        eventType: "AUTH_REFRESH_FAILED",
        level: "warn",
        status: "FAILED",
        message: "Token refresh failed: invalid token",
        actorIp: request.ip,
        userAgent: request.headers?.["user-agent"],
        source: "BACKEND_API",
      });
      return { error: 'Invalid token' };
    }
  });

  fastify.post('/logout', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const user = request.user as any;
    logAudit(fastify, {
      action: "auth.logout",
      eventType: "AUTH_LOGOUT",
      level: "info",
      status: "SUCCESS",
      message: "Logout",
      userId: user?.sub,
      userRole: user?.role,
      actorName: user?.name,
      actorIp: request.ip,
      userAgent: request.headers?.["user-agent"],
      schoolId: user?.schoolId || undefined,
      requestId: request.id,
      source: "BACKEND_API",
    });
    return { ok: true };
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

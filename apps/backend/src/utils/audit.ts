import { FastifyInstance, FastifyRequest } from "fastify";
import prisma from "../prisma";

type AuditLevel = "info" | "warn" | "error";

interface AuditDetail {
  action: string;
  message?: string;
  level?: AuditLevel;
  status?: string;
  eventType?: string;
  actorName?: string;
  actorIp?: string;
  userAgent?: string;
  source?: string;
  userId?: string;
  userRole?: string;
  requestId?: string;
  schoolId?: string;
  studentId?: string;
  extra?: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "webhooksecretin",
  "webhooksecretout",
  "secret",
  "faceimage",
  "faceurl",
]);

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => sanitize(item));
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = sanitize(nested);
  }
  return out;
}

export function logAudit(fastify: FastifyInstance, detail: AuditDetail) {
  const safeExtra = (sanitize(detail.extra || {}) || {}) as Record<string, unknown>;
  const payload = {
    audit: true,
    action: detail.action,
    message: detail.message || detail.action,
    userId: detail.userId,
    actorName: detail.actorName,
    actorIp: detail.actorIp,
    userAgent: detail.userAgent,
    userRole: detail.userRole,
    requestId: detail.requestId,
    schoolId: detail.schoolId,
    studentId: detail.studentId,
    status: detail.status || "SUCCESS",
    eventType: detail.eventType || detail.action,
    source: detail.source || "BACKEND_API",
    extra: safeExtra,
  };

  const logFn = detail.level === "warn"
    ? fastify.log.warn
    : detail.level === "error"
      ? fastify.log.error
      : fastify.log.info;

  logFn.call(fastify.log, payload, detail.message || detail.action);

  if (!detail.schoolId) return;

  prisma.provisioningLog.create({
    data: {
      schoolId: detail.schoolId,
      studentId: detail.studentId || null,
      level: detail.level === "error" ? "ERROR" : detail.level === "warn" ? "WARN" : "INFO",
      stage: detail.action.slice(0, 80),
      status: (detail.status || "SUCCESS").slice(0, 40),
      message: (detail.message || detail.action).slice(0, 1000),
      payload: {
        requestId: detail.requestId || null,
        source: detail.source || "BACKEND_API",
        ...safeExtra,
      },
      eventType: (detail.eventType || detail.action).slice(0, 80),
      actorId: detail.userId || null,
      actorRole: detail.userRole || null,
      actorName: detail.actorName || null,
      actorIp: detail.actorIp || null,
      userAgent: detail.userAgent || null,
      source: (detail.source || "BACKEND_API").slice(0, 32),
    },
  }).catch((err) => {
    fastify.log.error({ err, action: detail.action, schoolId: detail.schoolId }, "audit.persist failed");
  });
}

export function buildUserContext(request?: FastifyRequest) {
  const user: any = (request as any)?.user;
  return {
    userId: user?.sub,
    userRole: user?.role,
    actorName: user?.name || null,
    actorIp: (request as any)?.ip || null,
    userAgent: (request as any)?.headers?.["user-agent"] || null,
    requestId: request?.id,
    source: "BACKEND_API",
  };
}

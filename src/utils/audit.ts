import { FastifyInstance, FastifyRequest } from "fastify";

type AuditLevel = "info" | "warn" | "error";

interface AuditDetail {
  action: string;
  message?: string;
  level?: AuditLevel;
  userId?: string;
  userRole?: string;
  requestId?: string;
  schoolId?: string;
  studentId?: string;
  extra?: Record<string, unknown>;
}

export function logAudit(fastify: FastifyInstance, detail: AuditDetail) {
  const payload = {
    audit: true,
    action: detail.action,
    message: detail.message || detail.action,
    userId: detail.userId,
    userRole: detail.userRole,
    requestId: detail.requestId,
    schoolId: detail.schoolId,
    studentId: detail.studentId,
    extra: detail.extra || {},
  };

  const logFn = detail.level === "warn"
    ? fastify.log.warn
    : detail.level === "error"
      ? fastify.log.error
      : fastify.log.info;

  logFn.call(fastify.log, payload, detail.message || detail.action);
}

export function buildUserContext(request?: FastifyRequest) {
  const user: any = (request as any)?.user;
  return {
    userId: user?.sub,
    userRole: user?.role,
    requestId: request?.id,
  };
}
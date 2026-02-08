import { FastifyInstance } from 'fastify';
import prisma from "../../../prisma";
import {
  requireRoles,
  requireSchoolScope,
  requireDeviceSchoolScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import { logAudit } from "../../../utils/audit";
import {
  getDeviceOperationMetrics,
  recordDeviceOperation,
} from "../services/device-ops-metrics";

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
      const startedAt = Date.now();
      try {
        const { schoolId } = request.params;
        const { name, deviceId, type, location } = request.body;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, schoolId);

        const normalizedDeviceId = String(deviceId || "").trim();
        if (!normalizedDeviceId) {
          throw Object.assign(new Error("deviceId is required"), {
            statusCode: 400,
          });
        }

        const existingByDeviceId = await prisma.device.findUnique({
          where: { deviceId: normalizedDeviceId },
          select: { id: true, schoolId: true },
        });
        if (existingByDeviceId) {
          throw Object.assign(new Error('deviceId already exists'), {
            statusCode: 409,
          });
        }

        const device = await prisma.device.create({
          data: { name, deviceId: normalizedDeviceId, type, location, schoolId },
        });
        logAudit(fastify, {
          action: "device.create",
          level: "info",
          message: "Device created",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId,
          extra: { deviceId: normalizedDeviceId, name },
        });
        recordDeviceOperation("device.create", true, Date.now() - startedAt);
        return device;
      } catch (err) {
        recordDeviceOperation("device.create", false, Date.now() - startedAt);
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    '/devices/:id',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const startedAt = Date.now();
      try {
        const { id } = request.params;
        const data = request.body;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        await requireDeviceSchoolScope(user, id);

        const nextDeviceId = data?.deviceId
          ? String(data.deviceId).trim()
          : null;
        if (nextDeviceId) {
          const existing = await prisma.device.findUnique({
            where: { deviceId: nextDeviceId },
            select: { id: true },
          });
          if (existing && existing.id !== id) {
            throw Object.assign(new Error('deviceId already exists'), {
              statusCode: 409,
            });
          }
        }

        const updated = await prisma.device.update({
          where: { id },
          data: nextDeviceId ? { ...data, deviceId: nextDeviceId } : data,
        });
        logAudit(fastify, {
          action: "device.update",
          level: "info",
          message: "Device updated",
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId: updated.schoolId,
          extra: { deviceId: updated.deviceId, id: updated.id },
        });
        recordDeviceOperation("device.update", true, Date.now() - startedAt);
        return updated;
      } catch (err) {
        recordDeviceOperation("device.update", false, Date.now() - startedAt);
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    '/devices/:id',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const startedAt = Date.now();
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        await requireDeviceSchoolScope(user, id);

        const deleted = await prisma.$transaction(async (tx) => {
          // Clear references before delete (FK RESTRICT)
          await tx.attendanceEvent.updateMany({
            where: { deviceId: id },
            data: { deviceId: null },
          });
          await tx.provisioningLog.updateMany({
            where: { deviceId: id },
            data: { deviceId: null },
          });
          await tx.studentDeviceLink.deleteMany({
            where: { deviceId: id },
          });

          return tx.device.delete({ where: { id } });
        });
        recordDeviceOperation("device.delete", true, Date.now() - startedAt);
        return deleted;
      } catch (err) {
        recordDeviceOperation("device.delete", false, Date.now() - startedAt);
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    '/ops/device-metrics',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const user = request.user;
        requireRoles(user, ['SUPER_ADMIN', 'SCHOOL_ADMIN']);
        return getDeviceOperationMetrics();
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    '/devices/:id/webhook-health',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN', 'GUARD']);
        await requireDeviceSchoolScope(user, id);

        const device = await prisma.device.findUnique({
          where: { id },
          select: { id: true, schoolId: true, lastSeenAt: true },
        });
        if (!device) return reply.status(404).send({ error: 'not found' });

        const lastEvent = await prisma.attendanceEvent.findFirst({
          where: { deviceId: id },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        });

        return {
          ok: true,
          deviceId: id,
          lastWebhookEventAt: lastEvent?.timestamp || null,
          lastSeenAt: device.lastSeenAt || null,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


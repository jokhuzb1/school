import { FastifyInstance } from "fastify";
import { createDevicesService } from "../../application/devices.service";
import { createDevicesPrismaRepository } from "../../infrastructure/devices.prisma-repository";
import { createDevicesHttpDeps } from "./devices.routes.deps";

export default async function (fastify: FastifyInstance) {
  const {
    prisma,
    requireRoles,
    requireSchoolScope,
    requireDeviceSchoolScope,
    sendHttpError,
    buildUserContext,
    logAudit,
    getDeviceOperationMetrics,
    recordDeviceOperation,
  } = createDevicesHttpDeps();
  const service = createDevicesService(createDevicesPrismaRepository(prisma));

  fastify.get(
    '/schools/:schoolId/devices',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER', 'GUARD']);
        requireSchoolScope(user, schoolId);

        return service.listBySchoolId(schoolId);
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

        const device = await service.create({
          name,
          deviceId,
          type,
          location,
          schoolId,
        });
        logAudit(fastify, {
          action: "device.create",
          eventType: "DEVICE_CREATE",
          level: "info",
          status: "SUCCESS",
          message: "Device created",
          schoolId,
          ...buildUserContext(request),
          extra: { deviceId: device.deviceId, name },
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

        const updated = await service.update(id, data);
        logAudit(fastify, {
          action: "device.update",
          eventType: "DEVICE_UPDATE",
          level: "info",
          status: "SUCCESS",
          message: "Device updated",
          schoolId: updated.schoolId,
          ...buildUserContext(request),
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

        const deleted = await service.remove(id);
        logAudit(fastify, {
          action: "device.delete",
          eventType: "DEVICE_DELETE",
          level: "warn",
          status: "SUCCESS",
          message: "Device deleted",
          schoolId: deleted.schoolId,
          ...buildUserContext(request),
          extra: { deviceId: deleted.deviceId, id: deleted.id, name: deleted.name },
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

        const health = await service.getWebhookHealth(id);
        if (!health) return reply.status(404).send({ error: 'not found' });
        return health;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


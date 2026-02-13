import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsProvisioningFinalizeRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, sendHttpError, logProvisioningEvent, ensureProvisioningAuth } = deps;

  fastify.get("/provisioning/:id/logs", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const provisioning = await studentsRepo.studentProvisioning.findUnique({
        where: { id },
      });
      if (!provisioning) {
        return reply.status(404).send({ error: "Provisioning not found" });
      }

      const auth = await ensureProvisioningAuth(
        request,
        reply,
        provisioning.schoolId,
        provisioning.studentId,
      );
      if (!auth) return;

      const logs = await studentsRepo.provisioningLog.findMany({
        where: { provisioningId: id },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return logs;
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });

  // Retry provisioning (reset failed links to pending)
  fastify.post("/provisioning/:id/retry", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body || {};

      const provisioning = await studentsRepo.studentProvisioning.findUnique({
        where: { id },
      });
      if (!provisioning) {
        return reply.status(404).send({ error: "Provisioning not found" });
      }

      const auth = await ensureProvisioningAuth(
        request,
        reply,
        provisioning.schoolId,
        provisioning.studentId,
      );
      if (!auth) return;

      const deviceIds = Array.isArray(body.deviceIds)
        ? (body.deviceIds as string[])
        : [];
      const deviceExternalIds = Array.isArray(body.deviceExternalIds)
        ? (body.deviceExternalIds as string[])
        : [];

      const now = new Date();
      const result = await studentsRepo.$transaction(async (tx) => {
        let targetDeviceIds: string[] = [];
        if (deviceIds.length > 0) {
          targetDeviceIds = deviceIds;
        } else if (deviceExternalIds.length > 0) {
          const devices = await tx.device.findMany({
            where: {
              schoolId: provisioning.schoolId,
              deviceId: { in: deviceExternalIds },
            },
            select: { id: true },
          });
          targetDeviceIds = devices.map((d) => d.id);
        } else {
          const links = await tx.studentDeviceLink.findMany({
            where: { provisioningId: id, status: "FAILED" },
            select: { deviceId: true },
          });
          targetDeviceIds = links.map((l) => l.deviceId);
        }

        if (targetDeviceIds.length === 0) {
          return { updated: 0, targetDeviceIds: [] as string[] };
        }

        const updated = await tx.studentDeviceLink.updateMany({
          where: {
            provisioningId: id,
            deviceId: { in: targetDeviceIds },
          },
          data: {
            status: "PENDING",
            lastError: null,
            lastAttemptAt: now,
          },
        });

        await tx.studentProvisioning.update({
          where: { id },
          data: { status: "PROCESSING", lastError: null },
        });

        await tx.student.update({
          where: { id: provisioning.studentId },
          data: {
            deviceSyncStatus: "PROCESSING",
            deviceSyncUpdatedAt: now,
          },
        });

        return { updated: updated.count, targetDeviceIds };
      });

      await logProvisioningEvent({
        schoolId: provisioning.schoolId,
        studentId: provisioning.studentId,
        provisioningId: id,
        level: "INFO",
        stage: "RETRY",
        status: "PROCESSING",
        message: result.updated === 0 ? "No devices to retry" : null,
        payload: {
          targetDeviceIds: result.targetDeviceIds,
        },
      });

      return { ok: true, ...result };
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });

  // Force finalize provisioning as FAILED after rollback (all-or-nothing consistency).
  fastify.post("/provisioning/:id/finalize-failure", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body || {};

      const provisioning = await studentsRepo.studentProvisioning.findUnique({
        where: { id },
      });
      if (!provisioning) {
        return reply.status(404).send({ error: "Provisioning not found" });
      }

      const auth = await ensureProvisioningAuth(
        request,
        reply,
        provisioning.schoolId,
        provisioning.studentId,
      );
      if (!auth) return;

      const reasonRaw = String(body.reason || "").trim();
      const reason = reasonRaw || "Forced rollback finalize";
      const now = new Date();

      const result = await studentsRepo.$transaction(async (tx) => {
        const forcedLinks = await tx.studentDeviceLink.updateMany({
          where: {
            provisioningId: id,
            status: { not: "FAILED" },
          },
          data: {
            status: "FAILED",
            lastError: reason,
            lastAttemptAt: now,
          },
        });

        await tx.studentProvisioning.update({
          where: { id },
          data: {
            status: "FAILED",
            lastError: reason,
          },
        });

        await tx.student.update({
          where: { id: provisioning.studentId },
          data: {
            deviceSyncStatus: "FAILED",
            deviceSyncUpdatedAt: now,
          },
        });

        return { forcedLinks: forcedLinks.count };
      });

      await logProvisioningEvent({
        schoolId: provisioning.schoolId,
        studentId: provisioning.studentId,
        provisioningId: id,
        level: "ERROR",
        stage: "ROLLBACK_FINALIZE",
        status: "FAILED",
        message: reason,
        payload: {
          forcedLinks: result.forcedLinks,
          tokenAuth: auth.tokenAuth,
        },
      });

      return {
        ok: true,
        status: "FAILED",
        forcedLinks: result.forcedLinks,
      };
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });
}

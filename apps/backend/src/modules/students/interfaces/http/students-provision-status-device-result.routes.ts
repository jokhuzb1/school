import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsProvisionStatusDeviceResultRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, sendHttpError, DEVICE_AUTO_REGISTER_ENABLED, logProvisioningEvent, ensureProvisioningAuth, computeProvisioningStatus } = deps;

  fastify.get("/provisioning/:id", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const provisioning = await studentsRepo.studentProvisioning.findUnique({
        where: { id },
        include: {
          student: true,
          devices: { include: { device: true } },
        },
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

      return provisioning;
    } catch (err) {
      return sendHttpError(reply, err);
    }
  });

  // Report per-device result
  fastify.post("/provisioning/:id/device-result", async (request: any, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body || {};

      const status = String(body.status || "").toUpperCase() as
        | "SUCCESS"
        | "FAILED";
      if (!["SUCCESS", "FAILED"].includes(status)) {
        return reply.status(400).send({ error: "Invalid status" });
      }

      const provisioning = await studentsRepo.studentProvisioning.findUnique({
        where: { id },
      });
      if (!provisioning) {
        return reply.status(404).send({ error: "Provisioning not found" });
      }

      fastify.log.info(
        {
          provisioningId: id,
          status,
          deviceId: body.deviceId,
          deviceExternalId: body.deviceExternalId,
          deviceName: body.deviceName,
        },
        "provisioning.device-result received",
      );

      const auth = await ensureProvisioningAuth(
        request,
        reply,
        provisioning.schoolId,
        provisioning.studentId,
      );
      if (!auth) return;

      const deviceId = body.deviceId ? String(body.deviceId) : null;
      const deviceExternalId = body.deviceExternalId
        ? String(body.deviceExternalId)
        : null;

      if (!deviceId && !deviceExternalId) {
        await logProvisioningEvent({
          schoolId: provisioning.schoolId,
          studentId: provisioning.studentId,
          provisioningId: id,
          level: "ERROR",
          stage: "DEVICE_RESULT",
          status: "FAILED",
          message: "deviceId or deviceExternalId is required",
          payload: {
            deviceName: body.deviceName,
            deviceType: body.deviceType,
            deviceLocation: body.deviceLocation,
          },
        });
        return reply.status(400).send({ error: "deviceId or deviceExternalId is required" });
      }

      let device = null;
      if (deviceId) {
        device = await studentsRepo.device.findFirst({
          where: { id: deviceId, schoolId: provisioning.schoolId },
        });
      } else if (deviceExternalId) {
        device = await studentsRepo.device.findFirst({
          where: { deviceId: deviceExternalId, schoolId: provisioning.schoolId },
        });
      }

      if (!device && deviceExternalId && DEVICE_AUTO_REGISTER_ENABLED) {
        device = await studentsRepo.device.create({
          data: {
            schoolId: provisioning.schoolId,
            deviceId: deviceExternalId,
            name: body.deviceName || `Auto ${deviceExternalId}`,
            type: body.deviceType || "ENTRANCE",
            location: body.deviceLocation || "Desktop provisioning",
            isActive: true,
          } as any,
        });
      }

      if (!device && body.deviceName) {
        const matches = await studentsRepo.device.findMany({
          where: { schoolId: provisioning.schoolId, name: body.deviceName },
        });
        if (matches.length === 1) {
          device = matches[0];
        } else if (matches.length > 1) {
          await logProvisioningEvent({
            schoolId: provisioning.schoolId,
            studentId: provisioning.studentId,
            provisioningId: id,
            level: "ERROR",
            stage: "DEVICE_RESULT",
            status: "FAILED",
            message: "Multiple devices with same name",
            payload: {
              deviceName: body.deviceName,
              deviceExternalId,
            },
          });
          return reply.status(400).send({ error: "Multiple devices with same name" });
        }
      }

      if (!device) {
        await logProvisioningEvent({
          schoolId: provisioning.schoolId,
          studentId: provisioning.studentId,
          provisioningId: id,
          level: "ERROR",
          stage: "DEVICE_RESULT",
          status: "FAILED",
          message: "Device not found",
          payload: {
            deviceId,
            deviceExternalId,
            deviceName: body.deviceName,
          },
        });
        return reply.status(404).send({ error: "Device not found" });
      }

      const now = new Date();
      const result = await studentsRepo.$transaction(async (tx) => {
        const link = await tx.studentDeviceLink.upsert({
          where: {
            provisioningId_deviceId: {
              provisioningId: id,
              deviceId: device.id,
            },
          } as any,
          update: {
            status,
            lastError: body.error || null,
            employeeNoOnDevice: body.employeeNoOnDevice || null,
            attemptCount: { increment: 1 },
            lastAttemptAt: now,
          },
          create: {
            studentId: provisioning.studentId,
            deviceId: device.id,
            provisioningId: id,
            status,
            lastError: body.error || null,
            employeeNoOnDevice: body.employeeNoOnDevice || null,
            attemptCount: 1,
            lastAttemptAt: now,
          },
        });

        const links = await tx.studentDeviceLink.findMany({
          where: { provisioningId: id },
          select: { status: true },
        });
        const overallStatus = computeProvisioningStatus(
          links as Array<{ status: "PENDING" | "SUCCESS" | "FAILED" }>,
        );

        const updatedProvisioning = await tx.studentProvisioning.update({
          where: { id },
          data: {
            status: overallStatus,
            lastError: status === "FAILED" ? body.error || null : null,
          },
        });

        await tx.student.update({
          where: { id: provisioning.studentId },
          data: {
            deviceSyncStatus: overallStatus,
            deviceSyncUpdatedAt: now,
          },
        });

        return { link, provisioning: updatedProvisioning };
      });

      await logProvisioningEvent({
        schoolId: provisioning.schoolId,
        studentId: provisioning.studentId,
        provisioningId: id,
        deviceId: device.id,
        level: status === "FAILED" ? "ERROR" : "INFO",
        stage: "DEVICE_RESULT",
        status,
        message: body.error || null,
        payload: {
          deviceExternalId,
          deviceName: body.deviceName,
          deviceType: body.deviceType,
          deviceLocation: body.deviceLocation,
          employeeNoOnDevice: body.employeeNoOnDevice,
        },
      });

      return {
        ok: true,
        provisioningStatus: result.provisioning.status,
        deviceStatus: result.link.status,
      };
    } catch (err) {
      fastify.log.error({ err }, "provisioning.device-result failed");
      return sendHttpError(reply, err);
    }
  });
}

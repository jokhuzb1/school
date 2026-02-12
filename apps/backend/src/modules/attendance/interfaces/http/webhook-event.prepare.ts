import crypto from "crypto";
import { FastifyInstance, FastifyRequest } from "fastify";
import { DEVICE_AUTO_REGISTER_ENABLED } from "../../../../config";
import prisma from "../../../../prisma";
import { createAttendanceHttpPrismaRepository } from "../../infrastructure/attendance-http.prisma-repository";
import { getDateOnlyInZone } from "../../../../utils/date";
import { logAudit } from "../../../../utils/audit";

const attendanceRepo = createAttendanceHttpPrismaRepository(prisma);

export type NormalizedEvent = {
  employeeNoString: string;
  deviceID: string;
  dateTime: string;
  studentName?: string;
  rawPayload: any;
};

export const normalizeEvent = (accessEventJson: any): NormalizedEvent | null => {
  const outerEvent = accessEventJson;
  const innerEvent = accessEventJson.AccessControllerEvent || accessEventJson;

  const subEventType = innerEvent.subEventType;
  if (subEventType !== 75) {
    return null;
  }

  const employeeNoString = innerEvent.employeeNoString;
  const deviceID = outerEvent.deviceID || innerEvent.deviceID;
  const dateTime = outerEvent.dateTime || innerEvent.dateTime;
  const studentName = innerEvent.name;

  if (!employeeNoString || !deviceID || !dateTime) return null;

  return {
    employeeNoString,
    deviceID,
    dateTime,
    studentName,
    rawPayload: accessEventJson,
  };
};

export type PrepareWebhookOptions = {
  fastify?: FastifyInstance;
  request?: FastifyRequest;
  normalizedEvent?: NormalizedEvent | null;
};

export type PreparedWebhookContext = {
  school: any;
  direction: string;
  savedPicturePath: string | null;
  employeeNoString: string;
  deviceID: string;
  dateTime: string;
  rawPayload: any;
  eventTime: Date;
  eventType: "IN" | "OUT";
  deviceType: "ENTRANCE" | "EXIT";
  schoolTimeZone: string;
  dateOnly: Date;
  isTodayEvent: boolean;
  eventKey: string;
  device: { id: string } | null;
  student: any;
  cls: any;
  audit: (detail: Parameters<typeof logAudit>[1]) => void;
};

export async function prepareWebhookContext(
  school: any,
  direction: string,
  accessEventJson: any,
  savedPicturePath: string | null,
  opts?: PrepareWebhookOptions,
): Promise<{ context: PreparedWebhookContext } | { ok: true; ignored: true }> {
  const normalized = opts?.normalizedEvent ?? normalizeEvent(accessEventJson);
  if (!normalized) {
    if (opts?.fastify) {
      logAudit(opts.fastify, {
        action: "webhook.event.invalid",
        level: "warn",
        message: "Incorrect webhook payload",
        extra: { direction },
      });
    }
    return { ok: true, ignored: true };
  }

  const { employeeNoString, deviceID, dateTime, rawPayload } = normalized;
  const eventTime = new Date(dateTime);
  const eventType = direction === "in" ? "IN" : "OUT";
  const deviceType = direction === "in" ? "ENTRANCE" : "EXIT";
  const schoolTimeZone = school?.timezone || "Asia/Tashkent";
  const dateOnly = getDateOnlyInZone(new Date(dateTime), schoolTimeZone);
  const todayDate = getDateOnlyInZone(new Date(), schoolTimeZone);
  const isTodayEvent = dateOnly.getTime() === todayDate.getTime();
  const eventKey = crypto
    .createHash("sha256")
    .update(`${deviceID}:${employeeNoString}:${dateTime}:${direction}`)
    .digest("hex");

  const [deviceFound, studentWithClass] = await Promise.all([
    attendanceRepo.device.findFirst({
      where: { deviceId: deviceID, schoolId: school.id },
      select: { id: true },
    }),
    attendanceRepo.student.findFirst({
      where: { deviceStudentId: employeeNoString, schoolId: school.id },
      include: { class: true },
    }),
  ]);

  let device = deviceFound;
  if (!device && DEVICE_AUTO_REGISTER_ENABLED) {
    try {
      const existingByDeviceId = await attendanceRepo.device.findUnique({
        where: { deviceId: deviceID },
        select: { id: true, schoolId: true },
      });

      if (!existingByDeviceId) {
        const created = await attendanceRepo.device.create({
          data: {
            schoolId: school.id,
            deviceId: deviceID,
            name: `Auto ${deviceID}`,
            type: deviceType as any,
            location: "Auto-discovered",
            isActive: true,
            lastSeenAt: eventTime,
          },
          select: { id: true },
        });
        device = created;
        if (opts?.fastify) {
          logAudit(opts.fastify, {
            action: "device.auto_registered",
            level: "info",
            message: "Device auto-registered from webhook event",
            schoolId: school?.id,
            requestId: opts.request?.id,
            extra: { deviceId: deviceID, deviceType },
          });
        }
      } else if (existingByDeviceId.schoolId !== school.id) {
        if (opts?.fastify) {
          logAudit(opts.fastify, {
            action: "device.auto_register_conflict",
            level: "warn",
            message: "DeviceId already belongs to a different school",
            schoolId: school?.id,
            requestId: opts.request?.id,
            extra: { deviceId: deviceID, existingSchoolId: existingByDeviceId.schoolId },
          });
        }
      }
    } catch (err) {
      if (opts?.fastify) {
        logAudit(opts.fastify, {
          action: "device.auto_register_failed",
          level: "warn",
          message: "Device auto-register failed",
          schoolId: school?.id,
          requestId: opts.request?.id,
          extra: {
            deviceId: deviceID,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
    }
  }

  const student = studentWithClass;
  const cls = studentWithClass?.class;

  const audit = (detail: Parameters<typeof logAudit>[1]) => {
    if (!opts?.fastify) return;
    logAudit(opts.fastify, {
      schoolId: school?.id,
      studentId: student?.id,
      requestId: opts.request?.id,
      ...detail,
    });
  };

  if (device?.id) {
    await attendanceRepo.device.update({
      where: { id: device.id },
      data: { lastSeenAt: eventTime, isActive: true },
    });
  }

  return {
    context: {
      school,
      direction,
      savedPicturePath,
      employeeNoString,
      deviceID,
      dateTime,
      rawPayload,
      eventTime,
      eventType,
      deviceType,
      schoolTimeZone,
      dateOnly,
      isTodayEvent,
      eventKey,
      device,
      student,
      cls,
      audit,
    },
  };
}


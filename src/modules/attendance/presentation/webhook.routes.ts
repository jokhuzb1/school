import { FastifyInstance, FastifyRequest } from "fastify";
import prisma from "../../../prisma";
import { emitAttendance } from "../../../eventEmitter";
import { markClassDirty, markSchoolDirty } from "../../../realtime/snapshotScheduler";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDateOnlyInZone, getTimePartsInZone } from "../../../utils/date";
import { logAudit } from "../../../utils/audit";
import {
  IS_PROD,
  DEVICE_AUTO_REGISTER_ENABLED,
  MIN_SCAN_INTERVAL_SECONDS,
  WEBHOOK_ENFORCE_SECRET,
  WEBHOOK_SECRET_HEADER,
} from "../../../config";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

type NormalizedEvent = {
  employeeNoString: string;
  deviceID: string;
  dateTime: string;
  studentName?: string;
  rawPayload: any;
};

const normalizeEvent = (accessEventJson: any): NormalizedEvent | null => {
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

// Optimized attendance handler with parallel queries and transactions
const handleAttendanceEvent = async (
  school: any,
  direction: string,
  accessEventJson: any,
  savedPicturePath: string | null,
  opts?: {
    fastify?: FastifyInstance;
    request?: FastifyRequest;
  },
) => {
  const normalized = normalizeEvent(accessEventJson);
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

  // ✅ OPTIMIZATION 1: Parallel queries - device va student ni bir vaqtda olish
  const [deviceFound, studentWithClass] = await Promise.all([
    prisma.device.findFirst({
      where: { deviceId: deviceID, schoolId: school.id },
      select: { id: true }, // Faqat kerakli field
    }),
    prisma.student.findFirst({
      where: { deviceStudentId: employeeNoString, schoolId: school.id },
      include: { class: true }, // Class ni ham bir queryda olish
    }),
  ]);

  let device = deviceFound;
  if (!device && DEVICE_AUTO_REGISTER_ENABLED) {
    try {
      // If this deviceId already exists for another school, don't attach it here.
      const existingByDeviceId = await prisma.device.findUnique({
        where: { deviceId: deviceID },
        select: { id: true, schoolId: true },
      });

      if (!existingByDeviceId) {
        const created = await prisma.device.create({
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
          extra: { deviceId: deviceID, error: err instanceof Error ? err.message : String(err) },
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

  // Update device lastSeenAt so UI 'Holat' reflects recent activity
  if (device?.id) {
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: eventTime, isActive: true },
    });
  }
  

  let event: any = null;
  let statusReason: string | null = null;
  let computedDiff: number | null = null;
  let updatedStatus: string | null = null;
  let createdStatus: string | null = null;
  let createdLateMinutes: number | null = null;

  try {
    const txResult = await prisma.$transaction(async (tx) => {
      const existing = student
        ? await tx.dailyAttendance.findUnique({
            where: { studentId_date: { studentId: student.id, date: dateOnly } },
          })
        : null;

      if (student && existing) {
        const MIN_SCAN_INTERVAL = Math.max(0, MIN_SCAN_INTERVAL_SECONDS) * 1000;
        if (
          eventType === "IN" &&
          existing.currentlyInSchool &&
          existing.lastInTime
        ) {
          const timeSinceLastIn =
            eventTime.getTime() - new Date(existing.lastInTime).getTime();
          if (timeSinceLastIn < MIN_SCAN_INTERVAL) {
            return { kind: "duplicate_scan" as const, event: null, existing };
          }
        }
        if (
          eventType === "OUT" &&
          !existing.currentlyInSchool &&
          existing.lastOutTime
        ) {
          const timeSinceLastOut =
            eventTime.getTime() - new Date(existing.lastOutTime).getTime();
          if (timeSinceLastOut < MIN_SCAN_INTERVAL) {
            return { kind: "duplicate_scan" as const, event: null, existing };
          }
        }
      }

      const createdEvent = await tx.attendanceEvent.create({
        data: {
          eventKey,
          studentId: student?.id,
          schoolId: school.id,
          deviceId: device?.id,
          eventType,
          timestamp: eventTime,
          rawPayload: { ...rawPayload, _savedPicture: savedPicturePath },
        } as any,
      });

      if (!student) {
        return { kind: "event_only" as const, event: createdEvent, existing: null };
      }

      if (existing) {
        const update: any = {
          lastScanTime: eventTime,
          scanCount: existing.scanCount + 1,
        };

        if (eventType === "IN") {
          if (!existing.firstScanTime && cls) {
            const [h, m] = cls.startTime.split(":").map(Number);
            const timeParts = getTimePartsInZone(eventTime, schoolTimeZone);
            const diff = timeParts.hours * 60 + timeParts.minutes - (h * 60 + m);
            const afterAbsenceCutoff = diff >= school.absenceCutoffMinutes;
            computedDiff = diff;

            if (existing.status === "ABSENT") {
              update.status = "ABSENT";
              update.lateMinutes = null;
              statusReason = "existing_absent";
            } else if (afterAbsenceCutoff) {
              update.status = "ABSENT";
              update.lateMinutes = null;
              statusReason = "absent_cutoff";
            } else if (diff >= school.lateThresholdMinutes) {
              update.status = "LATE";
              update.lateMinutes = Math.round(
                diff - school.lateThresholdMinutes,
              );
              statusReason = "late_threshold";
            } else {
              update.status = "PRESENT";
              update.lateMinutes = null;
              statusReason = "present";
            }
          }
          if (!existing.firstScanTime) {
            update.firstScanTime = eventTime;
          }
          update.lastInTime = eventTime;
          update.currentlyInSchool = true;
        } else {
          update.lastOutTime = eventTime;
          update.currentlyInSchool = false;
          if (existing.lastInTime && existing.currentlyInSchool) {
            const sessionMinutes = Math.round(
              (eventTime.getTime() -
                new Date(existing.lastInTime).getTime()) /
                60000,
            );
            if (sessionMinutes > 0 && sessionMinutes < 720) {
              update.totalTimeOnPremises =
                (existing.totalTimeOnPremises || 0) + sessionMinutes;
            }
          }
        }

        updatedStatus = update.status || existing.status;

        await tx.dailyAttendance.update({
          where: { id: existing.id },
          data: update,
        });

        return { kind: "updated" as const, event: createdEvent, existing };
      }

      let status: any = "PRESENT";
      let lateMinutes: number | null = null;

      if (eventType === "IN" && cls) {
        const [h, m] = cls.startTime.split(":").map(Number);
        const timeParts = getTimePartsInZone(eventTime, schoolTimeZone);
        const diff = timeParts.hours * 60 + timeParts.minutes - (h * 60 + m);
        if (diff >= school.absenceCutoffMinutes) {
          status = "ABSENT";
          lateMinutes = null;
        } else if (diff >= school.lateThresholdMinutes) {
          status = "LATE";
          lateMinutes = Math.round(diff - school.lateThresholdMinutes);
        }
      }

      createdStatus = status;
      createdLateMinutes = lateMinutes;

      await tx.dailyAttendance.create({
        data: {
          studentId: student.id,
          schoolId: school.id,
          date: dateOnly,
          status,
          firstScanTime: eventType === "IN" ? eventTime : null,
          lastScanTime: eventTime,
          lateMinutes,
          lastInTime: eventType === "IN" ? eventTime : null,
          lastOutTime: eventType === "OUT" ? eventTime : null,
          currentlyInSchool: eventType === "IN",
          scanCount: 1,
          notes: eventType === "OUT" ? "OUT before first IN" : null,
        },
      });

      return { kind: "created" as const, event: createdEvent, existing: null };
    });

    if (txResult.kind === "duplicate_scan") {
      audit({
        action: "webhook.duplicate_scan",
        level: "info",
        message: "Duplikat scan bekor qilindi",
        extra: { eventType },
      });
      return { ok: true, ignored: true, reason: "duplicate_scan" };
    }

    event = txResult.event;
  } catch (err: any) {
    if (err?.code === "P2002") {
      audit({
        action: "webhook.duplicate_event",
        level: "info",
        message: "Duplikat event bekor qilindi",
        extra: { eventKey, direction },
      });
      return { ok: true, ignored: true, reason: "duplicate_event" };
    }
    throw err;
  }

  if (student && updatedStatus) {
    audit({
      action: "webhook.attendance.update",
      level: "info",
      message: `Holat yangilandi`,
      extra: {
        diff: computedDiff,
        reason: statusReason,
        eventType,
        newStatus: updatedStatus,
      },
    });
  }

  if (student && createdStatus) {
    audit({
      action: "webhook.attendance.create",
      level: "info",
      message: `Yangi rekord: ${createdStatus}`,
      extra: {
        eventType,
        status: createdStatus,
        lateMinutes: createdLateMinutes,
      },
    });
  }

  if (student && savedPicturePath) {
    prisma.student
      .update({
        where: { id: student.id },
        data: { photoUrl: savedPicturePath },
      })
      .catch(() => {});
  }

  // ✅ OPTIMIZATION 5: Event emission - sinxron emas, fire-and-forget
  const eventPayload = {
    schoolId: school.id,
    event: {
      ...event,
      student: student
        ? {
            id: student.id,
            name: student.name,
            classId: cls ? cls.id : null,
            class: cls ? { name: cls.name } : null,
          }
        : null,
    },
  };

  if (isTodayEvent) {
    // Emit to school-specific listeners (today only)
    emitAttendance(eventPayload);

    markSchoolDirty(school.id);
    if (eventPayload.event?.student?.classId) {
      markClassDirty(school.id, eventPayload.event.student.classId);
    }
  }

  return { ok: true, event };
};

export default async function (fastify: FastifyInstance) {
  // Add content type parser for this route to accept JSON
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (req, body, done) => {
      try {
        done(null, JSON.parse(body as string));
      } catch (err: any) {
        done(err, undefined);
      }
    },
  );

  fastify.post("/webhook/:schoolId/:direction", async (request: any, reply) => {
    const params = request.params as { schoolId: string; direction: string };
    if (!["in", "out"].includes(params.direction)) {
      return reply.status(400).send({ error: "Invalid direction" });
    }

    // Try to find school by UUID first, then by name/slug
    let school = await prisma.school.findUnique({
      where: { id: params.schoolId },
    });

    // If not found by UUID, try to find by name (case-insensitive search)
    if (!school) {
      const schools = await prisma.school.findMany({
        where: {
          OR: [
            { name: { contains: params.schoolId, mode: "insensitive" } },
            {
              name: {
                equals: `School #${params.schoolId.toLowerCase().replace("school", "")}`,
                mode: "insensitive",
              },
            },
          ],
        },
      });

      if (schools.length > 0) {
        school = schools[0];
        if (schools.length > 1) {
          console.warn(
            `WARNING: Multiple schools found for ID/slug "${params.schoolId}". Using the first one (${school.id}).`,
          );
        }
      }
    }

    if (!school) {
      console.error(`ERROR: School not found for ID/slug "${params.schoolId}"`);
      return reply.status(404).send({ error: "School not found" });
    }

    if (!IS_PROD) {
      console.log("=== WEBHOOK REQUEST START ===");
      console.log("School:", school.name, school.id);
      console.log("Direction:", params.direction);
      console.log("Content-Type:", request.headers["content-type"]);
    }

    if (WEBHOOK_ENFORCE_SECRET) {
      const secretFromQuery = request.query?.secret as string | undefined;
      const secretFromHeader = request.headers[WEBHOOK_SECRET_HEADER] as
        | string
        | undefined;
      const providedSecret = secretFromQuery || secretFromHeader;
      const expected =
        params.direction === "in"
          ? school.webhookSecretIn
          : school.webhookSecretOut;
      if (!providedSecret || providedSecret !== expected) {
        return reply.status(403).send({ error: "Invalid webhook secret" });
      }
    }

    let accessEventJson: any = null;
    let picture: any = null;

    try {
      const contentType = request.headers["content-type"] || "";

      // Since we use addToBody: true, multipart fields are in request.body
      if (!IS_PROD) {
        console.log("=== REQUEST BODY DEBUG ===");
        console.log("Body type:", typeof request.body);
        console.log(
          "Body keys:",
          request.body ? Object.keys(request.body) : "null",
        );
        console.log(
          "Full body:",
          JSON.stringify(request.body, null, 2).substring(0, 2000),
        );
        console.log("==========================");
      }

      if (contentType.includes("multipart")) {
        // With addToBody: true, fields are directly in request.body
        const body = request.body || {};

        // Try common Hikvision field names
        const possibleEventFields = [
          "AccessControllerEvent",
          "accessControllerEvent",
          "event",
          "Event",
          "data",
          "Data",
        ];

        for (const fieldName of possibleEventFields) {
          if (body[fieldName]) {
            console.log(`Found field: ${fieldName}`);
            const val = body[fieldName];
            if (typeof val === "string") {
              accessEventJson = JSON.parse(val);
            } else if (val.value) {
              // Multipart field with value property
              accessEventJson =
                typeof val.value === "string"
                  ? JSON.parse(val.value)
                  : val.value;
            } else {
              accessEventJson = val;
            }
            break;
          }
        }

        // Check for picture
        if (body.Picture || body.picture) {
          picture = body.Picture || body.picture;
        }
      } else {
        // Non-multipart - try JSON
        if (!IS_PROD) {
          console.log("Non-multipart request, body:", request.body);
        }
        if (request.body?.AccessControllerEvent) {
          accessEventJson = request.body.AccessControllerEvent;
        } else if (request.body) {
          accessEventJson = request.body;
        }
      }
    } catch (err) {
      console.error("Parse error:", err);
      return reply
        .status(400)
        .send({ error: "Parse failed", msg: String(err) });
    }

    if (!accessEventJson) {
      console.log("No AccessControllerEvent found");
      return reply.status(400).send({ error: "Missing AccessControllerEvent" });
    }

    // Log all received event data for debugging
    if (!IS_PROD) {
      console.log("=== WEBHOOK EVENT RECEIVED ===");
      console.log("School ID:", params.schoolId);
      console.log("Direction:", params.direction);
      console.log(
        "Full AccessControllerEvent:",
        JSON.stringify(accessEventJson, null, 2),
      );
      console.log("==============================");
    }

    const normalized = normalizeEvent(accessEventJson);
    if (!normalized) {
      logAudit(fastify, {
        action: "webhook.request.invalid",
        level: "warn",
        message: "Event noto‘g‘ri formatda kelgan",
        schoolId: school.id,
        extra: { direction: params.direction },
      });
      return reply.send({ ok: true, ignored: true });
    }

    logAudit(fastify, {
      action: "webhook.request.received",
      level: "info",
      message: "Webhook voqeasi qabul qilindi",
      schoolId: school.id,
      extra: {
        direction: params.direction,
        employeeNoString: normalized.employeeNoString,
        deviceID: normalized.deviceID,
        dateTime: normalized.dateTime,
      },
    });

    if (!IS_PROD) {
      console.log("Processing face recognition event:");
      console.log("  - employeeNoString:", normalized.employeeNoString);
      console.log("  - deviceID:", normalized.deviceID);
      console.log("  - dateTime:", normalized.dateTime);
      console.log("  - studentName:", normalized.studentName);
    }

    // save picture (if provided) - addToBody gives us Buffer or array
    let savedPicturePath: string | null = null;
    if (picture) {
      try {
        await fs.promises.mkdir(UPLOADS_DIR, { recursive: true });
        const filename = `${Date.now()}-face.jpg`;
        const filepath = path.join(UPLOADS_DIR, filename);

        let buf: Buffer;
        if (Array.isArray(picture)) {
          const p = picture[0];
          buf = p.data ? Buffer.from(p.data) : Buffer.from(p);
        } else if (picture.data) {
          buf = Buffer.from(picture.data);
        } else {
          buf = Buffer.from(picture);
        }

        await fs.promises.writeFile(filepath, buf);
        savedPicturePath = path
          .relative(process.cwd(), filepath)
          .replace(/\\\\/g, "/");
        console.log("Picture saved:", savedPicturePath);
      } catch (err) {
        console.error("Picture save error:", err);
      }
    }

    const result = await handleAttendanceEvent(
      school,
      params.direction,
      accessEventJson,
      savedPicturePath,
      { fastify, request },
    );

    return reply.send(result);
  });
}



import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import { attendanceEmitter, adminEmitter } from "../eventEmitter";
import { MultipartFile } from "@fastify/multipart";
import fs from "fs";
import path from "path";
import { getDateOnlyInZone, getTimePartsInZone } from "../utils/date";

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
) => {
  const normalized = normalizeEvent(accessEventJson);
  if (!normalized) {
    return { ok: true, ignored: true };
  }

  const { employeeNoString, deviceID, dateTime, rawPayload } = normalized;
  const eventTime = new Date(dateTime);
  const eventType = direction === "in" ? "IN" : "OUT";
  const schoolTimeZone = school?.timezone || "Asia/Tashkent";
  const dateOnly = getDateOnlyInZone(new Date(dateTime), schoolTimeZone);

  // ✅ OPTIMIZATION 1: Parallel queries - device va student ni bir vaqtda olish
  const [device, studentWithClass] = await Promise.all([
    prisma.device.findFirst({
      where: { deviceId: deviceID, schoolId: school.id },
      select: { id: true }, // Faqat kerakli field
    }),
    prisma.student.findFirst({
      where: { deviceStudentId: employeeNoString },
      include: { class: true }, // Class ni ham bir queryda olish
    }),
  ]);

  const student = studentWithClass;
  const cls = studentWithClass?.class;

  // Update device lastSeenAt so UI 'Holat' reflects recent activity
  if (device?.id) {
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeenAt: eventTime, isActive: true },
    });
  }
  

  // ✅ OPTIMIZATION 2: AttendanceEvent yaratish va DailyAttendance ni parallel tekshirish
  const [event, existing] = await Promise.all([
    prisma.attendanceEvent.create({
      data: {
        studentId: student?.id,
        schoolId: school.id,
        deviceId: device?.id,
        eventType,
        timestamp: eventTime,
        rawPayload: { ...rawPayload, _savedPicture: savedPicturePath },
      },
    }),
    student
      ? prisma.dailyAttendance.findUnique({
          where: { studentId_date: { studentId: student.id, date: dateOnly } },
        })
      : null,
  ]);

  if (student) {
    const MIN_SCAN_INTERVAL = 2 * 60 * 1000; // 2 daqiqa

    if (existing) {
      // Duplicate scan tekshirish
      if (eventType === "IN" && existing.currentlyInSchool && existing.lastInTime) {
        const timeSinceLastIn = eventTime.getTime() - new Date(existing.lastInTime).getTime();
        if (timeSinceLastIn < MIN_SCAN_INTERVAL) {
          return { ok: true, ignored: true, reason: "duplicate_scan" };
        }
      }
      if (eventType === "OUT" && !existing.currentlyInSchool && existing.lastOutTime) {
        const timeSinceLastOut = eventTime.getTime() - new Date(existing.lastOutTime).getTime();
        if (timeSinceLastOut < MIN_SCAN_INTERVAL) {
          return { ok: true, ignored: true, reason: "duplicate_scan" };
        }
      }

      // Update data tayyorlash
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

          if (existing.status === "ABSENT") {
            // Statusni ABSENT sifatida saqlab qolamiz (cutoffdan keyin kelgan bo'lsa ham)
            update.status = "ABSENT";
            update.lateMinutes = null;
          } else if (afterAbsenceCutoff) {
            update.status = "ABSENT";
            update.lateMinutes = null;
          } else if (diff > school.lateThresholdMinutes) {
            update.status = "LATE";
            update.lateMinutes = Math.round(diff - school.lateThresholdMinutes);
          } else {
            update.status = "PRESENT";
            update.lateMinutes = null;
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
            (eventTime.getTime() - new Date(existing.lastInTime).getTime()) / 60000
          );
          if (sessionMinutes > 0 && sessionMinutes < 720) {
            update.totalTimeOnPremises = (existing.totalTimeOnPremises || 0) + sessionMinutes;
          }
        }
      }

      // ✅ OPTIMIZATION 3: Photo update va DailyAttendance update ni parallel
      const updatePromises: Promise<any>[] = [
        prisma.dailyAttendance.update({
          where: { id: existing.id },
          data: update,
        }),
      ];

      if (savedPicturePath) {
        updatePromises.push(
          prisma.student.update({
            where: { id: student.id },
            data: { photoUrl: savedPicturePath },
          }).catch(() => {}) // Ignore photo update errors
        );
      }

      await Promise.all(updatePromises);
    } else {
      // Yangi DailyAttendance yaratish
      let status: any = "PRESENT";
      let lateMinutes: number | null = null;

      if (eventType === "IN" && cls) {
        const [h, m] = cls.startTime.split(":").map(Number);
        const timeParts = getTimePartsInZone(eventTime, schoolTimeZone);
        const diff = timeParts.hours * 60 + timeParts.minutes - (h * 60 + m);
        if (diff >= school.absenceCutoffMinutes) {
          status = "ABSENT";
          lateMinutes = null;
        } else if (diff > school.lateThresholdMinutes) {
          status = "LATE";
          lateMinutes = Math.round(diff - school.lateThresholdMinutes);
        }
      }

      // ✅ OPTIMIZATION 4: Create va photo update parallel
      const createPromises: Promise<any>[] = [
        prisma.dailyAttendance.create({
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
        }),
      ];

      if (savedPicturePath) {
        createPromises.push(
          prisma.student.update({
            where: { id: student.id },
            data: { photoUrl: savedPicturePath },
          }).catch(() => {})
        );
      }

      await Promise.all(createPromises);
    }
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

  // Emit to school-specific listeners
  attendanceEmitter.emit("attendance", eventPayload);

  // Emit to admin dashboard listeners
  adminEmitter.emit("admin_update", {
    type: "attendance_event",
    schoolId: school.id,
    schoolName: school.name,
    data: {
      event: eventPayload.event,
    },
  });

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

    console.log("=== WEBHOOK REQUEST START ===");
    console.log("School:", school.name, school.id);
    console.log("Direction:", params.direction);
    console.log("Content-Type:", request.headers["content-type"]);

    // verify secret query param (disabled for testing—Hikvision can't add query params)
    // TODO: Re-enable or replace with IP whitelist for production
    // const secret = request.query?.secret as string | undefined;
    // const expected = params.direction === 'in' ? school.webhookSecretIn : school.webhookSecretOut;
    // if (!secret || secret !== expected) return reply.status(403).send({ error: 'Invalid webhook secret' });

    let accessEventJson: any = null;
    let picture: any = null;

    try {
      const contentType = request.headers["content-type"] || "";

      // Since we use addToBody: true, multipart fields are in request.body
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
        console.log("Non-multipart request, body:", request.body);
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
    console.log("=== WEBHOOK EVENT RECEIVED ===");
    console.log("School ID:", params.schoolId);
    console.log("Direction:", params.direction);
    console.log(
      "Full AccessControllerEvent:",
      JSON.stringify(accessEventJson, null, 2),
    );
    console.log("==============================");

    const normalized = normalizeEvent(accessEventJson);
    if (!normalized) {
      return reply.send({ ok: true, ignored: true });
    }

    console.log("Processing face recognition event:");
    console.log("  - employeeNoString:", normalized.employeeNoString);
    console.log("  - deviceID:", normalized.deviceID);
    console.log("  - dateTime:", normalized.dateTime);
    console.log("  - studentName:", normalized.studentName);

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
    );

    return reply.send(result);
  });
}



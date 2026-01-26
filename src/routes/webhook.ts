import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import { attendanceEmitter } from "../eventEmitter";
import { MultipartFile } from "@fastify/multipart";
import fs from "fs";
import path from "path";
import { getLocalDateKey, getLocalDateOnly } from "../utils/date";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

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

    // Hikvision sends nested structure: outer has dateTime/deviceID, inner has subEventType/employeeNoString
    const outerEvent = accessEventJson;
    const innerEvent = accessEventJson.AccessControllerEvent || accessEventJson;

    const subEventType = innerEvent.subEventType;
    console.log("subEventType:", subEventType);

    if (subEventType !== 75) {
      console.log(
        "Ignoring non-face-recognition event, subEventType:",
        subEventType,
      );
      return reply.send({ ok: true, ignored: true });
    }

    const employeeNoString = innerEvent.employeeNoString;
    const deviceID = outerEvent.deviceID || innerEvent.deviceID;
    const dateTime = outerEvent.dateTime || innerEvent.dateTime;
    const studentName = innerEvent.name;

    console.log("Processing face recognition event:");
    console.log("  - employeeNoString:", employeeNoString);
    console.log("  - deviceID:", deviceID);
    console.log("  - dateTime:", dateTime);
    console.log("  - studentName:", studentName);

    // find device (limit to same school)
    const device = await prisma.device.findFirst({
      where: { deviceId: deviceID, schoolId: school.id },
    });

    // find student by deviceStudentId
    const student = await prisma.student.findFirst({
      where: { deviceStudentId: employeeNoString },
    });

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

    const event = await prisma.attendanceEvent.create({
      data: {
        studentId: student?.id,
        schoolId: school.id,
        deviceId: device?.id,
        eventType: params.direction === "in" ? "IN" : "OUT",
        timestamp: new Date(dateTime),
        rawPayload: { ...accessEventJson, _savedPicture: savedPicturePath },
      },
    });

    // Update or create DailyAttendance
    console.log("Student found:", student?.id, student?.name);
    if (student) {
      console.log("Creating/updating DailyAttendance for student:", student.id);
      const schoolClasses = await prisma.class.findMany({
        where: { schoolId: school.id },
      });
      // find student's class
      const cls = await prisma.class
        .findUnique({ where: { id: student.classId ?? "" } })
        .catch(() => null);

      // Use local date key for consistent day grouping
      const eventDate = new Date(dateTime);
      const dateString = getLocalDateKey(eventDate);
      const dateOnly = getLocalDateOnly(eventDate);

      console.log("DEBUG WEBHOOK DATE:", {
        dateTimeInput: dateTime,
        eventDateIso: eventDate.toISOString(),
        dateString,
        dateOnlyIso: dateOnly.toISOString(),
        studentId: student.id,
      });

      const existing = await prisma.dailyAttendance
        .findUnique({
          where: { studentId_date: { studentId: student.id, date: dateOnly } },
        })
        .catch(() => null);

      // IN yoki OUT ekanligini aniqlash
      const eventType = params.direction === "in" ? "IN" : "OUT";
      const eventTime = new Date(dateTime);

      if (existing) {
        const update: any = {
          lastScanTime: eventTime,
          scanCount: existing.scanCount + 1,
        };

        // Takroriy scan filtri - 2 daqiqa ichida bir xil eventType bo'lsa, ignore
        const MIN_SCAN_INTERVAL = 2 * 60 * 1000; // 2 daqiqa
        
        if (eventType === "IN") {
          if (!existing.firstScanTime && cls) {
            const [h, m] = cls.startTime.split(":").map(Number);
            const diff =
              eventTime.getHours() * 60 +
              eventTime.getMinutes() -
              (h * 60 + m);
            if (diff > school.lateThresholdMinutes) {
              update.status = "LATE";
              update.lateMinutes = Math.round(diff - school.lateThresholdMinutes);
            } else {
              update.status = "PRESENT";
              update.lateMinutes = null;
            }
          }

          // KIRISH
          // Agar allaqachon maktabda bo'lsa va 2 daqiqa ichida yana IN kelsa - ignore
          if (existing.currentlyInSchool && existing.lastInTime) {
            const timeSinceLastIn = eventTime.getTime() - new Date(existing.lastInTime).getTime();
            if (timeSinceLastIn < MIN_SCAN_INTERVAL) {
              console.log(`Ignoring duplicate IN scan (${Math.round(timeSinceLastIn/1000)}s since last IN)`);
              return reply.send({ ok: true, ignored: true, reason: "duplicate_scan" });
            }
          }
          
          if (!existing.firstScanTime) {
            update.firstScanTime = eventTime;
          }
          update.lastInTime = eventTime;
          update.currentlyInSchool = true;
        } else {
          // CHIQISH
          // Agar allaqachon tashqarida bo'lsa va 2 daqiqa ichida yana OUT kelsa - ignore
          if (!existing.currentlyInSchool && existing.lastOutTime) {
            const timeSinceLastOut = eventTime.getTime() - new Date(existing.lastOutTime).getTime();
            if (timeSinceLastOut < MIN_SCAN_INTERVAL) {
              console.log(`Ignoring duplicate OUT scan (${Math.round(timeSinceLastOut/1000)}s since last OUT)`);
              return reply.send({ ok: true, ignored: true, reason: "duplicate_scan" });
            }
          }
          
          update.lastOutTime = eventTime;
          update.currentlyInSchool = false;

          // totalTimeOnPremises hisoblash (agar oldin kirgan bo'lsa va hozir maktabda bo'lsa)
          if (existing.lastInTime && existing.currentlyInSchool) {
            const sessionMinutes = Math.round(
              (eventTime.getTime() - new Date(existing.lastInTime).getTime()) / 60000
            );
            // Faqat musbat qiymatni qo'shamiz (noto'g'ri scan'larni filtrlash)
            if (sessionMinutes > 0 && sessionMinutes < 720) { // max 12 soat
              update.totalTimeOnPremises = (existing.totalTimeOnPremises || 0) + sessionMinutes;
              console.log(`Added ${sessionMinutes} minutes to totalTimeOnPremises`);
            }
          }
        }

        await prisma.dailyAttendance.update({
          where: { id: existing.id },
          data: update,
        });
      } else {
        // Yangi DailyAttendance yaratish
        // Faqat KIRISH bo'lsa yoki birinchi scan bo'lsa
        
        // Kech qolishni aniqlash (faqat IN uchun)
        let status: any = "PRESENT";
        let lateMinutes: number | null = null;
        
        if (eventType === "IN" && cls) {
          const [h, m] = cls.startTime.split(":").map(Number);
          const diff =
            eventTime.getHours() * 60 +
            eventTime.getMinutes() -
            (h * 60 + m);
          if (diff > school.lateThresholdMinutes) {
            status = "LATE";
            lateMinutes = Math.round(diff - school.lateThresholdMinutes);
          }
        } else if (eventType === "OUT") {
          status = "PRESENT";
          lateMinutes = null;
        }

        await prisma.dailyAttendance.create({
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
      }

      // update student photoUrl if not set and picture saved
      if (student && savedPicturePath) {
        try {
          await prisma.student.update({
            where: { id: student.id },
            data: { photoUrl: savedPicturePath },
          });
        } catch (err) {
          // ignore
        }
      }
    }

    // Emit event for SSE clients
    attendanceEmitter.emit('attendance', {
      schoolId: school.id,
      event: {
        ...event,
        student: student ? {
          id: student.id,
          name: student.name,
          class: student.classId ? await prisma.class.findUnique({ where: { id: student.classId } }) : null
        } : null
      }
    });

    return reply.send({ ok: true, event });
  });
}

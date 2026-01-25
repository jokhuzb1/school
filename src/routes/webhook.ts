import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import { MultipartFile } from "@fastify/multipart";
import fs from "fs";
import path from "path";

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

      // Fix date calculation: use the date from event, but ensure it's treated as start of day in local time/school timezone
      // Assuming school timezone is same as server timezone for now, or just using simple date string approach to avoid UTC shifts
      const eventDate = new Date(dateTime);
      const dateString = eventDate.toLocaleDateString("en-CA"); // YYYY-MM-DD
      const dateOnly = new Date(`${dateString}T00:00:00Z`); // Force UTC midnight

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

      if (existing) {
        const update: any = {};
        if (!existing.firstScanTime) update.firstScanTime = new Date(dateTime);
        update.lastScanTime = new Date(dateTime);
        await prisma.dailyAttendance.update({
          where: { id: existing.id },
          data: update,
        });
      } else {
        // determine late
        let status: any = "PRESENT";
        let lateMinutes: number | null = null;
        if (cls) {
          // parse class.startTime like "08:00"
          const [h, m] = cls.startTime.split(":").map(Number);
          const classStart = new Date(dateTime);
          classStart.setHours(h, m, 0, 0);
          const diff =
            (new Date(dateTime).getTime() - classStart.getTime()) / 60000;
          if (diff > school.lateThresholdMinutes) {
            status = "LATE";
            lateMinutes = Math.round(diff - school.lateThresholdMinutes);
          }
        }

        await prisma.dailyAttendance.create({
          data: {
            studentId: student.id,
            schoolId: school.id,
            date: dateOnly,
            status,
            firstScanTime: new Date(dateTime),
            lastScanTime: new Date(dateTime),
            lateMinutes,
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

    return reply.send({ ok: true, event });
  });
}

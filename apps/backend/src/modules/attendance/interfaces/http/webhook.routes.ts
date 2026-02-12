import fs from "fs";
import { FastifyInstance } from "fastify";
import path from "path";
import {
  IS_PROD,
  WEBHOOK_ENFORCE_SECRET,
  WEBHOOK_SECRET_HEADER,
} from "../../../../config";
import { getAppRootDir, getUploadsDir } from "../../../../app/runtime/paths";
import prisma from "../../../../prisma";
import { createAttendanceHttpPrismaRepository } from "../../infrastructure/attendance-http.prisma-repository";
import { logAudit } from "../../../../utils/audit";
import { handleAttendanceEvent } from "./webhook-event.handler";
import { normalizeEvent } from "./webhook-event.prepare";

const UPLOADS_DIR = getUploadsDir();
const attendanceRepo = createAttendanceHttpPrismaRepository(prisma);

export default async function (fastify: FastifyInstance) {
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

    let school = await attendanceRepo.school.findUnique({
      where: { id: params.schoolId },
    });

    if (!school) {
      const schools = await attendanceRepo.school.findMany({
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
        const body = request.body || {};

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

        if (body.Picture || body.picture) {
          picture = body.Picture || body.picture;
        }
      } else {
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
        message: "Event notoâ€˜gâ€˜ri formatda kelgan",
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
          .relative(getAppRootDir(), filepath)
          .replace(/\\/g, "/");
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
      { fastify, request, normalizedEvent: normalized },
    );

    return reply.send(result);
  });
}


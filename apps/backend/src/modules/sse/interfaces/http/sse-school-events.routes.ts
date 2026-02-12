import { FastifyInstance } from "fastify";
import { createSseAccessService } from "../../application/sse-access.service";
import { createSsePrismaRepository } from "../../infrastructure/sse.prisma-repository";
import { AttendanceEventPayload, SseHttpDeps } from "./sse.routes.deps";

export function registerSchoolEventStreamRoute(
  fastify: FastifyInstance,
  deps: SseHttpDeps,
) {
  const { attendanceEmitter, trackConnection, prisma, IS_PROD } = deps;
  const accessService = createSseAccessService(createSsePrismaRepository(prisma));

  fastify.get("/schools/:schoolId/events/stream", async (request: any, reply) => {
    const { schoolId } = request.params;
    const { token } = request.query;

    if (!token) {
      return reply.status(401).send({ error: "Missing token" });
    }

    let decoded: any;
    try {
      decoded = await fastify.jwt.verify(token);
    } catch (err) {
      return reply.status(401).send({ error: "Invalid token" });
    }
    if (IS_PROD && !decoded?.sse) {
      return reply.status(401).send({ error: "SSE token required" });
    }

    if (
      !["SUPER_ADMIN", "SCHOOL_ADMIN", "TEACHER", "GUARD"].includes(
        decoded.role,
      )
    ) {
      return reply.status(403).send({ error: "Access denied" });
    }

    if (decoded.role !== "SUPER_ADMIN" && decoded.schoolId !== schoolId) {
      return reply.status(403).send({ error: "Access denied" });
    }

    let allowedClassIds: string[] | null = null;
    if (decoded.role === "TEACHER") {
      allowedClassIds = await accessService.getTeacherAllowedClassIds(decoded.sub);
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("X-Accel-Buffering", "no");

    trackConnection(schoolId, "connect");
    console.log(
      `[SSE] New connection - School events: ${schoolId}, Role: ${decoded.role}`,
    );

    reply.raw.write(`data: ${JSON.stringify({
      type: "connected",
      schoolId,
      serverTime: new Date().toISOString(),
    })}\n\n`);

    const eventHandler = (payload: AttendanceEventPayload) => {
      if (payload.schoolId === schoolId) {
        if (allowedClassIds) {
          const classId = payload.event.student?.classId;
          if (!classId || !allowedClassIds.includes(classId)) {
            return;
          }
        }
        try {
          reply.raw.write(
            `data: ${JSON.stringify({ type: "attendance", ...payload })}\n\n`,
          );
        } catch (err) {
          // Connection might be closed
        }
      }
    };

    attendanceEmitter.on("attendance", eventHandler);

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
      } catch (err) {
        clearInterval(heartbeat);
      }
    }, 30000);

    request.raw.on("close", () => {
      console.log(
        `[SSE] Connection closed - School events: ${schoolId}, Role: ${decoded.role}`,
      );
      trackConnection(schoolId, "disconnect");
      attendanceEmitter.off("attendance", eventHandler);
      clearInterval(heartbeat);
    });

    await new Promise(() => {});
  });
}

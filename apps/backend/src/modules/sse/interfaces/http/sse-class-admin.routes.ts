import { FastifyInstance } from "fastify";
import { createSseAccessService } from "../../application/sse-access.service";
import { createSsePrismaRepository } from "../../infrastructure/sse.prisma-repository";
import {
  AdminEventPayload,
  AttendanceEventPayload,
  SseHttpDeps,
} from "./sse.routes.deps";

export function registerClassAndAdminEventStreamRoutes(
  fastify: FastifyInstance,
  deps: SseHttpDeps,
) {
  const {
    attendanceEmitter,
    adminEmitter,
    trackConnection,
    getConnectionStats,
    onAdminSnapshot,
    prisma,
    IS_PROD,
  } = deps;
  const accessService = createSseAccessService(createSsePrismaRepository(prisma));

  fastify.get(
    "/schools/:schoolId/classes/:classId/events/stream",
    async (request: any, reply) => {
      const { schoolId, classId } = request.params;
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

      const classAllowed = await accessService.ensureClassInSchool(classId, schoolId);
      if (!classAllowed) {
        return reply.status(404).send({ error: "not found" });
      }

      if (decoded.role === "TEACHER") {
        const assigned = await accessService.ensureTeacherAssignment(
          decoded.sub,
          classId,
        );
        if (!assigned) {
          return reply.status(403).send({ error: "Access denied" });
        }
      }

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("Access-Control-Allow-Origin", "*");
      reply.raw.setHeader("X-Accel-Buffering", "no");

      trackConnection(`${schoolId}:${classId}`, "connect");
      console.log(
        `[SSE] New connection - Class events: ${schoolId}/${classId}, Role: ${decoded.role}`,
      );

      reply.raw.write(`data: ${JSON.stringify({
        type: "connected",
        schoolId,
        classId,
        serverTime: new Date().toISOString(),
      })}\n\n`);

      const eventHandler = (payload: AttendanceEventPayload) => {
        if (payload.schoolId === schoolId) {
          const eventClassId = payload.event.student?.classId;
          if (eventClassId !== classId) return;
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
        trackConnection(`${schoolId}:${classId}`, "disconnect");
        attendanceEmitter.off("attendance", eventHandler);
        clearInterval(heartbeat);
      });

      await new Promise(() => {});
    },
  );

  fastify.get("/admin/events/stream", async (request: any, reply) => {
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

    if (decoded.role !== "SUPER_ADMIN") {
      return reply.status(403).send({ error: "Access denied" });
    }

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("X-Accel-Buffering", "no");

    trackConnection("admin", "connect");
    console.log(
      `[SSE] New connection - Admin dashboard: ${decoded.email || decoded.sub}`,
    );

    reply.raw.write(`data: ${JSON.stringify({
      type: "connected",
      role: "admin",
      serverTime: new Date().toISOString(),
      connectionStats: getConnectionStats(),
    })}\n\n`);

    const adminEventHandler = (payload: AdminEventPayload) => {
      try {
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (err) {
        // Connection might be closed
      }
    };

    const attendanceHandler = (payload: AttendanceEventPayload) => {
      try {
        reply.raw.write(`data: ${JSON.stringify({
          type: "attendance_event",
          ...payload,
        })}\n\n`);
      } catch (err) {
        // Connection might be closed
      }
    };

    adminEmitter.on("admin_update", adminEventHandler);
    attendanceEmitter.on("attendance", attendanceHandler);

    const snapshotUnsubscribe = onAdminSnapshot((snapshot) => {
      try {
        reply.raw.write(
          `data: ${JSON.stringify({
            type: "school_stats_update",
            schoolId: snapshot.schoolId,
            scope: snapshot.scope,
            data: {
              totalStudents: snapshot.stats.totalStudents,
              presentToday: snapshot.stats.present,
              lateToday: snapshot.stats.late,
              absentToday: snapshot.stats.absent,
              excusedToday: snapshot.stats.excused,
              pendingEarlyCount: snapshot.stats.pendingEarly,
              latePendingCount: snapshot.stats.pendingLate,
              currentlyInSchool: snapshot.stats.currentlyInSchool,
            },
          })}\n\n`,
        );
      } catch (err) {
        // Connection might be closed
      }
    });

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
      } catch (err) {
        clearInterval(heartbeat);
      }
    }, 30000);

    const statsInterval = setInterval(() => {
      try {
        reply.raw.write(`data: ${JSON.stringify({
          type: "connection_stats",
          stats: getConnectionStats(),
        })}\n\n`);
      } catch (err) {
        clearInterval(statsInterval);
      }
    }, 60000);

    request.raw.on("close", () => {
      console.log(
        `[SSE] Connection closed - Admin dashboard: ${decoded.email || decoded.sub}`,
      );
      trackConnection("admin", "disconnect");
      adminEmitter.off("admin_update", adminEventHandler);
      attendanceEmitter.off("attendance", attendanceHandler);
      snapshotUnsubscribe();
      clearInterval(heartbeat);
      clearInterval(statsInterval);
    });

    await new Promise(() => {});
  });
}

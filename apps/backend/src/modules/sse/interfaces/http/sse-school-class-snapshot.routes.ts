import { FastifyInstance } from "fastify";
import { createSseAccessService } from "../../application/sse-access.service";
import { createSsePrismaRepository } from "../../infrastructure/sse.prisma-repository";
import { SseHttpDeps } from "./sse.routes.deps";

export function registerSchoolAndClassSnapshotStreamRoutes(
  fastify: FastifyInstance,
  deps: SseHttpDeps,
) {
  const {
    trackConnection,
    onClassSnapshot,
    onSchoolSnapshot,
    computeClassSnapshot,
    computeSchoolSnapshot,
    prisma,
    IS_PROD,
  } = deps;
  const accessService = createSseAccessService(createSsePrismaRepository(prisma));

  fastify.get(
    "/schools/:schoolId/snapshots/stream",
    async (request: any, reply) => {
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

      if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "GUARD"].includes(decoded.role)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      if (decoded.role !== "SUPER_ADMIN" && decoded.schoolId !== schoolId) {
        return reply.status(403).send({ error: "Access denied" });
      }

      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("Access-Control-Allow-Origin", "*");
      reply.raw.setHeader("X-Accel-Buffering", "no");

      trackConnection(schoolId, "connect");
      console.log(
        `[SSE] New connection - School snapshot: ${schoolId}, Role: ${decoded.role}`,
      );

      reply.raw.write(
        `data: ${JSON.stringify({
          type: "connected",
          schoolId,
          serverTime: new Date().toISOString(),
        })}\n\n`,
      );

      const [initialStarted, initialActive] = await Promise.all([
        computeSchoolSnapshot(schoolId, "started", { includeWeekly: true }),
        computeSchoolSnapshot(schoolId, "active", { includeWeekly: true }),
      ]);

      if (initialStarted) {
        reply.raw.write(`data: ${JSON.stringify(initialStarted)}\n\n`);
      }
      if (initialActive) {
        reply.raw.write(`data: ${JSON.stringify(initialActive)}\n\n`);
      }

      const unsubscribe = onSchoolSnapshot(schoolId, (snapshot) => {
        try {
          reply.raw.write(`data: ${JSON.stringify(snapshot)}\n\n`);
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

      request.raw.on("close", () => {
        console.log(
          `[SSE] Connection closed - School snapshot: ${schoolId}, Role: ${decoded.role}`,
        );
        trackConnection(schoolId, "disconnect");
        unsubscribe();
        clearInterval(heartbeat);
      });

      await new Promise(() => {});
    },
  );

  fastify.get(
    "/schools/:schoolId/classes/:classId/snapshots/stream",
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

      trackConnection(`${schoolId}:${classId}:snapshot`, "connect");

      reply.raw.write(
        `data: ${JSON.stringify({
          type: "connected",
          schoolId,
          classId,
          serverTime: new Date().toISOString(),
        })}\n\n`,
      );

      const [initialStarted, initialActive] = await Promise.all([
        computeClassSnapshot(schoolId, classId, "started", {
          includeWeekly: true,
        }),
        computeClassSnapshot(schoolId, classId, "active", {
          includeWeekly: true,
        }),
      ]);

      if (initialStarted) {
        reply.raw.write(`data: ${JSON.stringify(initialStarted)}\n\n`);
      }
      if (initialActive) {
        reply.raw.write(`data: ${JSON.stringify(initialActive)}\n\n`);
      }

      const unsubscribe = onClassSnapshot(schoolId, classId, (snapshot) => {
        try {
          reply.raw.write(`data: ${JSON.stringify(snapshot)}\n\n`);
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

      request.raw.on("close", () => {
        trackConnection(`${schoolId}:${classId}:snapshot`, "disconnect");
        unsubscribe();
        clearInterval(heartbeat);
      });

      await new Promise(() => {});
    },
  );
}

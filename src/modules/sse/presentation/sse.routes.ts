import { FastifyInstance } from 'fastify';
import { 
  attendanceEmitter, 
  adminEmitter,
  AttendanceEventPayload, 
  AdminEventPayload,
  trackConnection,
  getConnectionStats 
} from "../../../eventEmitter";
import {
  onAdminSnapshot,
  onClassSnapshot,
  onSchoolSnapshot,
} from "../../../realtime/snapshotBus";
import {
  computeClassSnapshot,
  computeSchoolSnapshot,
} from "../../../realtime/snapshot.service";
import prisma from "../../../prisma";
import { IS_PROD } from "../../../config";

export default async function (fastify: FastifyInstance) {
  // SSE endpoint for real-time attendance events (School Admin)
  // Note: EventSource doesn't support custom headers, so we accept token via query param
  fastify.get(
    '/schools/:schoolId/events/stream',
    async (request: any, reply) => {
      const { schoolId } = request.params;
      const { token } = request.query;

      // Verify JWT token from query param
      if (!token) {
        return reply.status(401).send({ error: 'Missing token' });
      }

      let decoded: any;
      try {
        decoded = await fastify.jwt.verify(token);
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      if (IS_PROD && !decoded?.sse) {
        return reply.status(401).send({ error: "SSE token required" });
      }

      if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'GUARD'].includes(decoded.role)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (decoded.role !== 'SUPER_ADMIN' && decoded.schoolId !== schoolId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      let allowedClassIds: string[] | null = null;
      if (decoded.role === 'TEACHER') {
        const rows = await prisma.teacherClass.findMany({
          where: { teacherId: decoded.sub },
          select: { classId: true },
        });
        allowedClassIds = rows.map((r) => r.classId);
      }

      // Set SSE headers with optimized settings for high-load
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      reply.raw.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

      // Track connection
      trackConnection(schoolId, 'connect');
      console.log(`[SSE] New connection - School events: ${schoolId}, Role: ${decoded.role}`);

      // Send initial connection message with stats
      reply.raw.write(`data: ${JSON.stringify({ 
        type: 'connected', 
        schoolId,
        serverTime: new Date().toISOString()
      })}\n\n`);

      // Handler for attendance events - optimized with try-catch
      const eventHandler = (payload: AttendanceEventPayload) => {
        if (payload.schoolId === schoolId) {
          if (allowedClassIds) {
            const classId = payload.event.student?.classId;
            if (!classId || !allowedClassIds.includes(classId)) {
              return;
            }
          }
          try {
            reply.raw.write(`data: ${JSON.stringify({ type: 'attendance', ...payload })}\n\n`);
          } catch (err) {
            // Connection might be closed, cleanup will handle it
          }
        }
      };

      // Subscribe to events
      attendanceEmitter.on('attendance', eventHandler);

      // Heartbeat every 30 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
        } catch (err) {
          // Connection closed
          clearInterval(heartbeat);
        }
      }, 30000);

      // Cleanup on disconnect
      request.raw.on('close', () => {
        console.log(`[SSE] Connection closed - School events: ${schoolId}, Role: ${decoded.role}`);
        trackConnection(schoolId, 'disconnect');
        attendanceEmitter.off('attendance', eventHandler);
        clearInterval(heartbeat);
      });

      // Keep connection open (don't call reply.send())
      await new Promise(() => {});
    }
  );

  // SSE endpoint for aggregated school snapshots
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
      console.log(`[SSE] New connection - School snapshot: ${schoolId}, Role: ${decoded.role}`);

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
        console.log(`[SSE] Connection closed - School snapshot: ${schoolId}, Role: ${decoded.role}`);
        trackConnection(schoolId, "disconnect");
        unsubscribe();
        clearInterval(heartbeat);
      });

      await new Promise(() => {});
    },
  );

  // SSE endpoint for class-level aggregated snapshots
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

      const cls = await prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (!cls || cls.schoolId !== schoolId) {
        return reply.status(404).send({ error: "not found" });
      }

      if (decoded.role === "TEACHER") {
        const assigned = await prisma.teacherClass.findUnique({
          where: {
            teacherId_classId: { teacherId: decoded.sub, classId },
          } as any,
          select: { classId: true },
        });
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

  // SSE endpoint for class-specific attendance events
  fastify.get(
    '/schools/:schoolId/classes/:classId/events/stream',
    async (request: any, reply) => {
      const { schoolId, classId } = request.params;
      const { token } = request.query;

      if (!token) {
        return reply.status(401).send({ error: 'Missing token' });
      }

      let decoded: any;
      try {
        decoded = await fastify.jwt.verify(token);
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      if (IS_PROD && !decoded?.sse) {
        return reply.status(401).send({ error: "SSE token required" });
      }

      if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'TEACHER', 'GUARD'].includes(decoded.role)) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      if (decoded.role !== 'SUPER_ADMIN' && decoded.schoolId !== schoolId) {
        return reply.status(403).send({ error: 'Access denied' });
      }

      const cls = await prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (!cls || cls.schoolId !== schoolId) {
        return reply.status(404).send({ error: 'not found' });
      }

      if (decoded.role === 'TEACHER') {
        const assigned = await prisma.teacherClass.findUnique({
          where: { teacherId_classId: { teacherId: decoded.sub, classId } } as any,
          select: { classId: true },
        });
        if (!assigned) {
          return reply.status(403).send({ error: 'Access denied' });
        }
      }

      // Set SSE headers with optimized settings for high-load
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      reply.raw.setHeader('X-Accel-Buffering', 'no');

      // Track connection
      trackConnection(`${schoolId}:${classId}`, 'connect');
      console.log(`[SSE] New connection - Class events: ${schoolId}/${classId}, Role: ${decoded.role}`);

      // Send initial connection message
      reply.raw.write(`data: ${JSON.stringify({ 
        type: 'connected', 
        schoolId,
        classId,
        serverTime: new Date().toISOString()
      })}\n\n`);

      const eventHandler = (payload: AttendanceEventPayload) => {
        if (payload.schoolId === schoolId) {
          const eventClassId = payload.event.student?.classId;
          if (eventClassId !== classId) return;
          try {
            reply.raw.write(`data: ${JSON.stringify({ type: 'attendance', ...payload })}\n\n`);
          } catch (err) {
            // Connection might be closed, cleanup will handle it
          }
        }
      };

      attendanceEmitter.on('attendance', eventHandler);

      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
        } catch (err) {
          clearInterval(heartbeat);
        }
      }, 30000);

      request.raw.on('close', () => {
        trackConnection(`${schoolId}:${classId}`, 'disconnect');
        attendanceEmitter.off('attendance', eventHandler);
        clearInterval(heartbeat);
      });

      await new Promise(() => {});
    }
  );

  // SSE endpoint for SuperAdmin - receives events from ALL schools
  fastify.get(
    '/admin/events/stream',
    async (request: any, reply) => {
      const { token } = request.query;

      // Verify JWT token
      if (!token) {
        return reply.status(401).send({ error: 'Missing token' });
      }

      let decoded: any;
      try {
        decoded = await fastify.jwt.verify(token);
      } catch (err) {
        return reply.status(401).send({ error: 'Invalid token' });
      }
      if (IS_PROD && !decoded?.sse) {
        return reply.status(401).send({ error: "SSE token required" });
      }

      // Only SUPER_ADMIN can access this endpoint
      if (decoded.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'Access denied' });
      }

      // Set SSE headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      reply.raw.setHeader('X-Accel-Buffering', 'no');

      // Track admin connection
      trackConnection('admin', 'connect');
      console.log(`[SSE] New connection - Admin dashboard: ${decoded.email || decoded.sub}`);

      // Send initial connection message
      reply.raw.write(`data: ${JSON.stringify({ 
        type: 'connected', 
        role: 'admin',
        serverTime: new Date().toISOString(),
        connectionStats: getConnectionStats()
      })}\n\n`);

      // Handler for admin events
      const adminEventHandler = (payload: AdminEventPayload) => {
        try {
          reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
        } catch (err) {
          // Connection might be closed
        }
      };

      // Handler for all attendance events (for real-time feed)
      const attendanceHandler = (payload: AttendanceEventPayload) => {
        try {
          reply.raw.write(`data: ${JSON.stringify({ 
            type: 'attendance_event',
            ...payload 
          })}\n\n`);
        } catch (err) {
          // Connection might be closed
        }
      };

      // Subscribe to events
      adminEmitter.on('admin_update', adminEventHandler);
      attendanceEmitter.on('attendance', attendanceHandler);

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

      // Heartbeat every 30 seconds
      const heartbeat = setInterval(() => {
        try {
          reply.raw.write(`: heartbeat ${Date.now()}\n\n`);
        } catch (err) {
          clearInterval(heartbeat);
        }
      }, 30000);

      // Send connection stats every 60 seconds
      const statsInterval = setInterval(() => {
        try {
          reply.raw.write(`data: ${JSON.stringify({ 
            type: 'connection_stats',
            stats: getConnectionStats()
          })}\n\n`);
        } catch (err) {
          clearInterval(statsInterval);
        }
      }, 60000);

      // Cleanup on disconnect
      request.raw.on('close', () => {
        console.log(`[SSE] Connection closed - Admin dashboard: ${decoded.email || decoded.sub}`);
        trackConnection('admin', 'disconnect');
        adminEmitter.off('admin_update', adminEventHandler);
        attendanceEmitter.off('attendance', attendanceHandler);
        snapshotUnsubscribe();
        clearInterval(heartbeat);
        clearInterval(statsInterval);
      });

      // Keep connection open
      await new Promise(() => {});
    }
  );

  // Endpoint to get current connection stats (for monitoring)
  fastify.get(
    '/admin/connection-stats',
    { preHandler: [(fastify as any).authenticate] },
    async (request: any, reply) => {
      if (request.user.role !== 'SUPER_ADMIN') {
        return reply.status(403).send({ error: 'Access denied' });
      }
      return getConnectionStats();
    }
  );
}

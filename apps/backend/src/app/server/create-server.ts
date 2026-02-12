import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

import authRoutes from "../../routes/auth";
import webhookRoutes from "../../routes/webhook";
import schoolsRoutes from "../../routes/schools";
import classesRoutes from "../../routes/classes";
import studentsRoutes from "../../routes/students";
import devicesRoutes from "../../routes/devices";
import holidaysRoutes from "../../routes/holidays";
import attendanceRoutes from "../../routes/attendance";
import dashboardRoutes, { adminDashboardRoutes } from "../../routes/dashboard";
import sseRoutes from "../../routes/sse";
import usersRoutes from "../../routes/users";
import camerasRoutes from "../../routes/cameras";
import searchRoutes from "../../routes/search";
import { CORS_ORIGINS, IS_PROD, JWT_SECRET } from "../../config";

const DESKTOP_ALLOWED_ORIGINS = new Set([
  "tauri://localhost",
  "https://tauri.localhost",
  "http://tauri.localhost",
]);

export type CreateServerParams = {
  uploadsRoot: string;
};

export function createServer(params: CreateServerParams) {
  const server = Fastify({ logger: true });

  server.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    (request as any)._startedAt = Date.now();
  });

  server.addHook("onResponse", async (request, reply) => {
    const startedAt = (request as any)._startedAt || Date.now();
    const durationMs = Date.now() - startedAt;
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs,
      },
      "request.completed",
    );
  });

  server.register(helmet, {
    global: true,
    contentSecurityPolicy: IS_PROD ? undefined : false,
  });

  if (IS_PROD) {
    server.register(rateLimit, {
      max: 200,
      timeWindow: "1 minute",
      allowList: [],
    });
  }

  server.register(require("@fastify/cors"), {
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!IS_PROD) return cb(null, true);
      if (!origin) return cb(null, false);
      if (DESKTOP_ALLOWED_ORIGINS.has(origin)) return cb(null, true);
      if (CORS_ORIGINS.length === 0) return cb(null, false);
      return cb(null, CORS_ORIGINS.includes(origin));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "x-client-contract-version",
    ],
    exposedHeaders: ["Content-Disposition"],
    credentials: true,
    preflight: true,
  });

  server.register(multipart, {
    addToBody: true,
    // Excel with embedded images can get large; keep this reasonable.
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  server.register(fastifyJwt, { secret: JWT_SECRET });

  server.register(fastifyStatic, {
    root: params.uploadsRoot,
    prefix: "/uploads/",
  });

  // decorate request with auth verify
  server.decorate("authenticate", async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  // Register routes
  server.register(authRoutes, { prefix: "/auth" });
  server.register(webhookRoutes, { prefix: "/" });
  server.register(schoolsRoutes, { prefix: "/schools" });
  server.register(usersRoutes, { prefix: "/" });
  server.register(classesRoutes, { prefix: "/" });
  server.register(studentsRoutes, { prefix: "/" });
  server.register(devicesRoutes, { prefix: "/" });
  server.register(holidaysRoutes, { prefix: "/" });
  server.register(attendanceRoutes, { prefix: "/" });
  server.register(dashboardRoutes, { prefix: "/" });
  server.register(adminDashboardRoutes, { prefix: "/" });
  server.register(sseRoutes, { prefix: "/" });
  server.register(camerasRoutes, { prefix: "/" });
  server.register(searchRoutes, { prefix: "/" });

  return server;
}

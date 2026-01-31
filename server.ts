import Fastify from "fastify";
import fastifyJwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import path from "path";

import prisma from "./src/prisma";
import authRoutes from "./src/routes/auth";
import webhookRoutes from "./src/routes/webhook";
import schoolsRoutes from "./src/routes/schools";
import classesRoutes from "./src/routes/classes";
import studentsRoutes from "./src/routes/students";
import devicesRoutes from "./src/routes/devices";
import holidaysRoutes from "./src/routes/holidays";
import attendanceRoutes from "./src/routes/attendance";
import dashboardRoutes, { adminDashboardRoutes } from "./src/routes/dashboard";
import sseRoutes from "./src/routes/sse";
import usersRoutes from "./src/routes/users";
import camerasRoutes from "./src/routes/cameras";
import searchRoutes from "./src/routes/search";
import { registerJobs } from "./src/cron/jobs";
import { startSnapshotScheduler } from "./src/realtime/snapshotScheduler";
import { startMediaMtxAuto } from "./src/modules/cameras/services/mediamtx-runner.service";
import { CORS_ORIGINS, IS_PROD, JWT_SECRET, PORT } from "./src/config";

const server = Fastify({ logger: true });

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
    if (CORS_ORIGINS.length === 0) return cb(null, false);
    return cb(null, CORS_ORIGINS.includes(origin));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept"],
  exposedHeaders: ["Content-Disposition"],
  credentials: true,
  preflight: true,
});

server.register(multipart, {
  addToBody: true,
  limits: { fileSize: 5 * 1024 * 1024 },
});
server.register(fastifyJwt, { secret: JWT_SECRET });

server.register(fastifyStatic, {
  root: path.join(__dirname, "uploads"),
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

const start = async () => {
  try {
    await prisma.$connect();
    registerJobs(server);
    startSnapshotScheduler({ logger: server.log });

    // MediaMTX'ni avtomatik ishga tushirish (agar o'chirilmagan bo'lsa)
    if (process.env.MEDIAMTX_AUTO_START !== "false") {
      startMediaMtxAuto();
    }

    await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Server listening on ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

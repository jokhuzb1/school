import { FastifyInstance } from "fastify";
import { createAttendanceHttpDeps } from "./attendance.routes.deps";
import { registerAttendanceExportAndUpdateRoutes } from "./attendance-export-update.routes";
import { registerAttendanceTodayAndReportRoutes } from "./attendance-today-report.routes";
import { registerAttendanceUpsertRoutes } from "./attendance-upsert.routes";

export default async function (fastify: FastifyInstance) {
  const deps = createAttendanceHttpDeps();

  registerAttendanceTodayAndReportRoutes(fastify, deps);
  registerAttendanceExportAndUpdateRoutes(fastify, deps);
  registerAttendanceUpsertRoutes(fastify, deps);
}


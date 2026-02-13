import { FastifyInstance } from "fastify";
import { registerSseAdminStatsRoute } from "./sse-admin-stats.routes";
import { registerClassAndAdminEventStreamRoutes } from "./sse-class-admin.routes";
import { createSseHttpDeps } from "./sse.routes.deps";
import { registerSchoolAndClassSnapshotStreamRoutes } from "./sse-school-class-snapshot.routes";
import { registerSchoolEventStreamRoute } from "./sse-school-events.routes";

export default async function (fastify: FastifyInstance) {
  const deps = createSseHttpDeps();

  registerSchoolEventStreamRoute(fastify, deps);
  registerSchoolAndClassSnapshotStreamRoutes(fastify, deps);
  registerClassAndAdminEventStreamRoutes(fastify, deps);
  registerSseAdminStatsRoute(fastify, deps);
}

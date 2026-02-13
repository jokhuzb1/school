import { FastifyInstance } from "fastify";
import { registerAdminDashboardRoutes } from "./dashboard-admin.routes";
import { registerDashboardEventsRoutes } from "./dashboard-events.routes";
import { createDashboardHttpDeps } from "./dashboard.routes.deps";
import { registerSchoolDashboardRoutes } from "./dashboard-school.routes";

export async function adminDashboardRoutes(fastify: FastifyInstance) {
  const deps = createDashboardHttpDeps();
  registerAdminDashboardRoutes(fastify, deps);
}

export default async function (fastify: FastifyInstance) {
  const deps = createDashboardHttpDeps();
  registerSchoolDashboardRoutes(fastify, deps);
  registerDashboardEventsRoutes(fastify, deps);
}


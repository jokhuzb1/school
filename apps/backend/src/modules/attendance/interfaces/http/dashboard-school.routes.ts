import { FastifyInstance } from "fastify";
import { DashboardHttpDeps } from "./dashboard.routes.deps";
import { createSchoolDashboardHandler } from "./dashboard-school.handler";

export function registerSchoolDashboardRoutes(
  fastify: FastifyInstance,
  deps: DashboardHttpDeps,
) {
  fastify.get(
    "/schools/:schoolId/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    createSchoolDashboardHandler(deps),
  );
}


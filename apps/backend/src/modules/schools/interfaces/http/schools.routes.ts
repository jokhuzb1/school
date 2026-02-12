import { FastifyInstance } from "fastify";
import { registerSchoolDetailRoutes } from "./schools-detail.routes";
import { registerSchoolListAndCreateRoutes } from "./schools-list-create.routes";
import { createSchoolsHttpDeps } from "./schools.routes.deps";
import { registerSchoolWebhookRoutes } from "./schools-webhook.routes";

export default async function (fastify: FastifyInstance) {
  const deps = createSchoolsHttpDeps();

  registerSchoolListAndCreateRoutes(fastify, deps);
  registerSchoolDetailRoutes(fastify, deps);
  registerSchoolWebhookRoutes(fastify, deps);
}

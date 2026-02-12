import { FastifyInstance } from "fastify";
import { registerTeacherClassAssignmentRoutes } from "./users-teacher-class.routes";
import { registerUserAccountRoutes } from "./users-account.routes";
import { createUsersHttpDeps } from "./users.routes.deps";

export default async function (fastify: FastifyInstance) {
  const deps = createUsersHttpDeps();

  registerUserAccountRoutes(fastify, deps);
  registerTeacherClassAssignmentRoutes(fastify, deps);
}

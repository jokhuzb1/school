import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";
import { handleStudentsProvisionStartRequest } from "./students-provision-start.handler";

export function registerStudentsProvisionStartRoutes(
  fastify: FastifyInstance,
  deps: StudentsHttpDeps,
) {
  fastify.post("/schools/:schoolId/students/provision", async (request: any, reply) => {
    return handleStudentsProvisionStartRequest({
      fastify,
      request,
      reply,
      deps,
    });
  });
}


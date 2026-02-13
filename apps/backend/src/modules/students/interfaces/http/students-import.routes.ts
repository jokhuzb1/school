import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";
import { handleStudentsImportRequest } from "./students-import.handler";

export function registerStudentsImportRoutes(
  fastify: FastifyInstance,
  deps: StudentsHttpDeps,
) {
  fastify.post(
    "/schools/:schoolId/students/import",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      return handleStudentsImportRequest(request, reply, deps);
    },
  );
}


import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";
import { createStudentsDeviceImportCommitHandler } from "./students-device-import-commit.handler";

export function registerStudentsDeviceImportCommitRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  fastify.post(
    "/schools/:schoolId/device-import/commit",
    { preHandler: [(fastify as any).authenticate] } as any,
    createStudentsDeviceImportCommitHandler(deps),
  );
}


import { FastifyInstance } from "fastify";
import { registerStudentsDetailRoutes } from "./students-detail.routes";
import { registerStudentsDeviceCreateRoutes } from "./students-device-create.routes";
import { registerStudentsDeviceImportCommitRoutes } from "./students-device-import-commit.routes";
import { registerStudentsExportTemplateRoutes } from "./students-export-template.routes";
import { registerStudentsImportJobsRoutes } from "./students-import-jobs.routes";
import { registerStudentsImportRoutes } from "./students-import.routes";
import { registerStudentsListRoutes } from "./students-list.routes";
import { registerStudentsProvisioningFinalizeRoutes } from "./students-provisioning-finalize.routes";
import { registerStudentsProvisioningLogsPreviewRoutes } from "./students-provisioning-logs-preview.routes";
import { registerStudentsProvisionStartRoutes } from "./students-provision-start.routes";
import { registerStudentsProvisionStatusDeviceResultRoutes } from "./students-provision-status-device-result.routes";
import { createStudentsHttpDeps } from "./students.routes.deps";

export default async function (fastify: FastifyInstance) {
  const deps = createStudentsHttpDeps();

  registerStudentsListRoutes(fastify, deps);
  registerStudentsDeviceCreateRoutes(fastify, deps);
  registerStudentsExportTemplateRoutes(fastify, deps);
  registerStudentsImportRoutes(fastify, deps);
  registerStudentsDetailRoutes(fastify, deps);
  registerStudentsProvisionStartRoutes(fastify, deps);
  registerStudentsProvisionStatusDeviceResultRoutes(fastify, deps);
  registerStudentsProvisioningLogsPreviewRoutes(fastify, deps);
  registerStudentsDeviceImportCommitRoutes(fastify, deps);
  registerStudentsImportJobsRoutes(fastify, deps);
  registerStudentsProvisioningFinalizeRoutes(fastify, deps);
}


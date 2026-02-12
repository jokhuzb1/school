import { FastifyInstance } from "fastify";
import { registerCameraAreaRoutes } from "./cameras-area.routes";
import { createCamerasHttpDeps } from "./cameras.routes.deps";
import { registerCameraMediaMtxDeployRoutes } from "./cameras-mediamtx-deploy.routes";
import { registerCameraNvrCrudRoutes } from "./cameras-nvr-crud.routes";
import { registerCameraNvrHealthAndSyncRoutes } from "./cameras-nvr-health-sync.routes";
import { registerCameraNvrOnvifRoutes } from "./cameras-nvr-onvif.routes";
import { registerCameraReadAndStreamRoutes } from "./cameras-read-stream-config.routes";
import { registerCameraStreamToolsRoutes } from "./cameras-stream-tools.routes";
import { registerCameraWriteCrudRoutes } from "./cameras-write-crud.routes";

export default async function (fastify: FastifyInstance) {
  const deps = createCamerasHttpDeps();

  registerCameraNvrCrudRoutes(fastify, deps);
  registerCameraNvrHealthAndSyncRoutes(fastify, deps);
  registerCameraNvrOnvifRoutes(fastify, deps);
  registerCameraAreaRoutes(fastify, deps);
  registerCameraReadAndStreamRoutes(fastify, deps);
  registerCameraMediaMtxDeployRoutes(fastify, deps);
  registerCameraWriteCrudRoutes(fastify, deps);
  registerCameraStreamToolsRoutes(fastify, deps);
}


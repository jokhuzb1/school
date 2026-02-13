import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasNvrAuth,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function registerCameraAreaRoutes(
  fastify: FastifyInstance,
  deps: CamerasHttpDeps,
) {
  type NvrAuth = CamerasNvrAuth;
  type RtspVendor = CamerasRtspVendor;
  const { camerasRepo,
    requireCameraAreaSchoolScope,
    requireCameraSchoolScope,
    requireNvrSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    decryptSecret,
    encryptSecret,
    checkNvrHealth,
    probeTcp,
    sanitizeNvr,
    buildRtspUrl,
    fetchOnvifDeviceInfo,
    fetchOnvifProfiles,
    buildMediaMtxConfig,
    getWebrtcPath,
    maskRtspUrl,
    parseRtspUrl,
    MEDIAMTX_DEPLOY_ENABLED,
    MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS,
    ONVIF_CONCURRENCY,
    ONVIF_TIMEOUT_MS,
    WEBRTC_BASE_URL,
    ALLOWED_PROTOCOLS,
    ALLOWED_CAMERA_STATUS,
    badRequest,
    buildWebrtcUrl,
    deployMediaMtxConfig,
    isValidChannelNo,
    toNumber,
    isValidPort,
    isSafeHost,
    isSafeUser,
    isSafeRemotePath,
    isSafeLocalPath,
    isMaskedRtspUrl,
    isSafeRestartCommand,
    buildRtspUrlForCamera,
  } = deps;
  fastify.get(
    "/schools/:schoolId/camera-areas",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        return camerasRepo.cameraArea.findMany({
          where: { schoolId },
          include: { _count: { select: { cameras: true } } },
          orderBy: { createdAt: "desc" },
        });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/camera-areas",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { name, description, nvrId, externalId } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        if (!name) return reply.status(400).send({ error: "name required" });

        if (nvrId) {
          await requireNvrSchoolScope(user, nvrId);
        }

        return camerasRepo.cameraArea.create({
          data: {
            schoolId,
            name,
            description,
            nvrId,
            externalId,
          },
        });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/camera-areas/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const { name, description, nvrId, externalId } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        await requireCameraAreaSchoolScope(user, id);

        if (nvrId) {
          await requireNvrSchoolScope(user, nvrId);
        }

        return camerasRepo.cameraArea.update({
          where: { id },
          data: {
            name,
            description,
            nvrId,
            externalId,
          },
        });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/camera-areas/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        await requireCameraAreaSchoolScope(user, id);

        return camerasRepo.cameraArea.delete({ where: { id } });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Cameras
}


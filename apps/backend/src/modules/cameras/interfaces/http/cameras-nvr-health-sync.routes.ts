import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasNvrAuth,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function registerCameraNvrHealthAndSyncRoutes(
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
  fastify.post(
    "/nvrs/:id/test-connection",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        const nvr = await requireNvrSchoolScope(user, id);

        const health = await checkNvrHealth({
          host: nvr.host,
          httpPort: nvr.httpPort,
          onvifPort: nvr.onvifPort,
          rtspPort: nvr.rtspPort,
        });

        const okCount = [health.http, health.onvif, health.rtsp].filter(
          (p) => p.ok,
        ).length;
        const status =
          okCount === 0 ? "offline" : okCount === 3 ? "ok" : "partial";
        const errorSummary =
          status === "ok"
            ? null
            : `http:${health.http.ok} onvif:${health.onvif.ok} rtsp:${health.rtsp.ok}`;

        const updated = await camerasRepo.nvr.update({
          where: { id },
          data: {
            lastHealthCheckAt: new Date(),
            lastHealthStatus: status,
            lastHealthError: errorSummary,
          },
        });

        return { nvr: sanitizeNvr(updated), health, status };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/nvrs/:id/sync",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const { areas, cameras } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        const nvr = await requireNvrSchoolScope(user, id);

        if (
          (!areas || !Array.isArray(areas)) &&
          (!cameras || !Array.isArray(cameras))
        ) {
          return reply.status(400).send({ error: "areas or cameras required" });
        }

        const areaMap = new Map<string, string>();

        await camerasRepo.$transaction(async (tx) => {
          if (Array.isArray(areas)) {
            for (const area of areas) {
              const { name, description, externalId } = area || {};
              if (!name) {
                throw badRequest("area name required");
              }

              let saved;
              if (externalId) {
                saved = await tx.cameraArea.upsert({
                  where: {
                    nvrId_externalId: { nvrId: nvr.id, externalId },
                  },
                  update: { name, description },
                  create: {
                    schoolId: nvr.schoolId,
                    nvrId: nvr.id,
                    name,
                    description,
                    externalId,
                  },
                });
                areaMap.set(externalId, saved.id);
              } else {
                const existing = await tx.cameraArea.findFirst({
                  where: { nvrId: nvr.id, name },
                });
                if (existing) {
                  saved = await tx.cameraArea.update({
                    where: { id: existing.id },
                    data: { description },
                  });
                } else {
                  saved = await tx.cameraArea.create({
                    data: {
                      schoolId: nvr.schoolId,
                      nvrId: nvr.id,
                      name,
                      description,
                    },
                  });
                }
              }
            }
          }

          if (Array.isArray(cameras)) {
            for (const camera of cameras) {
              const {
                name,
                externalId,
                channelNo,
                streamUrl,
                status,
                isActive,
                areaId,
                areaExternalId,
              } = camera || {};

              if (!name) {
                throw badRequest("camera name required");
              }

              if (status && !ALLOWED_CAMERA_STATUS.has(status)) {
                throw badRequest("invalid camera status");
              }

              const resolvedAreaId =
                areaId ||
                (areaExternalId ? areaMap.get(areaExternalId) : undefined);

              if (externalId) {
                await tx.camera.upsert({
                  where: { nvrId_externalId: { nvrId: nvr.id, externalId } },
                  update: {
                    name,
                    channelNo:
                      channelNo !== undefined ? toNumber(channelNo) : undefined,
                    streamUrl,
                    status,
                    isActive,
                    areaId: resolvedAreaId ?? null,
                  },
                  create: {
                    schoolId: nvr.schoolId,
                    nvrId: nvr.id,
                    name,
                    externalId,
                    channelNo:
                      channelNo !== undefined ? toNumber(channelNo) : undefined,
                    streamUrl,
                    status,
                    isActive: isActive ?? true,
                    areaId: resolvedAreaId ?? null,
                  },
                });
              } else if (
                channelNo !== undefined &&
                isValidChannelNo(channelNo)
              ) {
                await tx.camera.upsert({
                  where: {
                    nvrId_channelNo: {
                      nvrId: nvr.id,
                      channelNo: toNumber(channelNo)!,
                    },
                  },
                  update: {
                    name,
                    streamUrl,
                    status,
                    isActive,
                    areaId: resolvedAreaId ?? null,
                  },
                  create: {
                    schoolId: nvr.schoolId,
                    nvrId: nvr.id,
                    name,
                    channelNo: toNumber(channelNo),
                    streamUrl,
                    status,
                    isActive: isActive ?? true,
                    areaId: resolvedAreaId ?? null,
                  },
                });
              } else {
                throw badRequest("camera externalId or channelNo required");
              }
            }
          }
        });

        const updated = await camerasRepo.nvr.update({
          where: { id },
          data: {
            lastSyncAt: new Date(),
            lastSyncStatus: "ok",
            lastSyncError: null,
          },
        });

        return { nvr: sanitizeNvr(updated), status: "ok" };
      } catch (err: any) {
        const { id } = request.params as any;
        try {
          await camerasRepo.nvr.update({
            where: { id },
            data: {
              lastSyncAt: new Date(),
              lastSyncStatus: "error",
              lastSyncError: err?.message || "sync error",
            },
          });
        } catch {
          // ignore secondary error
        }
        return sendHttpError(reply, err);
      }
    },
  );

}


import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasNvrAuth,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function registerCameraNvrOnvifRoutes(
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
    "/nvrs/:id/onvif-sync",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const { overwriteNames, disableMissing = true } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        const nvr = await requireNvrSchoolScope(user, id);
        const password = decryptSecret(nvr.passwordEncrypted);

        const deviceInfo = await fetchOnvifDeviceInfo({
          host: nvr.host,
          onvifPort: nvr.onvifPort,
          username: nvr.username,
          password,
          timeoutMs: ONVIF_TIMEOUT_MS,
        });

        const { streams } = await fetchOnvifProfiles({
          host: nvr.host,
          onvifPort: nvr.onvifPort,
          username: nvr.username,
          password,
          timeoutMs: ONVIF_TIMEOUT_MS,
          concurrency: ONVIF_CONCURRENCY,
        });

        let created = 0;
        let updated = 0;
        const tokens = streams.map((s) => s.profile.token);

        await camerasRepo.$transaction(async (tx) => {
          for (const item of streams) {
            const token = item.profile.token;
            const name = item.profile.name || token;
            const streamUrl = item.uri || undefined;
            const channelNo = item.channelNo || undefined;

            const existing = await tx.camera.findUnique({
              where: { nvrId_externalId: { nvrId: nvr.id, externalId: token } },
            });

            if (existing) {
              const data: any = {
                streamUrl,
                channelNo,
                status: "ONLINE",
              };
              if (overwriteNames && name) {
                data.name = name;
              }
              await tx.camera.update({ where: { id: existing.id }, data });
              updated++;
              continue;
            }

            await tx.camera.create({
              data: {
                schoolId: nvr.schoolId,
                nvrId: nvr.id,
                name,
                externalId: token,
                channelNo,
                streamUrl,
                status: "ONLINE",
                isActive: true,
              },
            });
            created++;
          }

          if (disableMissing && tokens.length > 0) {
            await tx.camera.updateMany({
              where: {
                nvrId: nvr.id,
                externalId: { notIn: tokens },
                NOT: { externalId: null },
              },
              data: { isActive: false, status: "OFFLINE" },
            });
          }
        });

        const updatedNvr = await camerasRepo.nvr.update({
          where: { id },
          data: {
            vendor: deviceInfo.manufacturer || nvr.vendor,
            model: deviceInfo.model || nvr.model,
            lastSyncAt: new Date(),
            lastSyncStatus: "ok",
            lastSyncError: null,
          },
        });

        return {
          nvr: sanitizeNvr(updatedNvr),
          stats: { created, updated, total: streams.length },
        };
      } catch (err: any) {
        const { id } = request.params as any;
        try {
          await camerasRepo.nvr.update({
            where: { id },
            data: {
              lastSyncAt: new Date(),
              lastSyncStatus: "error",
              lastSyncError: err?.message || "onvif sync error",
            },
          });
        } catch {
          // ignore
        }
        return sendHttpError(reply, err);
      }
    },
  );

  // Camera Areas
}


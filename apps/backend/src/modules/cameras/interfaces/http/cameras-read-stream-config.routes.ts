import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasNvrAuth,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function registerCameraReadAndStreamRoutes(
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
    "/schools/:schoolId/cameras",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { areaId, nvrId } = request.query as any;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const canViewRtsp =
          user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN";
        const cameras = await camerasRepo.camera.findMany({
          where: {
            schoolId,
            areaId: areaId || undefined,
            nvrId: nvrId || undefined,
          },
          orderBy: { createdAt: "desc" },
        });
        if (canViewRtsp) {
          return cameras.map((camera) => ({
            ...camera,
            streamUrl: camera.streamUrl ? maskRtspUrl(camera.streamUrl) : null,
          }));
        }
        return cameras.map((camera) => ({ ...camera, streamUrl: null }));
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/cameras/:id/stream",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const { includeRtspPassword } = request.query as any;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        const camera = await requireCameraSchoolScope(user, id);

        const canViewRtsp =
          user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN";
        const canViewRtspPassword = user?.role === "SUPER_ADMIN";
        let rtspUrlRaw: string | null = null;
        let rtspSource: string | null = null;

        if (canViewRtsp) {
          const nvr = camera.nvrId
            ? await requireNvrSchoolScope(user, camera.nvrId)
            : null;
          const built = buildRtspUrlForCamera({ camera, nvr });
          rtspUrlRaw = built.rtspUrl;
          rtspSource = built.rtspSource;
        }

        const webrtcPath = getWebrtcPath({
          schoolId: camera.schoolId,
          cameraId: camera.id,
          externalId: camera.externalId,
        });
        const webrtcUrl = buildWebrtcUrl(webrtcPath);

        // Codec detection based on stream profile
        const streamProfile =
          (camera.streamProfile as "main" | "sub") || "main";
        const isH265 = streamProfile === "main";
        const recommendedPlayer = isH265 ? "hls" : "webrtc";

        // HLS URL for H.265 streams - frontend builds this dynamically
        const hlsUrl = null;

        const includePassword =
          includeRtspPassword === "1" ||
          includeRtspPassword === "true" ||
          includeRtspPassword === true;
        const rtspUrl =
          canViewRtspPassword && includePassword ? rtspUrlRaw : maskRtspUrl(rtspUrlRaw || "");

        return {
          cameraId: camera.id,
          webrtcUrl,
          webrtcPath,
          rtspUrl: rtspUrlRaw ? rtspUrl : null,
          rtspUrlRaw:
            canViewRtspPassword && includePassword ? rtspUrlRaw : null,
          rtspSource,
          hlsUrl,
          streamProfile,
          codec: isH265 ? "H.265 (HEVC)" : "H.264 (AVC)",
          isH265,
          recommendedPlayer,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/nvrs/:id/mediamtx-config",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        const nvr = await requireNvrSchoolScope(user, id);
        const password = decryptSecret(nvr.passwordEncrypted);

        const cameras = await camerasRepo.camera.findMany({
          where: { nvrId: nvr.id, isActive: true },
          orderBy: { channelNo: "asc" },
        });
        const nvrAuthById = new Map<string, NvrAuth>([
          [
            nvr.id,
            {
              id: nvr.id,
              host: nvr.host,
              rtspPort: nvr.rtspPort,
              username: nvr.username,
              password,
              vendor: nvr.vendor,
            },
          ],
        ]);
        const content = buildMediaMtxConfig({ cameras, nvrAuthById });
        const filename = `mediamtx_${nvr.id}.yml`;
        reply
          .header("Content-Type", "text/yaml; charset=utf-8")
          .header("Content-Disposition", `attachment; filename=\"${filename}\"`)
          .send(content);

        return;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/mediamtx-config",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const nvrs = await camerasRepo.nvr.findMany({ where: { schoolId } });
        const nvrAuthById = new Map<string, NvrAuth>();
        nvrs.forEach((nvr) => {
          const password = decryptSecret(nvr.passwordEncrypted);
          nvrAuthById.set(nvr.id, {
            id: nvr.id,
            host: nvr.host,
            rtspPort: nvr.rtspPort,
            username: nvr.username,
            password,
            vendor: nvr.vendor,
          });
        });

        const cameras = await camerasRepo.camera.findMany({
          where: { schoolId, isActive: true },
          orderBy: { channelNo: "asc" },
        });

        const content = buildMediaMtxConfig({ cameras, nvrAuthById });
        const filename = `mediamtx_school_${schoolId}.yml`;
        reply
          .header("Content-Type", "text/yaml; charset=utf-8")
          .header("Content-Disposition", `attachment; filename=\"${filename}\"`)
          .send(content);

        return;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

}


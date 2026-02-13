import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function registerCameraStreamToolsRoutes(
  fastify: FastifyInstance,
  deps: CamerasHttpDeps,
) {
  type RtspVendor = CamerasRtspVendor;
  const { camerasRepo,
    requireCameraSchoolScope,
    requireNvrSchoolScope,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    decryptSecret,
    buildRtspUrl,
    probeTcp,
    maskRtspUrl,
    parseRtspUrl,
    buildRtspUrlForCamera,
  } = deps;

  fastify.post(
    "/cameras/:id/test-stream",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        const camera = await requireCameraSchoolScope(user, id);

        const nvr = camera.nvrId
          ? await requireNvrSchoolScope(user, camera.nvrId)
          : null;
        const built = buildRtspUrlForCamera({ camera, nvr });
        const rtspUrl = built.rtspUrl;

        if (!rtspUrl) {
          return reply.status(400).send({
            success: false,
            error: "No RTSP URL configured",
          });
        }

        let host: string;
        let port: number;
        try {
          const parsed = parseRtspUrl(rtspUrl);
          host = parsed.host;
          port = parsed.port;
        } catch (err) {
          return reply.status(400).send({
            success: false,
            error: err instanceof Error ? err.message : "Invalid RTSP URL",
          });
        }

        // TCP probe
        const probe = await probeTcp(host, port, 3000);

        return {
          success: probe.ok,
          rtspUrl: maskRtspUrl(rtspUrl),
          host,
          port,
          streamProfile: camera.streamProfile || "main",
          message: probe.ok
            ? "RTSP server javob berdi"
            : "RTSP serverga ulanib bo'lmadi",
          latencyMs: probe.latencyMs,
          error: probe.error,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Generate RTSP URL preview (without saving)
  fastify.post(
    "/schools/:schoolId/preview-rtsp-url",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { nvrId, channelNo, streamProfile } = request.body as any;
        const { includeRtspPassword } = request.query as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        if (!nvrId || !channelNo) {
          return reply
            .status(400)
            .send({ error: "nvrId and channelNo required" });
        }

        const nvr = await camerasRepo.nvr.findUnique({ where: { id: nvrId } });
        if (!nvr) {
          return reply.status(404).send({ error: "NVR not found" });
        }

        const password = decryptSecret(nvr.passwordEncrypted);
        const vendor = (nvr.vendor?.toLowerCase() || "hikvision") as RtspVendor;
        const profile = streamProfile || "main";

        const rtspUrl = buildRtspUrl({
          nvr: {
            host: nvr.host,
            rtspPort: nvr.rtspPort,
            username: nvr.username,
            password,
          },
          channelNo: parseInt(channelNo, 10),
          profile,
          vendor,
        });

        const includePassword =
          includeRtspPassword === "1" ||
          includeRtspPassword === "true" ||
          includeRtspPassword === true;
        const rtspUrlOut =
          user?.role === "SUPER_ADMIN" && includePassword
            ? rtspUrl
            : maskRtspUrl(rtspUrl);

        return {
          rtspUrl: rtspUrlOut,
          vendor,
          profile,
          host: nvr.host,
          port: nvr.rtspPort,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

}


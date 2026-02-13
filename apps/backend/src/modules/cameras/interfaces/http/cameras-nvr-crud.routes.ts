import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasNvrAuth,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function registerCameraNvrCrudRoutes(
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
    "/schools/:schoolId/nvrs",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const nvrs = await camerasRepo.nvr.findMany({
          where: { schoolId },
          orderBy: { createdAt: "desc" },
        });
        return nvrs.map((nvr) => sanitizeNvr(nvr));
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/nvrs",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const {
          name,
          vendor,
          model,
          host,
          httpPort,
          onvifPort,
          rtspPort,
          username,
          password,
          protocol,
          isActive,
        } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        if (!name || !host || !username || !password) {
          return reply
            .status(400)
            .send({ error: "name, host, username, password required" });
        }

        if (protocol && !ALLOWED_PROTOCOLS.has(protocol)) {
          return reply.status(400).send({ error: "invalid protocol" });
        }

        const httpPortNum =
          httpPort !== undefined ? toNumber(httpPort) : undefined;
        const onvifPortNum =
          onvifPort !== undefined ? toNumber(onvifPort) : undefined;
        const rtspPortNum =
          rtspPort !== undefined ? toNumber(rtspPort) : undefined;

        if (
          (httpPort !== undefined && !isValidPort(httpPort)) ||
          (onvifPort !== undefined && !isValidPort(onvifPort)) ||
          (rtspPort !== undefined && !isValidPort(rtspPort))
        ) {
          return reply.status(400).send({ error: "invalid port value" });
        }

        const nvr = await camerasRepo.nvr.create({
          data: {
            schoolId,
            name,
            vendor,
            model,
            host,
            httpPort: httpPortNum ?? undefined,
            onvifPort: onvifPortNum ?? undefined,
            rtspPort: rtspPortNum ?? undefined,
            username,
            passwordEncrypted: encryptSecret(String(password)),
            protocol: protocol ?? undefined,
            isActive: isActive ?? true,
          },
        });

        return sanitizeNvr(nvr);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/nvrs/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        const nvr = await requireNvrSchoolScope(user, id);

        return sanitizeNvr(nvr);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/nvrs/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const {
          name,
          vendor,
          model,
          host,
          httpPort,
          onvifPort,
          rtspPort,
          username,
          password,
          protocol,
          isActive,
        } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        await requireNvrSchoolScope(user, id);

        if (protocol && !ALLOWED_PROTOCOLS.has(protocol)) {
          return reply.status(400).send({ error: "invalid protocol" });
        }

        if (
          (httpPort !== undefined && !isValidPort(httpPort)) ||
          (onvifPort !== undefined && !isValidPort(onvifPort)) ||
          (rtspPort !== undefined && !isValidPort(rtspPort))
        ) {
          return reply.status(400).send({ error: "invalid port value" });
        }

        if (password !== undefined && String(password).length === 0) {
          return reply.status(400).send({ error: "password cannot be empty" });
        }

        const data: any = {
          name,
          vendor,
          model,
          host,
          httpPort: httpPort !== undefined ? toNumber(httpPort) : undefined,
          onvifPort: onvifPort !== undefined ? toNumber(onvifPort) : undefined,
          rtspPort: rtspPort !== undefined ? toNumber(rtspPort) : undefined,
          username,
          protocol: protocol ?? undefined,
          isActive,
        };

        if (password !== undefined) {
          data.passwordEncrypted = encryptSecret(String(password));
        }

        const nvr = await camerasRepo.nvr.update({ where: { id }, data });
        return sanitizeNvr(nvr);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/nvrs/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        await requireNvrSchoolScope(user, id);

        const deleted = await camerasRepo.nvr.delete({ where: { id } });
        return sanitizeNvr(deleted);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

}


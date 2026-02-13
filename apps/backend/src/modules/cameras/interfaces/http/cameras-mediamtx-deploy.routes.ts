import { FastifyInstance } from "fastify";
import {
  CamerasHttpDeps,
  CamerasNvrAuth,
  CamerasRtspVendor,
} from "./cameras.routes.deps";

export function registerCameraMediaMtxDeployRoutes(
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
    "/nvrs/:id/mediamtx-deploy",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        if (!MEDIAMTX_DEPLOY_ENABLED) {
          return reply.status(400).send({ error: "deploy disabled" });
        }

        const { id } = request.params;
        const user = request.user;
        const { mode, ssh, docker } = request.body as any;

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

        if (mode !== "ssh" && mode !== "docker" && mode !== "local") {
          return reply.status(400).send({ error: "invalid deploy mode" });
        }

        if (mode === "ssh") {
          if (!ssh?.host || !ssh?.user || !ssh?.remotePath) {
            return reply.status(400).send({ error: "ssh config required" });
          }
          if (!isSafeHost(ssh.host) || !isSafeUser(ssh.user)) {
            return reply.status(400).send({ error: "invalid ssh host/user" });
          }
          if (!isSafeRemotePath(ssh.remotePath)) {
            return reply.status(400).send({ error: "invalid remote path" });
          }
          if (ssh.port && !isValidPort(ssh.port)) {
            return reply.status(400).send({ error: "invalid ssh port" });
          }
          if (ssh.restartCommand && !MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS) {
            return reply
              .status(400)
              .send({ error: "ssh restartCommand disabled" });
          }
          if (ssh.restartCommand && !isSafeRestartCommand(ssh.restartCommand)) {
            return reply
              .status(400)
              .send({ error: "invalid ssh restartCommand" });
          }
        }

        if (mode === "docker") {
          if (!docker?.container || !docker?.configPath) {
            return reply.status(400).send({ error: "docker config required" });
          }
        }

        if (mode === "local") {
          if (!request.body?.local?.path) {
            return reply.status(400).send({ error: "local path required" });
          }
          if (!isSafeLocalPath(request.body.local.path)) {
            return reply.status(400).send({ error: "invalid local path" });
          }
          if (
            request.body?.local?.restartCommand &&
            !MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS
          ) {
            return reply
              .status(400)
              .send({ error: "local restartCommand disabled" });
          }
          if (
            request.body?.local?.restartCommand &&
            !isSafeRestartCommand(request.body.local.restartCommand)
          ) {
            return reply
              .status(400)
              .send({ error: "invalid local restartCommand" });
          }
        }

        const result = await deployMediaMtxConfig({
          content,
          mode,
          ssh,
          docker,
          local: request.body?.local,
        });

        return { status: "ok", result };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/mediamtx-deploy",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        if (!MEDIAMTX_DEPLOY_ENABLED) {
          return reply.status(400).send({ error: "deploy disabled" });
        }

        const { schoolId } = request.params;
        const user = request.user;
        const { mode, ssh, docker } = request.body as any;

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

        if (mode !== "ssh" && mode !== "docker" && mode !== "local") {
          return reply.status(400).send({ error: "invalid deploy mode" });
        }

        if (mode === "ssh") {
          if (!ssh?.host || !ssh?.user || !ssh?.remotePath) {
            return reply.status(400).send({ error: "ssh config required" });
          }
          if (!isSafeHost(ssh.host) || !isSafeUser(ssh.user)) {
            return reply.status(400).send({ error: "invalid ssh host/user" });
          }
          if (!isSafeRemotePath(ssh.remotePath)) {
            return reply.status(400).send({ error: "invalid remote path" });
          }
          if (ssh.port && !isValidPort(ssh.port)) {
            return reply.status(400).send({ error: "invalid ssh port" });
          }
          if (ssh.restartCommand && !MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS) {
            return reply
              .status(400)
              .send({ error: "ssh restartCommand disabled" });
          }
          if (ssh.restartCommand && !isSafeRestartCommand(ssh.restartCommand)) {
            return reply
              .status(400)
              .send({ error: "invalid ssh restartCommand" });
          }
        }

        if (mode === "docker") {
          if (!docker?.container || !docker?.configPath) {
            return reply.status(400).send({ error: "docker config required" });
          }
        }

        if (mode === "local") {
          if (!request.body?.local?.path) {
            return reply.status(400).send({ error: "local path required" });
          }
          if (!isSafeLocalPath(request.body.local.path)) {
            return reply.status(400).send({ error: "invalid local path" });
          }
          if (
            request.body?.local?.restartCommand &&
            !MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS
          ) {
            return reply
              .status(400)
              .send({ error: "local restartCommand disabled" });
          }
          if (
            request.body?.local?.restartCommand &&
            !isSafeRestartCommand(request.body.local.restartCommand)
          ) {
            return reply
              .status(400)
              .send({ error: "invalid local restartCommand" });
          }
        }

        const result = await deployMediaMtxConfig({
          content,
          mode,
          ssh,
          docker,
          local: request.body?.local,
        });

        return { status: "ok", result };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

}


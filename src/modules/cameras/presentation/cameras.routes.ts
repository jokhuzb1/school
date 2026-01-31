import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import {
  requireCameraAreaSchoolScope,
  requireCameraSchoolScope,
  requireNvrSchoolScope,
  requireRoles,
  requireSchoolScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import { decryptSecret, encryptSecret } from "../../../utils/crypto";
import { checkNvrHealth, sanitizeNvr } from "../services/nvr.service";
import {
  buildRtspUrl,
  buildHikvisionRtspUrl,
  RtspVendor,
} from "../services/rtsp.service";
import {
  fetchOnvifDeviceInfo,
  fetchOnvifProfiles,
} from "../services/onvif.service";
import {
  MEDIAMTX_DEPLOY_ENABLED,
  ONVIF_CONCURRENCY,
  ONVIF_TIMEOUT_MS,
  WEBRTC_BASE_URL,
} from "../../../config";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";

const ALLOWED_PROTOCOLS = new Set(["ONVIF", "RTSP", "HYBRID"]);
const ALLOWED_CAMERA_STATUS = new Set(["ONLINE", "OFFLINE", "UNKNOWN"]);

function badRequest(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildWebrtcUrl(path: string): string | null {
  if (!WEBRTC_BASE_URL) return null;
  const trimmed = WEBRTC_BASE_URL.replace(/\/+$/, "");
  // MediaMTX WHEP endpoint format: /{path}/whep
  return `${trimmed}/${path}/whep`;
}

function getWebrtcPath(params: {
  schoolId: string;
  cameraId: string;
  externalId?: string | null;
}) {
  const { schoolId, cameraId, externalId } = params;
  const safeExternal = externalId?.trim();
  if (safeExternal) {
    return `schools/${schoolId}/cameras/${sanitizePathSegment(safeExternal)}`;
  }
  return `schools/${schoolId}/cameras/${cameraId}`;
}

const runCommand = (
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr}`));
      }
    });
  });

type NvrAuth = {
  id: string;
  host: string;
  rtspPort: number;
  username: string;
  password: string;
  vendor: string | null;
};

const buildMediaMtxConfig = (params: {
  cameras: Array<{
    id: string;
    schoolId: string;
    externalId: string | null;
    streamUrl: string | null;
    streamProfile: string;
    autoGenerateUrl: boolean;
    channelNo: number | null;
    nvrId: string | null;
  }>;
  nvrAuthById: Map<string, NvrAuth>;
}) => {
  const { cameras, nvrAuthById } = params;
  const lines: string[] = [
    "# Auto-generated MediaMTX config",
    "logLevel: info",
    "hlsAllowOrigin: '*'",
    "webrtcAllowOrigin: '*'",
    "hlsAlwaysRemux: yes",
    "",
    "paths:",
  ];
  const usedPaths = new Set<string>();

  cameras.forEach((camera) => {
    const pathKey = getWebrtcPath({
      schoolId: camera.schoolId,
      cameraId: camera.id,
      externalId: camera.externalId,
    });
    if (usedPaths.has(pathKey)) return;

    let rtspUrl = camera.streamUrl || null;

    // Auto-generate URL from NVR if enabled and no manual URL
    if (
      camera.autoGenerateUrl &&
      !rtspUrl &&
      camera.nvrId &&
      camera.channelNo
    ) {
      const nvr = nvrAuthById.get(camera.nvrId);
      if (nvr) {
        // Detect vendor from NVR settings
        const vendor = (nvr.vendor?.toLowerCase() || "hikvision") as RtspVendor;
        rtspUrl = buildRtspUrl({
          nvr: {
            host: nvr.host,
            rtspPort: nvr.rtspPort,
            username: nvr.username,
            password: nvr.password,
          },
          channelNo: camera.channelNo,
          profile: (camera.streamProfile as "main" | "sub") || "main",
          vendor,
        });
      }
    }

    if (!rtspUrl) return;

    usedPaths.add(pathKey);
    const profileLabel = camera.streamProfile === "sub" ? "H.264" : "H.265";
    lines.push(`  # ${camera.id} (${profileLabel})`);
    lines.push(`  ${pathKey}:`);
    lines.push(`    source: ${rtspUrl}`);
    lines.push(`    rtspTransport: tcp`);
    lines.push(`    sourceOnDemand: yes`);
    lines.push(`    sourceOnDemandCloseAfter: 10s`);
  });

  return lines.join("\n");
};

const deployMediaMtxConfig = async (params: {
  content: string;
  mode: "ssh" | "docker" | "local";
  ssh?: {
    host: string;
    port?: number;
    user: string;
    remotePath: string;
    restartCommand?: string;
  };
  docker?: {
    container: string;
    configPath: string;
    restart?: boolean;
  };
  local?: {
    path: string;
    restartCommand?: string;
  };
}) => {
  const tempPath = path.join(
    os.tmpdir(),
    `mediamtx_${Date.now()}_${Math.random().toString(16).slice(2)}.yml`,
  );
  await fs.writeFile(tempPath, params.content, "utf8");

  try {
    if (params.mode === "local") {
      if (!params.local?.path) {
        throw new Error("local path required");
      }
      await fs.writeFile(params.local.path, params.content, "utf8");
      if (params.local.restartCommand) {
        await runCommand("cmd", ["/c", params.local.restartCommand]);
      }
      return { mode: "local" };
    }

    if (params.mode === "ssh") {
      if (!params.ssh) {
        throw new Error("ssh config required");
      }
      const port = params.ssh.port || 22;
      await runCommand("scp", [
        "-P",
        String(port),
        tempPath,
        `${params.ssh.user}@${params.ssh.host}:${params.ssh.remotePath}`,
      ]);
      if (params.ssh.restartCommand) {
        await runCommand("ssh", [
          "-p",
          String(port),
          `${params.ssh.user}@${params.ssh.host}`,
          params.ssh.restartCommand,
        ]);
      }
      return { mode: "ssh", port };
    }

    if (params.mode === "docker") {
      if (!params.docker) {
        throw new Error("docker config required");
      }
      await runCommand("docker", [
        "cp",
        tempPath,
        `${params.docker.container}:${params.docker.configPath}`,
      ]);
      if (params.docker.restart !== false) {
        await runCommand("docker", ["restart", params.docker.container]);
      }
      return { mode: "docker" };
    }

    throw new Error("invalid deploy mode");
  } finally {
    try {
      await fs.unlink(tempPath);
    } catch {
      // ignore
    }
  }
};

function isValidChannelNo(value: any): boolean {
  const num = toNumber(value);
  if (num === undefined) return false;
  return Number.isInteger(num) && num > 0;
}

function toNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.trunc(num);
}

function isValidPort(value: any): boolean {
  const num = toNumber(value);
  if (num === undefined) return false;
  return num > 0 && num <= 65535;
}

function isSafeHost(value: string): boolean {
  return /^[a-zA-Z0-9.-]+$/.test(value);
}

function isSafeUser(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

function isSafeRemotePath(value: string): boolean {
  return value.startsWith("/") && !value.includes("..") && !value.includes("~");
}

function isSafeLocalPath(value: string): boolean {
  if (!path.isAbsolute(value)) return false;
  if (value.includes("..")) return false;
  return true;
}

export default async function (fastify: FastifyInstance) {
  // NVR CRUD
  fastify.get(
    "/schools/:schoolId/nvrs",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const nvrs = await prisma.nvr.findMany({
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

        const nvr = await prisma.nvr.create({
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

        const nvr = await prisma.nvr.update({ where: { id }, data });
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

        const deleted = await prisma.nvr.delete({ where: { id } });
        return sanitizeNvr(deleted);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

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

        const updated = await prisma.nvr.update({
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

        await prisma.$transaction(async (tx) => {
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

        const updated = await prisma.nvr.update({
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
          await prisma.nvr.update({
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

        await prisma.$transaction(async (tx) => {
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

        const updatedNvr = await prisma.nvr.update({
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
          await prisma.nvr.update({
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
  fastify.get(
    "/schools/:schoolId/camera-areas",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        return prisma.cameraArea.findMany({
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

        return prisma.cameraArea.create({
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

        return prisma.cameraArea.update({
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

        return prisma.cameraArea.delete({ where: { id } });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Cameras
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
        const cameras = await prisma.camera.findMany({
          where: {
            schoolId,
            areaId: areaId || undefined,
            nvrId: nvrId || undefined,
          },
          orderBy: { createdAt: "desc" },
        });
        if (canViewRtsp) return cameras;
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

        requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
        const camera = await requireCameraSchoolScope(user, id);

        const canViewRtsp =
          user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN";
        let rtspUrl: string | null = null;
        let rtspSource: string | null = null;

        if (canViewRtsp) {
          rtspUrl = camera.streamUrl || null;
          rtspSource = camera.streamUrl ? "manual" : "hikvision";

          if (!rtspUrl && camera.nvrId && camera.channelNo) {
            const nvr = await requireNvrSchoolScope(user, camera.nvrId);
            const password = decryptSecret(nvr.passwordEncrypted);
            rtspUrl = buildHikvisionRtspUrl({
              nvr: {
                host: nvr.host,
                rtspPort: nvr.rtspPort,
                username: nvr.username,
                password,
              },
              channelNo: camera.channelNo,
            });
          }

          if (!rtspUrl) {
            rtspSource = null;
          }
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

        // HLS URL for H.265 streams
        const hlsUrl = `http://localhost:8888/${webrtcPath}/index.m3u8`;

        return {
          cameraId: camera.id,
          webrtcUrl,
          webrtcPath,
          rtspUrl,
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

        const cameras = await prisma.camera.findMany({
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

        const nvrs = await prisma.nvr.findMany({ where: { schoolId } });
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

        const cameras = await prisma.camera.findMany({
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

        const cameras = await prisma.camera.findMany({
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

        const nvrs = await prisma.nvr.findMany({ where: { schoolId } });
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

        const cameras = await prisma.camera.findMany({
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
    "/schools/:schoolId/cameras",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const {
          name,
          nvrId,
          areaId,
          externalId,
          channelNo,
          streamUrl,
          streamProfile,
          autoGenerateUrl,
          status,
          isActive,
        } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        if (!name) return reply.status(400).send({ error: "name required" });
        if (status && !ALLOWED_CAMERA_STATUS.has(status)) {
          return reply.status(400).send({ error: "invalid status" });
        }
        if (channelNo !== undefined && !isValidChannelNo(channelNo)) {
          return reply.status(400).send({ error: "invalid channelNo" });
        }
        if (streamProfile && !["main", "sub"].includes(streamProfile)) {
          return reply.status(400).send({ error: "invalid streamProfile" });
        }

        if (nvrId) {
          await requireNvrSchoolScope(user, nvrId);
        }
        if (areaId) {
          await requireCameraAreaSchoolScope(user, areaId);
        }

        return prisma.camera.create({
          data: {
            schoolId,
            nvrId,
            areaId,
            name,
            externalId,
            channelNo:
              channelNo !== undefined ? toNumber(channelNo) : undefined,
            streamUrl,
            streamProfile: streamProfile || "main",
            autoGenerateUrl: autoGenerateUrl ?? true,
            status,
            isActive: isActive ?? true,
          },
        });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/cameras/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const {
          name,
          nvrId,
          areaId,
          externalId,
          channelNo,
          streamUrl,
          streamProfile,
          autoGenerateUrl,
          status,
          isActive,
        } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        await requireCameraSchoolScope(user, id);

        if (status && !ALLOWED_CAMERA_STATUS.has(status)) {
          return reply.status(400).send({ error: "invalid status" });
        }
        if (channelNo !== undefined && !isValidChannelNo(channelNo)) {
          return reply.status(400).send({ error: "invalid channelNo" });
        }
        if (streamProfile && !["main", "sub"].includes(streamProfile)) {
          return reply.status(400).send({ error: "invalid streamProfile" });
        }

        if (nvrId) {
          await requireNvrSchoolScope(user, nvrId);
        }
        if (areaId) {
          await requireCameraAreaSchoolScope(user, areaId);
        }

        return prisma.camera.update({
          where: { id },
          data: {
            name,
            nvrId,
            areaId,
            externalId,
            channelNo:
              channelNo !== undefined ? toNumber(channelNo) : undefined,
            streamUrl,
            streamProfile,
            autoGenerateUrl,
            status,
            isActive,
          },
        });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/cameras/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        await requireCameraSchoolScope(user, id);

        return prisma.camera.delete({ where: { id } });
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Stream Test - RTSP URL tekshirish
  fastify.post(
    "/cameras/:id/test-stream",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        const camera = await requireCameraSchoolScope(user, id);

        let rtspUrl = camera.streamUrl;

        // Auto-generate URL if needed
        if (!rtspUrl && camera.nvrId && camera.channelNo) {
          const nvr = await prisma.nvr.findUnique({
            where: { id: camera.nvrId },
          });
          if (nvr) {
            const password = decryptSecret(nvr.passwordEncrypted);
            const vendor = (nvr.vendor?.toLowerCase() ||
              "hikvision") as RtspVendor;
            rtspUrl = buildRtspUrl({
              nvr: {
                host: nvr.host,
                rtspPort: nvr.rtspPort,
                username: nvr.username,
                password,
              },
              channelNo: camera.channelNo,
              profile: (camera.streamProfile as "main" | "sub") || "main",
              vendor,
            });
          }
        }

        if (!rtspUrl) {
          return reply.status(400).send({
            success: false,
            error: "No RTSP URL configured",
          });
        }

        // Parse URL to test TCP connection
        const urlMatch = rtspUrl.match(/rtsp:\/\/[^@]+@([^:\/]+):(\d+)/);
        if (!urlMatch) {
          return reply.status(400).send({
            success: false,
            error: "Invalid RTSP URL format",
          });
        }

        const [, host, portStr] = urlMatch;
        const port = parseInt(portStr, 10);

        // TCP probe
        const { probeTcp } = await import("../services/nvr.service");
        const isReachable = await probeTcp(host, port, 3000);

        return {
          success: isReachable,
          rtspUrl,
          host,
          port,
          streamProfile: camera.streamProfile || "main",
          message: isReachable
            ? "RTSP server javob berdi"
            : "RTSP serverga ulanib bo'lmadi",
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

        requireRoles(user, ["SCHOOL_ADMIN", "SUPER_ADMIN"]);
        requireSchoolScope(user, schoolId);

        if (!nvrId || !channelNo) {
          return reply
            .status(400)
            .send({ error: "nvrId and channelNo required" });
        }

        const nvr = await prisma.nvr.findUnique({ where: { id: nvrId } });
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

        return {
          rtspUrl,
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

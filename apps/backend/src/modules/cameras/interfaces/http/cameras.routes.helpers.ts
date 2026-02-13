import { WEBRTC_BASE_URL } from "../../../../config";
import { decryptSecret } from "../../../../utils/crypto";
import { buildRtspUrl, RtspVendor } from "../../services/rtsp.service";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { spawn } from "child_process";

export const ALLOWED_PROTOCOLS = new Set(["ONVIF", "RTSP", "HYBRID"]);
export const ALLOWED_CAMERA_STATUS = new Set(["ONLINE", "OFFLINE", "UNKNOWN"]);

export function badRequest(message: string) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

export function buildWebrtcUrl(pathValue: string): string | null {
  if (!WEBRTC_BASE_URL) return null;
  const trimmed = WEBRTC_BASE_URL.replace(/\/+$/, "");
  return `${trimmed}/${pathValue}/whep`;
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

export type CamerasNvrAuth = {
  id: string;
  host: string;
  rtspPort: number;
  username: string;
  password: string;
  vendor: string | null;
};

export type CamerasRtspVendor = RtspVendor;

export const deployMediaMtxConfig = async (params: {
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

export function isValidChannelNo(value: any): boolean {
  const num = toNumber(value);
  if (num === undefined) return false;
  return Number.isInteger(num) && num > 0;
}

export function toNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  return Math.trunc(num);
}

export function isValidPort(value: any): boolean {
  const num = toNumber(value);
  if (num === undefined) return false;
  return num > 0 && num <= 65535;
}

export function isSafeHost(value: string): boolean {
  return /^[a-zA-Z0-9.-]+$/.test(value);
}

export function isSafeUser(value: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(value);
}

export function isSafeRemotePath(value: string): boolean {
  return value.startsWith("/") && !value.includes("..") && !value.includes("~");
}

export function isSafeLocalPath(value: string): boolean {
  if (!path.isAbsolute(value)) return false;
  if (value.includes("..")) return false;
  return true;
}

export function isMaskedRtspUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol.toLowerCase() === "rtsp:" && url.password === "***";
  } catch {
    return value.includes(":***@");
  }
}

export function isSafeRestartCommand(value: string): boolean {
  const cmd = value.trim();
  if (!cmd) return false;
  const blocked = ["&", "|", ";", ">", "<", "`", "\n", "\r"];
  return !blocked.some((ch) => cmd.includes(ch));
}

export function buildRtspUrlForCamera(params: {
  camera: {
    streamUrl: string | null;
    streamProfile: string;
    autoGenerateUrl: boolean;
    nvrId: string | null;
    channelNo: number | null;
  };
  nvr: {
    host: string;
    rtspPort: number;
    username: string;
    passwordEncrypted: string;
    vendor: string | null;
  } | null;
}) {
  const { camera, nvr } = params;

  if (camera.streamUrl) {
    return { rtspUrl: camera.streamUrl, rtspSource: "manual" };
  }

  if (
    camera.autoGenerateUrl &&
    camera.nvrId &&
    camera.channelNo &&
    nvr &&
    nvr.host &&
    nvr.rtspPort &&
    nvr.username
  ) {
    const password = decryptSecret(nvr.passwordEncrypted);
    const vendor = (nvr.vendor?.toLowerCase() || "hikvision") as RtspVendor;
    const profile = (camera.streamProfile as "main" | "sub") || "main";
    return {
      rtspUrl: buildRtspUrl({
        nvr: {
          host: nvr.host,
          rtspPort: nvr.rtspPort,
          username: nvr.username,
          password,
        },
        channelNo: camera.channelNo,
        profile,
        vendor,
      }),
      rtspSource: `auto:${vendor}`,
    };
  }

  return { rtspUrl: null, rtspSource: null };
}


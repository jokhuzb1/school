import prisma from "../../../prisma";
import { decryptSecret } from "../../../utils/crypto";
import { buildRtspUrl, RtspVendor } from "./rtsp.service";

function sanitizePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function getWebrtcPath(params: {
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

type NvrAuth = {
  id: string;
  host: string;
  rtspPort: number;
  username: string;
  password: string;
  vendor: string | null;
};

export function buildMediaMtxConfig(params: {
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
}) {
  const { cameras, nvrAuthById } = params;
  const lines: string[] = [
    "# Auto-generated MediaMTX config",
    "logLevel: info",
    "",
    "rtsp: yes",
    "rtspAddress: :8554",
    "",
    "hls: yes",
    "hlsAddress: :8888",
    "hlsAllowOrigin: '*'",
    "hlsAlwaysRemux: yes",
    "",
    "webrtc: yes",
    "webrtcAddress: :8889",
    "webrtcAllowOrigin: '*'",
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

    if (
      camera.autoGenerateUrl &&
      !rtspUrl &&
      camera.nvrId &&
      camera.channelNo
    ) {
      const nvr = nvrAuthById.get(camera.nvrId);
      if (nvr) {
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
}

export async function buildLocalMediaMtxConfigFromDb(): Promise<string> {
  const cameras = await prisma.camera.findMany({
    where: { isActive: true },
    orderBy: [{ schoolId: "asc" }, { channelNo: "asc" }],
    select: {
      id: true,
      schoolId: true,
      externalId: true,
      streamUrl: true,
      streamProfile: true,
      autoGenerateUrl: true,
      channelNo: true,
      nvrId: true,
    },
  });

  const nvrIds = Array.from(
    new Set(cameras.map((c) => c.nvrId).filter(Boolean) as string[]),
  );
  const nvrs = await prisma.nvr.findMany({
    where: { id: { in: nvrIds } },
    select: {
      id: true,
      host: true,
      rtspPort: true,
      username: true,
      passwordEncrypted: true,
      vendor: true,
    },
  });

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

  return buildMediaMtxConfig({ cameras, nvrAuthById });
}


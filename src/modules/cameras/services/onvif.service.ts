import type { Nvr } from "@prisma/client";
import { buildHikvisionRtspUrl } from "./rtsp.service";

type OnvifProfile = {
  token: string;
  name?: string;
  videoEncoderConfiguration?: {
    token?: string;
  };
};

type OnvifDeviceInfo = {
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  hardwareId?: string;
};

type OnvifStream = {
  profile: OnvifProfile;
  uri: string | null;
  channelNo?: number | null;
};

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> => {
  let timer: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(`${label} timeout after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const runNext = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  };

  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    runNext(),
  );
  await Promise.all(runners);
  return results;
};

const getOnvifDevice = async (params: {
  host: string;
  onvifPort: number;
  username: string;
  password: string;
  timeoutMs?: number;
}) => {
  const timeoutMs = params.timeoutMs ?? 5000;
  const onvif = await import("onvif");
  const OnvifDevice = (onvif as any).OnvifDevice;
  const xaddr = `http://${params.host}:${params.onvifPort}/onvif/device_service`;
  const device = new OnvifDevice({
    xaddr,
    user: params.username,
    pass: params.password,
  });
  await withTimeout(device.init(), timeoutMs, "device.init");
  return device;
};

const withCallback = <T>(
  fn: (cb: (err: any, data?: T) => void) => void,
): Promise<T> =>
  new Promise((resolve, reject) => {
    fn((err, data) => {
      if (err) return reject(err);
      resolve(data as T);
    });
  });

const parseChannelNo = (uri?: string | null): number | null => {
  if (!uri) return null;
  const match = uri.match(/Channels\/(\d+)/i);
  if (!match) return null;
  const channel = Number(match[1]);
  if (!Number.isFinite(channel) || channel <= 0) return null;
  return Math.floor(channel / 100);
};

export async function fetchOnvifProfiles(params: {
  host: string;
  onvifPort: number;
  username: string;
  password: string;
  timeoutMs?: number;
  concurrency?: number;
}) {
  const timeoutMs = params.timeoutMs ?? 5000;
  const device = await getOnvifDevice({ ...params, timeoutMs });
  const concurrency = Math.max(1, params.concurrency ?? 4);
  const profiles =
    (await withTimeout(
      withCallback<OnvifProfile[]>((cb) => device.getProfiles(cb)),
      timeoutMs,
      "getProfiles",
    )) || [];

  const streams = await runWithConcurrency(
    profiles,
    concurrency,
    async (profile): Promise<OnvifStream> => {
      try {
        const uriResp = await withTimeout(
          withCallback<{ uri?: string }>((cb) =>
            device.getStreamUri(
              { protocol: "RTSP", profileToken: profile.token },
              cb,
            ),
          ),
          timeoutMs,
          "getStreamUri",
        );
        const uri = uriResp?.uri || null;
        return {
          profile,
          uri,
          channelNo: parseChannelNo(uri),
        };
      } catch {
        return { profile, uri: null, channelNo: null };
      }
    },
  );

  return { profiles, streams };
}

export async function fetchOnvifDeviceInfo(params: {
  host: string;
  onvifPort: number;
  username: string;
  password: string;
  timeoutMs?: number;
}): Promise<OnvifDeviceInfo> {
  const timeoutMs = params.timeoutMs ?? 5000;
  const device = await getOnvifDevice({ ...params, timeoutMs });
  const info = await withTimeout(
    withCallback<OnvifDeviceInfo>((cb) => device.getDeviceInformation(cb)),
    timeoutMs,
    "getDeviceInformation",
  );
  return info || {};
}

export function buildFallbackRtsp(params: {
  nvr: Pick<Nvr, "host" | "rtspPort" | "username">;
  password: string;
  channelNo: number;
}) {
  return buildHikvisionRtspUrl({
    nvr: {
      host: params.nvr.host,
      rtspPort: params.nvr.rtspPort,
      username: params.nvr.username,
      password: params.password,
    },
    channelNo: params.channelNo,
  });
}

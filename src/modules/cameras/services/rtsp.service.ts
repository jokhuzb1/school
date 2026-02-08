type NvrShape = {
  host: string;
  rtspPort: number;
  username: string;
  password: string;
};

export type RtspProfile = "main" | "sub";
export type RtspVendor = "hikvision" | "seetong" | "dahua" | "generic";

const encodeAuth = (value: string) => encodeURIComponent(value);

/**
 * Build RTSP URL for Hikvision cameras/NVRs
 * Format: rtsp://user:pass@host:port/Streaming/Channels/{channel}
 * Channel = channelNo * 100 + streamId (1=main, 2=sub)
 */
export function buildHikvisionRtspUrl(params: {
  nvr: NvrShape;
  channelNo: number;
  profile?: RtspProfile;
}): string {
  const { nvr, channelNo, profile = "main" } = params;
  const streamId = profile === "main" ? 1 : 2;
  const channel = channelNo * 100 + streamId;
  const user = encodeAuth(nvr.username);
  const pass = encodeAuth(nvr.password);
  return `rtsp://${user}:${pass}@${nvr.host}:${nvr.rtspPort}/Streaming/Channels/${channel}`;
}

/**
 * Build RTSP URL for Seetong cameras
 * Format: rtsp://user:pass@host:port/user=user&password=pass&channel=N&stream=S.sdp
 * Stream: 0=main, 1=sub
 */
export function buildSeetongRtspUrl(params: {
  nvr: NvrShape;
  channelNo: number;
  profile?: RtspProfile;
}): string {
  const { nvr, channelNo, profile = "main" } = params;
  const streamId = profile === "main" ? 0 : 1;
  const user = encodeAuth(nvr.username);
  const pass = encodeAuth(nvr.password);
  return `rtsp://${user}:${pass}@${nvr.host}:${nvr.rtspPort}/user=${user}&password=${pass}&channel=${channelNo}&stream=${streamId}.sdp`;
}

/**
 * Build RTSP URL for Dahua cameras/NVRs
 * Format: rtsp://user:pass@host:port/cam/realmonitor?channel=N&subtype=S
 * Subtype: 0=main, 1=sub
 */
export function buildDahuaRtspUrl(params: {
  nvr: NvrShape;
  channelNo: number;
  profile?: RtspProfile;
}): string {
  const { nvr, channelNo, profile = "main" } = params;
  const subtype = profile === "main" ? 0 : 1;
  const user = encodeAuth(nvr.username);
  const pass = encodeAuth(nvr.password);
  return `rtsp://${user}:${pass}@${nvr.host}:${nvr.rtspPort}/cam/realmonitor?channel=${channelNo}&subtype=${subtype}`;
}

/**
 * Build RTSP URL for generic ONVIF cameras
 * Format: rtsp://user:pass@host:port/ch{channel}/{profile}/av_stream
 */
export function buildGenericRtspUrl(params: {
  nvr: NvrShape;
  channelNo: number;
  profile?: RtspProfile;
}): string {
  const { nvr, channelNo, profile = "main" } = params;
  const user = encodeAuth(nvr.username);
  const pass = encodeAuth(nvr.password);
  return `rtsp://${user}:${pass}@${nvr.host}:${nvr.rtspPort}/ch${channelNo}/${profile}/av_stream`;
}

/**
 * Build RTSP URL based on vendor type
 */
export function buildRtspUrl(params: {
  nvr: NvrShape;
  channelNo: number;
  profile?: RtspProfile;
  vendor?: RtspVendor;
}): string {
  const { vendor = "hikvision", ...rest } = params;

  switch (vendor) {
    case "seetong":
      return buildSeetongRtspUrl(rest);
    case "dahua":
      return buildDahuaRtspUrl(rest);
    case "generic":
      return buildGenericRtspUrl(rest);
    case "hikvision":
    default:
      return buildHikvisionRtspUrl(rest);
  }
}

/**
 * Detect vendor from RTSP URL pattern
 */
export function detectVendorFromUrl(url: string): RtspVendor {
  if (url.includes("/Streaming/Channels/")) return "hikvision";
  if (url.includes("&stream=") && url.includes(".sdp")) return "seetong";
  if (url.includes("/cam/realmonitor")) return "dahua";
  if (url.includes("/ch") && url.includes("/av_stream")) return "generic";
  return "generic";
}

/**
 * Parse stream profile from URL
 */
export function detectProfileFromUrl(url: string): RtspProfile {
  // Hikvision: channel % 100 === 2 means sub
  const hikvisionMatch = url.match(/\/Streaming\/Channels\/(\d+)/);
  if (hikvisionMatch) {
    const channel = parseInt(hikvisionMatch[1], 10);
    return channel % 100 === 2 ? "sub" : "main";
  }

  // Seetong: stream=1 means sub
  const seetongMatch = url.match(/&stream=(\d)/);
  if (seetongMatch) {
    return seetongMatch[1] === "1" ? "sub" : "main";
  }

  // Dahua: subtype=1 means sub
  const dahuaMatch = url.match(/subtype=(\d)/);
  if (dahuaMatch) {
    return dahuaMatch[1] === "1" ? "sub" : "main";
  }

  // Generic: /sub/ in path
  if (url.includes("/sub/")) return "sub";

  return "main";
}

export type ParsedRtspUrl = {
  host: string;
  port: number;
  username?: string;
  password?: string;
};

export function parseRtspUrl(rtspUrl: string): ParsedRtspUrl {
  try {
    const url = new URL(rtspUrl);
    if (url.protocol.toLowerCase() !== "rtsp:") {
      throw new Error("not rtsp");
    }
    const host = url.hostname;
    const port = url.port ? Number(url.port) : 554;
    if (!host) throw new Error("missing host");
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      throw new Error("invalid port");
    }
    return {
      host,
      port,
      username: url.username || undefined,
      password: url.password || undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid RTSP URL: ${message}`);
  }
}

export function maskRtspUrl(rtspUrl: string): string {
  try {
    const url = new URL(rtspUrl);
    if (url.protocol.toLowerCase() !== "rtsp:") return rtspUrl;
    if (url.password) {
      url.password = "***";
    }
    return url.toString();
  } catch {
    return rtspUrl.replace(
      /^rtsp:\/\/([^:@/]+):([^@/]+)@/i,
      "rtsp://$1:***@",
    );
  }
}

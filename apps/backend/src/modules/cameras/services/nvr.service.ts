import net from "net";
import { NVR_HEALTH_TIMEOUT_MS } from "../../../config";

export type PortProbeResult = {
  port: number;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

export type NvrHealthResult = {
  host: string;
  http: PortProbeResult;
  onvif: PortProbeResult;
  rtsp: PortProbeResult;
  checkedAt: string;
};

export function sanitizeNvr<T extends { passwordEncrypted?: string }>(nvr: T) {
  const { passwordEncrypted, ...rest } = nvr;
  return rest;
}

export async function probeTcp(
  host: string,
  port: number,
  timeoutMs = NVR_HEALTH_TIMEOUT_MS,
): Promise<PortProbeResult> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const start = Date.now();
    let done = false;

    const finish = (ok: boolean, error?: string) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve({
        port,
        ok,
        latencyMs: ok ? Date.now() - start : undefined,
        error,
      });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false, "timeout"));
    socket.once("error", (err) => finish(false, err.message));
    socket.connect(port, host);
  });
}

export async function checkNvrHealth(params: {
  host: string;
  httpPort: number;
  onvifPort: number;
  rtspPort: number;
  timeoutMs?: number;
}): Promise<NvrHealthResult> {
  const { host, httpPort, onvifPort, rtspPort, timeoutMs } = params;
  const [http, onvif, rtsp] = await Promise.all([
    probeTcp(host, httpPort, timeoutMs),
    probeTcp(host, onvifPort, timeoutMs),
    probeTcp(host, rtspPort, timeoutMs),
  ]);

  return {
    host,
    http,
    onvif,
    rtsp,
    checkedAt: new Date().toISOString(),
  };
}

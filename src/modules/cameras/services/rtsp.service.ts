type NvrShape = {
  host: string;
  rtspPort: number;
  username: string;
  password: string;
};

export type RtspProfile = "main" | "sub";

const encodeAuth = (value: string) => encodeURIComponent(value);

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

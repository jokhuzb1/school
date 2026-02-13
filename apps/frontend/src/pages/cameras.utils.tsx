import { Tag } from "antd";

export const DEFAULT_SYNC_SAMPLE = {
  areas: [{ name: "Entrance", externalId: "area-1" }],
  cameras: [
    {
      name: "Gate Cam",
      externalId: "cam-001",
      channelNo: 1,
      streamUrl: "rtsp://user:pass@192.168.1.50:554/Streaming/Channels/101",
      status: "ONLINE",
      areaExternalId: "area-1",
    },
  ],
};

export const getErrorMessage = (err: any) => err?.response?.data?.error || err?.message || "Xatolik";

export const getNvrStatusTag = (status?: string | null) => {
  if (status === "ok") return <Tag color="green">OK</Tag>;
  if (status === "partial") return <Tag color="orange">Partial</Tag>;
  if (status === "offline") return <Tag color="red">Offline</Tag>;
  return <Tag color="gray">Unknown</Tag>;
};

export const RTSP_VENDOR_OPTIONS = [
  { value: "hikvision", label: "Hikvision" },
  { value: "seetong", label: "Seetong" },
  { value: "dahua", label: "Dahua" },
  { value: "generic", label: "Generic/ONVIF" },
];

export const buildRtspUrlLocal = (params: {
  vendor: string;
  host: string;
  port: number;
  username: string;
  password: string;
  channelNo: number;
  profile: "main" | "sub";
}) => {
  const { vendor, host, port, username, password, channelNo, profile } = params;
  const encUser = encodeURIComponent(username);
  const encPass = encodeURIComponent(password);

  if (vendor === "seetong") {
    const streamId = profile === "main" ? 0 : 1;
    return `rtsp://${encUser}:${encPass}@${host}:${port}/user=${encUser}&password=${encPass}&channel=${channelNo}&stream=${streamId}.sdp`;
  }
  if (vendor === "dahua") {
    const subtype = profile === "main" ? 0 : 1;
    return `rtsp://${encUser}:${encPass}@${host}:${port}/cam/realmonitor?channel=${channelNo}&subtype=${subtype}`;
  }
  if (vendor === "generic") {
    return `rtsp://${encUser}:${encPass}@${host}:${port}/ch${channelNo}/${profile}/av_stream`;
  }
  const streamId = profile === "main" ? 1 : 2;
  const channel = channelNo * 100 + streamId;
  return `rtsp://${encUser}:${encPass}@${host}:${port}/Streaming/Channels/${channel}`;
};

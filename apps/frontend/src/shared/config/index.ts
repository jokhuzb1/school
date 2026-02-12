export const API_BASE_URL =
  import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;

export const MEDIAMTX_HLS_URL =
  import.meta.env.VITE_MEDIAMTX_HLS_URL ||
  `http://${window.location.hostname}:8888`;

export const MEDIAMTX_WEBRTC_URL =
  import.meta.env.VITE_MEDIAMTX_WEBRTC_URL ||
  `http://${window.location.hostname}:8889`;

if (import.meta.env.DEV) {
  console.log("📍 API_BASE_URL:", API_BASE_URL);
  console.log("📍 MEDIAMTX_HLS_URL:", MEDIAMTX_HLS_URL);
}

export const buildHlsUrl = (path: string): string => {
  return `${MEDIAMTX_HLS_URL}/${path}/index.m3u8`;
};

export const buildWebrtcWhepUrl = (path: string): string => {
  return `${MEDIAMTX_WEBRTC_URL}/${path}/whep`;
};

export const getAssetUrl = (
  path: string | undefined | null,
): string | undefined => {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_BASE_URL}/${path.replace(/^\//, "")}`;
};

export const DEFAULT_PAGE_SIZE = 50;
export const DATE_FORMAT = "DD MMM, YYYY";
export const TIME_FORMAT = "HH:mm";
export const DATETIME_FORMAT = "DD MMM HH:mm";
export const CAMERA_SNAPSHOT_REFRESH_MS = 15000;

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

export const NODE_ENV = process.env.NODE_ENV || "development";
export const IS_PROD = NODE_ENV === "production";

export const PORT = process.env.PORT ? Number(process.env.PORT) : 5000;

export const JWT_SECRET = process.env.JWT_SECRET || "";
if (IS_PROD && !JWT_SECRET) {
  throw new Error("JWT_SECRET must be set in production");
}

export const CREDENTIALS_SECRET = process.env.CREDENTIALS_SECRET || JWT_SECRET || "";
if (IS_PROD && !CREDENTIALS_SECRET) {
  throw new Error("CREDENTIALS_SECRET must be set in production");
}

export const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const WEBHOOK_ENFORCE_SECRET = IS_PROD;
export const WEBHOOK_SECRET_HEADER = "x-webhook-secret";

// Devices (FaceID terminals) - auto provision on first valid webhook event.
// Recommended only when webhook secrets are enforced (production).
export const DEVICE_AUTO_REGISTER_ENABLED =
  process.env.DEVICE_AUTO_REGISTER_ENABLED === "true" ||
  process.env.DEVICE_AUTO_REGISTER_ENABLED === "1";

export const SSE_TOKEN_TTL_SECONDS = Number(
  process.env.SSE_TOKEN_TTL_SECONDS || "300",
);

// Disable Redis in non-production to avoid local connection issues.
export const REDIS_URL = IS_PROD ? process.env.REDIS_URL || "" : "";

export const MIN_SCAN_INTERVAL_SECONDS = Number(
  process.env.MIN_SCAN_INTERVAL_SECONDS || "120",
);

export const NVR_HEALTH_TIMEOUT_MS = Number(
  process.env.NVR_HEALTH_TIMEOUT_MS || "3000",
);

export const WEBRTC_BASE_URL = process.env.WEBRTC_BASE_URL || "";

export const ONVIF_TIMEOUT_MS = Number(
  process.env.ONVIF_TIMEOUT_MS || "5000",
);
export const ONVIF_CONCURRENCY = Number(
  process.env.ONVIF_CONCURRENCY || "4",
);

export const MEDIAMTX_DEPLOY_ENABLED =
  process.env.MEDIAMTX_DEPLOY_ENABLED === "true" ||
  process.env.MEDIAMTX_DEPLOY_ENABLED === "1";

export const MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS =
  process.env.MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS === "true" ||
  process.env.MEDIAMTX_DEPLOY_ALLOW_RESTART_COMMANDS === "1";

export const PROVISIONING_TOKEN = process.env.PROVISIONING_TOKEN || "";

export const DEVICE_STUDENT_ID_STRATEGY =
  (process.env.DEVICE_STUDENT_ID_STRATEGY || "uuid").toLowerCase();
export const DEVICE_STUDENT_ID_LENGTH = Number(
  process.env.DEVICE_STUDENT_ID_LENGTH || "10",
);

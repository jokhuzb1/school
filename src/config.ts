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

export const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

export const WEBHOOK_ENFORCE_SECRET = IS_PROD;
export const WEBHOOK_SECRET_HEADER = "x-webhook-secret";

export const SSE_TOKEN_TTL_SECONDS = Number(
  process.env.SSE_TOKEN_TTL_SECONDS || "300",
);

export const REDIS_URL = process.env.REDIS_URL || "";

export const MIN_SCAN_INTERVAL_SECONDS = Number(
  process.env.MIN_SCAN_INTERVAL_SECONDS || "120",
);

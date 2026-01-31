import crypto from "crypto";
import { CREDENTIALS_SECRET } from "../config";

const KEY = crypto.createHash("sha256").update(CREDENTIALS_SECRET).digest();
const IV_LENGTH = 12;

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, dataB64, tagB64] = payload.split(":");
  if (!ivB64 || !dataB64 || !tagB64) {
    throw new Error("Invalid secret payload");
  }
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    KEY,
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

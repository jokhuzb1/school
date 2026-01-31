import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";

/**
 * MediaMTX serverni avtomatik ishga tushirish uchun xizmat
 */
export async function startMediaMtxAuto() {
  const mtxDir = path.join(process.cwd(), "tools", "mediamtx");
  const mtxExe = path.join(mtxDir, IS_WINDOWS() ? "mediamtx.exe" : "mediamtx");
  const mtxConfig = path.join(mtxDir, "mediamtx.yml");

  try {
    // MediaMTX mavjudligini tekshirish
    await fs.access(mtxExe);

    console.log("🚀 MediaMTX serverni ishga tushirishga urinish...");

    const child = spawn(mtxExe, [mtxConfig], {
      cwd: mtxDir,
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    console.log("✅ MediaMTX server fon rejimida ishga tushirildi.");
  } catch (error) {
    console.warn(
      "⚠️ MediaMTX topilmadi yoki ishga tushirib bo'lmadi:",
      error instanceof Error ? error.message : error,
    );
  }
}

function IS_WINDOWS() {
  return process.platform === "win32";
}

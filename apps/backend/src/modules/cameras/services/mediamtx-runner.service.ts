import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { getToolsDir } from "../../../app/runtime/paths";
import { buildLocalMediaMtxConfigFromDb } from "./mediamtx-config.service";

/**
 * MediaMTX serverni avtomatik ishga tushirish uchun xizmat
 */
export async function startMediaMtxAuto() {
  const mtxDir = getToolsDir("mediamtx");
  const mtxExe = path.join(mtxDir, IS_WINDOWS() ? "mediamtx.exe" : "mediamtx");
  const mtxConfig = path.join(mtxDir, "mediamtx.yml");
  const mtxConfigAutogen = path.join(mtxDir, "mediamtx.autogen.yml");

  try {
    // MediaMTX mavjudligini tekshirish
    await fs.access(mtxExe);

    console.log("🚀 MediaMTX serverni ishga tushirishga urinish...");

    let configToUse = mtxConfig;
    try {
      const generated = await buildLocalMediaMtxConfigFromDb();
      await fs.writeFile(mtxConfigAutogen, generated, "utf8");
      configToUse = mtxConfigAutogen;
      console.log(`🧩 MediaMTX config autogen: ${mtxConfigAutogen}`);
    } catch (err) {
      console.warn(
        "⚠️ MediaMTX config autogen bo'lmadi, default config ishlatiladi:",
        err instanceof Error ? err.message : err,
      );
    }

    const child = spawn(mtxExe, [configToUse], {
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

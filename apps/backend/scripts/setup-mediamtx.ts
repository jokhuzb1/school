import https from "https";
import fs from "fs";
import { execSync } from "child_process";
import os from "os";
import path from "path";
import { getToolsDir } from "../src/app/runtime/paths";

// MediaMTX release URL
const VERSION = "v1.9.3";
const PLATFORM = os.platform() === "win32" ? "windows_amd64" : "linux_amd64";
const EXT = os.platform() === "win32" ? "zip" : "tar.gz";
const DOWNLOAD_URL = `https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/mediamtx_${VERSION}_${PLATFORM}.${EXT}`;

const MTX_DIR = getToolsDir("mediamtx");
const DEST_FILE = path.join(MTX_DIR, `mediamtx.${EXT}`);

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      fs.unlinkSync(dest);
    }
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          file.close();
          downloadFile(response.headers.location!, dest)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`Server qatnashmadi: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close(() => {
            setTimeout(resolve, 500); // Bo'shatish uchun qo'shimcha vaqt
          });
        });
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function setup() {
  if (!fs.existsSync(MTX_DIR)) {
    fs.mkdirSync(MTX_DIR, { recursive: true });
  }

  const exeName = os.platform() === "win32" ? "mediamtx.exe" : "mediamtx";
  const exePath = path.join(MTX_DIR, exeName);

  if (fs.existsSync(exePath)) {
    console.log("✅ MediaMTX allaqachon mavjud.");
    return;
  }

  console.log(`🚀 MediaMTX yuklab olinmoqda: ${DOWNLOAD_URL}...`);

  try {
    await downloadFile(DOWNLOAD_URL, DEST_FILE);

    console.log("📦 Arxiv ochilmoqda...");

    let success = false;
    let attempts = 0;

    while (!success && attempts < 3) {
      try {
        attempts++;
        // Har bir urinish orasida kutishni ko'paytiramiz
        await new Promise((r) => setTimeout(r, 2000 * attempts));

        if (os.platform() === "win32") {
          // PowerShell-ni ErrorAction Stop bilan ishlatamiz
          execSync(
            `powershell -ExecutionPolicy Bypass -Command "$ErrorActionPreference = 'Stop'; Expand-Archive -Path '${DEST_FILE}' -DestinationPath '${MTX_DIR}' -Force"`,
            { stdio: "inherit" },
          );
        } else {
          execSync(`tar -xzf "${DEST_FILE}" -C "${MTX_DIR}"`, {
            stdio: "inherit",
          });
          execSync(`chmod +x "${exePath}"`);
        }

        if (fs.existsSync(exePath)) {
          success = true;
        }
      } catch (err) {
        console.warn(
          `⚠️  Urinish ${attempts} muvaffaqiyatsiz tugadi. Qayta urinilmoqda...`,
        );
      }
    }

    if (success) {
      if (fs.existsSync(DEST_FILE)) {
        try {
          fs.unlinkSync(DEST_FILE);
        } catch (unlinkErr) {
          console.warn("DEST_FILE could not be deleted:", unlinkErr);
        }
      }
      console.log("✅ MediaMTX muvaffaqiyatli o'rnatildi.");
    } else {
      throw new Error("Arxivni ochib bo'lmadi. Binarlar topilmadi.");
    }
  } catch (error) {
    console.error(
      "❌ Xatolik yuz berdi:",
      error instanceof Error ? error.message : error,
    );
    console.log(
      "\nIltimos, MediaMTX-ni qo'lda yuklab oling va tools/mediamtx papkasiga tashlang:\n" +
        DOWNLOAD_URL,
    );
    process.exit(1); // Xatolik bilan tugatamizki, dev server boshlanmasin
  }
}

setup();

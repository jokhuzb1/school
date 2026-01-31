import https from "https";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import os from "os";

// MediaMTX release URL
const VERSION = "v1.9.3";
const PLATFORM = os.platform() === "win32" ? "windows_amd64" : "linux_amd64";
const EXT = os.platform() === "win32" ? "zip" : "tar.gz";
const DOWNLOAD_URL = `https://github.com/bluenviron/mediamtx/releases/download/${VERSION}/mediamtx_${VERSION}_${PLATFORM}.${EXT}`;

const MTX_DIR = path.join(process.cwd(), "tools", "mediamtx");
const DEST_FILE = path.join(MTX_DIR, `mediamtx.${EXT}`);

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Redirection handle qilish (GitHub uchun shart)
          downloadFile(response.headers.location!, dest)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Server qatnashmadi: ${response.statusCode}`));
          return;
        }

        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
  });
}

async function setup() {
  if (!fs.existsSync(MTX_DIR)) {
    fs.mkdirSync(MTX_DIR, { recursive: true });
  }

  const exePath = path.join(
    MTX_DIR,
    os.platform() === "win32" ? "mediamtx.exe" : "mediamtx",
  );
  if (fs.existsSync(exePath)) {
    console.log("✅ MediaMTX allaqachon mavjud.");
    return;
  }

  console.log(`🚀 MediaMTX yuklab olinmoqda: ${DOWNLOAD_URL}...`);

  try {
    await downloadFile(DOWNLOAD_URL, DEST_FILE);

    console.log("📦 Arxiv ochilmoqda...");

    if (os.platform() === "win32") {
      execSync(
        `powershell -command "Expand-Archive -Path '${DEST_FILE}' -DestinationPath '${MTX_DIR}' -Force"`,
      );
    } else {
      execSync(`tar -xzf ${DEST_FILE} -C ${MTX_DIR}`);
      // Linuxda ishga tushirish ruxsatini berish
      execSync(`chmod +x ${path.join(MTX_DIR, "mediamtx")}`);
    }

    if (fs.existsSync(DEST_FILE)) {
      fs.unlinkSync(DEST_FILE);
    }

    console.log("✅ MediaMTX muvaffaqiyatli o'rnatildi.");
  } catch (error) {
    console.error(
      "❌ Xatolik yuz berdi:",
      error instanceof Error ? error.message : error,
    );
    console.log(
      "\nIltimos, MediaMTX-ni qo'lda yuklab oling va tools/mediamtx papkasiga tashlang.",
    );
  }
}

setup();

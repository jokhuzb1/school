/**
 * Stream Info Service
 * RTSP stream haqida ma'lumot olish (codec, resolution, va h.k.)
 */

import { spawn } from "child_process";

export interface StreamInfo {
  codec?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitrate?: number;
  isH265?: boolean;
  isH264?: boolean;
  error?: string;
}

function parseFfprobeFps(value: unknown): number | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  // Common format: "25/1"
  const fraction = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const num = Number(fraction[1]);
    const den = Number(fraction[2]);
    if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) {
      return undefined;
    }
    const fps = num / den;
    return Number.isFinite(fps) && fps > 0 ? fps : undefined;
  }

  // Sometimes it's already a number-like string
  const num = Number(trimmed);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

/**
 * Test RTSP connection using TCP probe
 */
export async function testRtspConnection(
  host: string,
  port: number,
  timeoutMs = 3000,
): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require("net");
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });

    socket.on("error", () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Get stream info using FFprobe (if available)
 * Requires FFmpeg/FFprobe to be installed
 */
export async function getStreamInfoWithFfprobe(
  rtspUrl: string,
  timeoutSec = 5,
): Promise<StreamInfo> {
  return new Promise((resolve) => {
    try {
      const process = spawn("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        "-timeout",
        String(timeoutSec * 1000000), // microseconds
        "-rtsp_transport",
        "tcp",
        rtspUrl,
      ]);

      let output = "";
      let errorOutput = "";

      process.stdout.on("data", (data) => {
        output += data.toString();
      });

      process.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      const timeout = setTimeout(
        () => {
          process.kill();
          resolve({ error: "FFprobe timeout" });
        },
        (timeoutSec + 2) * 1000,
      );

      process.on("close", (code) => {
        clearTimeout(timeout);

        if (code !== 0) {
          resolve({ error: errorOutput || "FFprobe failed" });
          return;
        }

        try {
          const data = JSON.parse(output);
          const videoStream = data.streams?.find(
            (s: any) => s.codec_type === "video",
          );

          if (!videoStream) {
            resolve({ error: "No video stream found" });
            return;
          }

          const codec = videoStream.codec_name?.toLowerCase() || "";

          resolve({
            codec: videoStream.codec_name,
            width: videoStream.width,
            height: videoStream.height,
            fps: parseFfprobeFps(videoStream.r_frame_rate),
            bitrate: videoStream.bit_rate
              ? parseInt(videoStream.bit_rate, 10)
              : undefined,
            isH265: codec.includes("hevc") || codec.includes("h265"),
            isH264: codec.includes("h264") || codec.includes("avc"),
          });
        } catch {
          resolve({ error: "Failed to parse FFprobe output" });
        }
      });

      process.on("error", (err) => {
        clearTimeout(timeout);
        resolve({ error: `FFprobe not available: ${err.message}` });
      });
    } catch (err: any) {
      resolve({ error: err.message || "Unknown error" });
    }
  });
}

/**
 * Detect codec from stream profile (simple heuristic)
 * main = usually H.265 (HEVC)
 * sub = usually H.264 (AVC)
 */
export function detectCodecFromProfile(profile: "main" | "sub"): {
  codec: string;
  isH265: boolean;
  isH264: boolean;
} {
  if (profile === "main") {
    return {
      codec: "H.265 (HEVC)",
      isH265: true,
      isH264: false,
    };
  }
  return {
    codec: "H.264 (AVC)",
    isH265: false,
    isH264: true,
  };
}

/**
 * Get recommended player based on codec
 */
export function getRecommendedPlayer(
  isH265: boolean,
): "webrtc" | "hls" | "both" {
  if (isH265) {
    // H.265 - only Safari supports natively, use HLS for transcoding
    return "hls";
  }
  // H.264 - WebRTC works great
  return "webrtc";
}

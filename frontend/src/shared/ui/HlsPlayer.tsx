import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export interface HlsPlayerProps {
  /** HLS stream URL (e.g., http://localhost:8888/path/index.m3u8) */
  hlsUrl: string;
  /** Auto play video */
  autoPlay?: boolean;
  /** Muted by default (required for autoplay in most browsers) */
  muted?: boolean;
  /** Show native controls */
  controls?: boolean;
  /** Poster image URL */
  poster?: string;
  /** Callback when stream is ready */
  onReady?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * HLS Player component supporting H.264 and H.265 (HEVC) codecs.
 * Uses hls.js for browsers that don't support HLS natively.
 * Safari supports HLS natively including H.265.
 */
const HlsPlayer: React.FC<HlsPlayerProps> = ({
  hlsUrl,
  autoPlay = true,
  muted = true,
  controls = true,
  poster,
  onReady,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    const cleanup = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    // Always try hls.js first (better H.265 support)
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus("ready");
        onReady?.();
        if (autoPlay) {
          video.play().catch(() => {
            // Autoplay blocked
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          let msg = "HLS fatal error";
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              msg = `Network error: ${data.details}`;
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              msg = `Media error: ${data.details}`;
              hls.recoverMediaError();
              break;
            default:
              msg = `Fatal error: ${data.details}`;
              hls.destroy();
              break;
          }
          setStatus("error");
          setErrorMessage(msg);
          onError?.(msg);
        }
      });

      return cleanup;
    }

    // Fallback to native HLS (Safari)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.addEventListener("loadedmetadata", () => {
        setStatus("ready");
        onReady?.();
        if (autoPlay) {
          video.play().catch(() => {});
        }
      });
      video.addEventListener("error", () => {
        const msg = "Native HLS playback error";
        setStatus("error");
        setErrorMessage(msg);
        onError?.(msg);
      });
      return cleanup;
    }

    // No HLS support
    const msg = "HLS is not supported in this browser";
    setStatus("error");
    setErrorMessage(msg);
    onError?.(msg);
    return cleanup;
  }, [hlsUrl, autoPlay, onReady, onError]);

  return (
    <div
      style={{ position: "relative", width: "100%", backgroundColor: "#000" }}
    >
      <video
        ref={videoRef}
        style={{
          width: "100%",
          maxHeight: 480,
          borderRadius: 6,
          display: "block",
        }}
        muted={muted}
        controls={controls}
        poster={poster}
        playsInline
      />

      {status === "loading" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#fff",
            fontSize: 14,
          }}
        >
          Yuklanmoqda...
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ff4d4f",
            fontSize: 14,
            textAlign: "center",
            padding: 16,
          }}
        >
          <div>❌ Xato</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{errorMessage}</div>
        </div>
      )}
    </div>
  );
};

export default HlsPlayer;

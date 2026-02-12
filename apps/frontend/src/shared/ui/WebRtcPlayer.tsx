import React, { useEffect, useRef, useState } from "react";
import { Alert, Button, Space, Typography } from "antd";

const { Text } = Typography;

type WebRtcPlayerProps = {
  whepUrl?: string | null;
  autoPlay?: boolean;
  onError?: (error: string) => void;
};

const resolveIceServers = () => {
  const local = localStorage.getItem("webrtcIceServers") || "";
  const env = (import.meta as any).env?.VITE_WEBRTC_ICE_SERVERS || "";
  const raw = local || env;
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const WebRtcPlayer: React.FC<WebRtcPlayerProps> = ({
  whepUrl,
  autoPlay = true,
  onError,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<
    "idle" | "loading" | "playing" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const cleanup = () => {
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((sender) => sender.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const waitForIceComplete = (pc: RTCPeerConnection) =>
    new Promise<void>((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const handler = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", handler);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", handler);
    });

  const start = async () => {
    if (!whepUrl) {
      const msg = "WebRTC URL yo'q";
      setError(msg);
      setStatus("error");
      onError?.(msg);
      return;
    }
    cleanup();
    setStatus("loading");
    setError(null);
    try {
      const iceServers = resolveIceServers();
      const pc = new RTCPeerConnection(iceServers ? { iceServers } : undefined);
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (videoRef.current) {
          const [stream] = event.streams;
          videoRef.current.srcObject = stream;
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await waitForIceComplete(pc);

      const response = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: pc.localDescription?.sdp || "",
      });

      if (!response.ok) {
        throw new Error(`WHEP error: ${response.status}`);
      }

      const answerSdp = await response.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setStatus("playing");
    } catch (err: any) {
      const msg = err?.message || "WebRTC xatolik";
      setError(msg);
      setStatus("error");
      onError?.(msg);
    }
  };

  useEffect(() => {
    if (autoPlay) {
      start();
    }
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whepUrl]);

  if (!whepUrl) {
    return <Alert type="warning" message="WebRTC URL sozlanmagan" />;
  }

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={8}>
      <video
        ref={videoRef}
        style={{ width: "100%", borderRadius: 8, background: "#000" }}
        playsInline
        autoPlay
        muted
        controls
      />
      <Space>
        <Button size="small" onClick={start} loading={status === "loading"}>
          Qayta ulash
        </Button>
        <Text type="secondary">
          Holat: {status === "playing" ? "Jonli" : status}
        </Text>
      </Space>
      {error && <Alert type="error" message={error} />}
    </Space>
  );
};

export default WebRtcPlayer;

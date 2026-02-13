import React from "react";
import { Modal, Space, Tag, Typography } from "antd";
import { HlsPlayer, WebRtcPlayer } from "../shared/ui";
import { buildHlsUrl, buildWebrtcWhepUrl } from "@shared/config";
import type { Camera, CameraStreamInfo } from "@shared/types";

const { Text } = Typography;

type CamerasPreviewModalProps = {
  selectedCamera: Camera | null;
  streamInfo: CameraStreamInfo | null;
  webrtcConfigVersion: number;
  snapshotTick: number;
  onClose: () => void;
};

export const CamerasPreviewModal: React.FC<CamerasPreviewModalProps> = ({
  selectedCamera,
  streamInfo,
  webrtcConfigVersion,
  snapshotTick,
  onClose,
}) => (
  <Modal
    open={!!selectedCamera}
    onCancel={onClose}
    title={
      <Space>
        {selectedCamera?.name}
        {streamInfo?.codec && <Tag color={streamInfo.isH265 ? "orange" : "green"}>{streamInfo.codec}</Tag>}
      </Space>
    }
    footer={null}
    width={720}
  >
    {selectedCamera ? (
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {streamInfo?.isH265 ? (
          streamInfo?.webrtcPath && (
            <HlsPlayer key={`hls-${selectedCamera.id}-${webrtcConfigVersion}`} hlsUrl={buildHlsUrl(streamInfo.webrtcPath)} onError={(err) => console.log("HLS error:", err)} />
          )
        ) : streamInfo?.webrtcPath ? (
          <WebRtcPlayer key={`webrtc-${selectedCamera.id}-${webrtcConfigVersion}`} whepUrl={buildWebrtcWhepUrl(streamInfo.webrtcPath)} onError={(err) => console.log("WebRTC error:", err)} />
        ) : (
          streamInfo?.webrtcPath && (
            <HlsPlayer key={`hls-${selectedCamera.id}-${webrtcConfigVersion}`} hlsUrl={buildHlsUrl(streamInfo.webrtcPath)} onError={(err) => console.log("HLS error:", err)} />
          )
        )}

        {!streamInfo?.webrtcPath && selectedCamera.snapshotUrl && (
          <img src={`${selectedCamera.snapshotUrl}?t=${snapshotTick}`} alt={selectedCamera.name} style={{ width: "100%", borderRadius: 6 }} />
        )}

        <Space direction="vertical" size={4}>
          {streamInfo?.codec && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Codec: {streamInfo.codec} | Player: {streamInfo.recommendedPlayer?.toUpperCase()}
            </Text>
          )}
          {streamInfo?.rtspUrl && <Text type="secondary" style={{ fontSize: 12 }}>RTSP: {streamInfo.rtspUrl}</Text>}
          {streamInfo?.hlsUrl && <Text type="secondary" style={{ fontSize: 12 }}>HLS: {streamInfo.hlsUrl}</Text>}
        </Space>

        {!streamInfo?.webrtcPath && !selectedCamera.snapshotUrl && (
          <Text type="secondary">Stream sozlanmagan. MediaMTX server va path to'g'ri bo'lishi kerak.</Text>
        )}
      </Space>
    ) : null}
  </Modal>
);

import React from "react";
import { Alert, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Switch, Typography } from "antd";
import type { Nvr } from "@shared/types";

const { Text } = Typography;

type CamerasOperationModalsProps = {
  syncModalOpen: boolean;
  setSyncModalOpen: (open: boolean) => void;
  handleSync: () => void;
  syncTarget: Nvr | null;
  syncPayload: string;
  setSyncPayload: (value: string) => void;
  healthModalOpen: boolean;
  setHealthModalOpen: (open: boolean) => void;
  healthData: any;
  syncResultOpen: boolean;
  setSyncResultOpen: (open: boolean) => void;
  syncResult: any;
  webrtcSettingsOpen: boolean;
  setWebrtcSettingsOpen: (open: boolean) => void;
  saveWebrtcSettings: () => void;
  webrtcSettingsValue: string;
  setWebrtcSettingsValue: (value: string) => void;
  webrtcSettingsError: string | null;
  deployModalOpen: boolean;
  setDeployModalOpen: (open: boolean) => void;
  handleDeployMediaMtx: () => void;
  deployScope: "nvr" | "school";
  deployTarget: Nvr | null;
  deployForm: any;
};

export const CamerasOperationModals: React.FC<CamerasOperationModalsProps> = ({
  syncModalOpen,
  setSyncModalOpen,
  handleSync,
  syncTarget,
  syncPayload,
  setSyncPayload,
  healthModalOpen,
  setHealthModalOpen,
  healthData,
  syncResultOpen,
  setSyncResultOpen,
  syncResult,
  webrtcSettingsOpen,
  setWebrtcSettingsOpen,
  saveWebrtcSettings,
  webrtcSettingsValue,
  setWebrtcSettingsValue,
  webrtcSettingsError,
  deployModalOpen,
  setDeployModalOpen,
  handleDeployMediaMtx,
  deployScope,
  deployTarget,
  deployForm,
}) => (
  <>
    <Modal open={syncModalOpen} onCancel={() => setSyncModalOpen(false)} onOk={handleSync} title={syncTarget ? `Sync: ${syncTarget.name}` : "Sync"} okText="Yuborish" width={720}>
      <Space direction="vertical" style={{ width: "100%" }} size={8}>
        <Text type="secondary">JSON formatidagi areas va cameras payloadini kiriting.</Text>
        <Input.TextArea rows={10} value={syncPayload} onChange={(e) => setSyncPayload(e.target.value)} />
      </Space>
    </Modal>

    <Modal open={healthModalOpen} onCancel={() => setHealthModalOpen(false)} footer={null} title="NVR Health">
      {healthData ? (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Status">{healthData.status}</Descriptions.Item>
          <Descriptions.Item label="Host">{healthData.health?.host}</Descriptions.Item>
          <Descriptions.Item label="HTTP">{healthData.health?.http?.ok ? "OK" : "FAIL"}</Descriptions.Item>
          <Descriptions.Item label="ONVIF">{healthData.health?.onvif?.ok ? "OK" : "FAIL"}</Descriptions.Item>
          <Descriptions.Item label="RTSP">{healthData.health?.rtsp?.ok ? "OK" : "FAIL"}</Descriptions.Item>
        </Descriptions>
      ) : null}
    </Modal>

    <Modal open={syncResultOpen} onCancel={() => setSyncResultOpen(false)} footer={null} title="ONVIF Sync">
      {syncResult ? (
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Created">{syncResult.stats?.created ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Updated">{syncResult.stats?.updated ?? 0}</Descriptions.Item>
          <Descriptions.Item label="Total">{syncResult.stats?.total ?? 0}</Descriptions.Item>
        </Descriptions>
      ) : null}
    </Modal>

    <Modal open={webrtcSettingsOpen} onCancel={() => setWebrtcSettingsOpen(false)} onOk={saveWebrtcSettings} okText="Saqlash" title="WebRTC ICE Servers">
      <Space direction="vertical" style={{ width: "100%" }} size={8}>
        <Text type="secondary">JSON array kiriting. Misol: [{"{"} "urls": "stun:stun.l.google.com:19302" {"}"}]</Text>
        <Input.TextArea rows={6} value={webrtcSettingsValue} onChange={(e) => setWebrtcSettingsValue(e.target.value)} placeholder='[{"urls":"stun:stun.l.google.com:19302"}]' />
        {webrtcSettingsError && <Alert type="error" message={webrtcSettingsError} />}
      </Space>
    </Modal>

    <Modal
      open={deployModalOpen}
      onCancel={() => setDeployModalOpen(false)}
      onOk={handleDeployMediaMtx}
      okText="Deploy"
      title={deployScope === "school" ? "MediaMTX Deploy (School)" : `MediaMTX Deploy (${deployTarget?.name || "NVR"})`}
    >
      <Form layout="vertical" form={deployForm}>
        <Form.Item name="mode" label="Deploy mode" rules={[{ required: true }]}>
          <Select options={[{ value: "local", label: "Local" }, { value: "ssh", label: "SSH" }, { value: "docker", label: "Docker" }]} />
        </Form.Item>
        <Form.Item name="autoDeployOnSave" label="Kamera saqlanganida avtomatik deploy" valuePropName="checked" tooltip="Kamera qo'shilganida yoki yangilanganida MediaMTX config avtomatik yangilanadi">
          <Switch />
        </Form.Item>
        <Form.Item shouldUpdate>
          {({ getFieldValue }) =>
            getFieldValue("mode") === "local" ? (
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <Form.Item name="localPath" label="Local config path" rules={[{ required: true }]}><Input /></Form.Item>
                <Form.Item name="localRestartCommand" label="Restart command (optional)">
                  <Input placeholder='taskkill /IM mediamtx.exe /F && start "" "d:\\projects-advanced\\school\\tools\\mediamtx\\mediamtx.exe" "d:\\projects-advanced\\school\\tools\\mediamtx\\mediamtx.yml"' />
                </Form.Item>
              </Space>
            ) : getFieldValue("mode") === "ssh" ? (
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <Form.Item name="sshHost" label="SSH Host" rules={[{ required: true }]}><Input placeholder="192.168.1.200" /></Form.Item>
                <Form.Item name="sshPort" label="SSH Port"><InputNumber min={1} max={65535} style={{ width: "100%" }} /></Form.Item>
                <Form.Item name="sshUser" label="SSH User" rules={[{ required: true }]}><Input placeholder="root" /></Form.Item>
                <Form.Item name="sshRemotePath" label="Remote config path" rules={[{ required: true }]}><Input placeholder="/etc/mediamtx.yml" /></Form.Item>
                <Form.Item name="sshRestartCommand" label="Restart command"><Input placeholder="systemctl restart mediamtx" /></Form.Item>
              </Space>
            ) : (
              <Space direction="vertical" style={{ width: "100%" }} size={8}>
                <Form.Item name="dockerContainer" label="Docker container" rules={[{ required: true }]}><Input placeholder="mediamtx" /></Form.Item>
                <Form.Item name="dockerConfigPath" label="Config path" rules={[{ required: true }]}><Input placeholder="/mediamtx.yml" /></Form.Item>
                <Form.Item name="dockerRestart" label="Restart container" valuePropName="checked"><Switch /></Form.Item>
              </Space>
            )
          }
        </Form.Item>
      </Form>
    </Modal>
  </>
);

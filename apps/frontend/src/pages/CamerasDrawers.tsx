import React from "react";
import { Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch } from "antd";
import type { Camera, CameraArea, Nvr } from "@shared/types";
import { RTSP_VENDOR_OPTIONS } from "./cameras.utils";

type CamerasDrawersProps = {
  nvrDrawerOpen: boolean;
  areaDrawerOpen: boolean;
  cameraDrawerOpen: boolean;
  editingNvr: Nvr | null;
  editingArea: CameraArea | null;
  editingCamera: Camera | null;
  nvrForm: any;
  areaForm: any;
  cameraForm: any;
  onCloseNvr: () => void;
  onCloseArea: () => void;
  onCloseCamera: () => void;
  handleSaveNvr: () => void;
  handleSaveArea: () => void;
  handleSaveCamera: () => void;
  nvrs: Nvr[];
  areas: CameraArea[];
  autoGenerateUrl: boolean;
  streamUrlMode: string;
  rtspPreview: string;
};

export const CamerasDrawers: React.FC<CamerasDrawersProps> = ({
  nvrDrawerOpen,
  areaDrawerOpen,
  cameraDrawerOpen,
  editingNvr,
  editingArea,
  editingCamera,
  nvrForm,
  areaForm,
  cameraForm,
  onCloseNvr,
  onCloseArea,
  onCloseCamera,
  handleSaveNvr,
  handleSaveArea,
  handleSaveCamera,
  nvrs,
  areas,
  autoGenerateUrl,
  streamUrlMode,
  rtspPreview,
}) => (
  <>
    <Drawer open={nvrDrawerOpen} onClose={onCloseNvr} title={editingNvr ? "NVR tahrirlash" : "NVR qo'shish"} width={520} extra={<Button type="primary" onClick={handleSaveNvr}>Saqlash</Button>}>
      <Form layout="vertical" form={nvrForm}>
        <Form.Item name="name" label="NVR nomi" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="vendor" label="Vendor" tooltip="RTSP URL formati vendor ga qarab o'zgaradi">
          <Select allowClear placeholder="Vendor tanlang" options={[{ value: "hikvision", label: "Hikvision" }, { value: "dahua", label: "Dahua" }, { value: "seetong", label: "Seetong" }, { value: "generic", label: "Generic ONVIF" }]} />
        </Form.Item>
        <Form.Item name="model" label="Model"><Input /></Form.Item>
        <Form.Item name="host" label="Host" rules={[{ required: true }]}><Input placeholder="192.168.1.50" /></Form.Item>
        <Space size={12} style={{ width: "100%" }}>
          <Form.Item name="httpPort" label="HTTP Port" style={{ flex: 1 }}><InputNumber min={1} max={65535} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="onvifPort" label="ONVIF Port" style={{ flex: 1 }}><InputNumber min={1} max={65535} style={{ width: "100%" }} /></Form.Item>
          <Form.Item name="rtspPort" label="RTSP Port" style={{ flex: 1 }}><InputNumber min={1} max={65535} style={{ width: "100%" }} /></Form.Item>
        </Space>
        <Form.Item name="username" label="Username" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="password" label="Password" rules={editingNvr ? [] : [{ required: true }]}>
          <Input.Password placeholder={editingNvr ? "O'zgartirmaslik uchun bo'sh qoldiring" : undefined} />
        </Form.Item>
        <Form.Item name="protocol" label="Protokol" rules={[{ required: true }]}><Select options={[{ value: "ONVIF", label: "ONVIF" }, { value: "RTSP", label: "RTSP" }, { value: "HYBRID", label: "HYBRID" }]} /></Form.Item>
        <Form.Item name="isActive" label="Faol" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Drawer>

    <Drawer open={areaDrawerOpen} onClose={onCloseArea} title={editingArea ? "Hudud tahrirlash" : "Hudud qo'shish"} width={420} extra={<Button type="primary" onClick={handleSaveArea}>Saqlash</Button>}>
      <Form layout="vertical" form={areaForm}>
        <Form.Item name="name" label="Hudud nomi" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="description" label="Izoh"><Input.TextArea rows={3} /></Form.Item>
        <Form.Item name="nvrId" label="NVR">
          <Select allowClear options={nvrs.map((nvr) => ({ value: nvr.id, label: `${nvr.name} (${nvr.host})` }))} />
        </Form.Item>
        <Form.Item name="externalId" label="External ID"><Input /></Form.Item>
      </Form>
    </Drawer>

    <Drawer open={cameraDrawerOpen} onClose={onCloseCamera} title={editingCamera ? "Kamera tahrirlash" : "Kamera qo'shish"} width={520} extra={<Button type="primary" onClick={handleSaveCamera}>Saqlash</Button>}>
      <Form layout="vertical" form={cameraForm}>
        <Form.Item name="name" label="Kamera nomi" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="nvrId" label="NVR"><Select allowClear placeholder="NVR tanlang (avtomatik URL uchun)" options={nvrs.map((nvr) => ({ value: nvr.id, label: `${nvr.name} (${nvr.host})` }))} /></Form.Item>
        <Form.Item name="areaId" label="Hudud"><Select allowClear options={areas.map((area) => ({ value: area.id, label: area.name }))} /></Form.Item>
        <Form.Item name="channelNo" label="Kanal raqami" tooltip="NVR'dagi kamera kanali (1, 2, 3...)"><InputNumber min={1} style={{ width: "100%" }} placeholder="1" /></Form.Item>
        <Form.Item name="streamProfile" label="Stream sifati" tooltip="main - yuqori sifat (H.265), sub - past sifat (H.264)">
          <Select options={[{ value: "main", label: "Main (Yuqori sifat - H.265)" }, { value: "sub", label: "Sub (Past sifat - H.264, WebRTC uchun)" }]} />
        </Form.Item>
        <Form.Item name="autoGenerateUrl" label="URL avtomatik yaratish" valuePropName="checked" tooltip="NVR va kanal asosida URL avtomatik generatsiya qilinadi"><Switch /></Form.Item>
        <Form.Item name="streamUrlMode" label="RTSP kirish usuli" tooltip="Qismlardan yig'ish yoki to'liq URL kiriting"><Select disabled={autoGenerateUrl} options={[{ value: "parts", label: "Qismlardan yig'ish" }, { value: "full", label: "To'liq URL" }]} /></Form.Item>
        {streamUrlMode === "parts" ? (
          <>
            <Form.Item name="streamVendor" label="Qurilma turi"><Select disabled={autoGenerateUrl} options={RTSP_VENDOR_OPTIONS} /></Form.Item>
            <Form.Item name="rtspHost" label="Host / IP"><Input disabled={autoGenerateUrl} placeholder="192.168.1.10" /></Form.Item>
            <Form.Item name="rtspPort" label="RTSP Port"><InputNumber min={1} max={65535} style={{ width: "100%" }} disabled={autoGenerateUrl} placeholder="554" /></Form.Item>
            <Form.Item name="rtspUsername" label="RTSP User"><Input disabled={autoGenerateUrl} placeholder="admin" /></Form.Item>
            <Form.Item name="rtspPassword" label="RTSP Parol"><Input.Password disabled={autoGenerateUrl} /></Form.Item>
            <Alert type="info" showIcon message="Yig'ilgan RTSP URL" description={rtspPreview || "Ma'lumotlar to'liq emas"} />
          </>
        ) : (
          <Form.Item name="streamUrl" label="Stream URL" tooltip="Avtomatik yaratish o'chirilgan bo'lsa, to'liq RTSP URL kiriting">
            <Input disabled={autoGenerateUrl} placeholder="rtsp://user:pass@192.168.1.1:554/ch1/main/av_stream" />
          </Form.Item>
        )}
        <Form.Item name="externalId" label="External ID" tooltip="Tashqi tizim bilan integratsiya uchun"><Input placeholder="cam-001" /></Form.Item>
        <Form.Item name="status" label="Status" rules={[{ required: true }]}><Select options={[{ value: "ONLINE", label: "🟢 ONLINE" }, { value: "OFFLINE", label: "🔴 OFFLINE" }, { value: "UNKNOWN", label: "⚪ UNKNOWN" }]} /></Form.Item>
        <Form.Item name="isActive" label="Faol" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Drawer>
  </>
);

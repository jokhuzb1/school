import { Badge, Button, Popconfirm, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Camera, CameraArea, Nvr } from "@shared/types";
import { getStatusBadge } from "../entities/camera";
import { getNvrStatusTag } from "./cameras.utils";

const { Text } = Typography;

type BuildCamerasColumnsParams = {
  canManage: boolean;
  nvrs: Nvr[];
  camerasWithArea: Camera[];
  handleTestNvr: (nvr: Nvr) => void;
  handleOnvifSync: (nvr: Nvr) => void;
  handleDownloadMediaMtx: (nvr: Nvr) => void;
  openDeployModal: (scope: "nvr" | "school", nvr?: Nvr) => void;
  openSyncModal: (nvr?: Nvr) => void;
  openNvrDrawer: (nvr?: Nvr) => void;
  handleDeleteNvr: (nvr: Nvr) => void;
  openAreaDrawer: (area?: CameraArea) => void;
  handleDeleteArea: (area: CameraArea) => void;
  handleTestCameraStream: (camera: Camera) => void;
  openCameraDrawer: (camera?: Camera) => void;
  handleDeleteCamera: (camera: Camera) => void;
};

export const buildCamerasColumns = ({
  canManage,
  nvrs,
  camerasWithArea,
  handleTestNvr,
  handleOnvifSync,
  handleDownloadMediaMtx,
  openDeployModal,
  openSyncModal,
  openNvrDrawer,
  handleDeleteNvr,
  openAreaDrawer,
  handleDeleteArea,
  handleTestCameraStream,
  openCameraDrawer,
  handleDeleteCamera,
}: BuildCamerasColumnsParams): {
  nvrColumns: ColumnsType<Nvr>;
  areaColumns: ColumnsType<CameraArea>;
  cameraColumns: ColumnsType<Camera>;
} => {
  const nvrColumns: ColumnsType<Nvr> = [
    {
      title: "NVR",
      dataIndex: "name",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.vendor || "-"} {record.model ? `(${record.model})` : ""}
          </Text>
        </Space>
      ),
    },
    {
      title: "Host",
      dataIndex: "host",
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Text>{value}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            HTTP:{record.httpPort} ONVIF:{record.onvifPort} RTSP:{record.rtspPort}
          </Text>
        </Space>
      ),
    },
    { title: "Protokol", dataIndex: "protocol", render: (value) => <Tag color="blue">{value}</Tag> },
    {
      title: "Holat",
      dataIndex: "lastHealthStatus",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          {getNvrStatusTag(record.lastHealthStatus)}
          {record.lastHealthCheckAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {dayjs(record.lastHealthCheckAt).format("DD MMM, HH:mm")}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Sync",
      dataIndex: "lastSyncAt",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.lastSyncStatus || "-"}
          </Text>
          {record.lastSyncAt && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              {dayjs(record.lastSyncAt).format("DD MMM, HH:mm")}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: "Amallar",
      dataIndex: "actions",
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => handleTestNvr(record)}>Test</Button>
          <Button size="small" onClick={() => handleOnvifSync(record)}>ONVIF Sync</Button>
          <Button size="small" onClick={() => handleDownloadMediaMtx(record)}>MediaMTX Config</Button>
          <Button size="small" onClick={() => openDeployModal("nvr", record)}>Deploy</Button>
          <Button size="small" onClick={() => openSyncModal(record)}>Sync</Button>
          {canManage && <Button size="small" onClick={() => openNvrDrawer(record)}>Tahrirlash</Button>}
          {canManage && (
            <Popconfirm title="NVR o'chirilsinmi?" onConfirm={() => handleDeleteNvr(record)}>
              <Button size="small" danger>O'chirish</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const areaColumns: ColumnsType<CameraArea> = [
    {
      title: "Hudud",
      dataIndex: "name",
      render: (value, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description || "-"}</Text>
        </Space>
      ),
    },
    {
      title: "NVR",
      dataIndex: "nvrId",
      render: (value) => (value ? nvrs.find((nvr) => nvr.id === value)?.name || value : "-"),
    },
    {
      title: "Kameralar",
      dataIndex: "_count",
      render: (_, record) => {
        const count = record._count?.cameras ?? camerasWithArea.filter((c) => c.areaId === record.id).length;
        return <Badge count={count} />;
      },
    },
    {
      title: "Amallar",
      dataIndex: "actions",
      render: (_, record) => (
        <Space>
          {canManage && <Button size="small" onClick={() => openAreaDrawer(record)}>Tahrirlash</Button>}
          {canManage && (
            <Popconfirm title="Hudud o'chirilsinmi?" onConfirm={() => handleDeleteArea(record)}>
              <Button size="small" danger>O'chirish</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const cameraColumns: ColumnsType<Camera> = [
    {
      title: "Kamera",
      dataIndex: "name",
      render: (_, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{canManage ? record.streamUrl || "-" : "-"}</Text>
        </Space>
      ),
    },
    { title: "Hudud", dataIndex: "areaId", render: (_, record) => record.area?.name || "-" },
    {
      title: "NVR",
      dataIndex: "nvrId",
      render: (value) => (value ? nvrs.find((nvr) => nvr.id === value)?.name || value : "-"),
    },
    { title: "Status", dataIndex: "status", render: (value) => <Tag color={getStatusBadge(value).color}>{getStatusBadge(value).text}</Tag> },
    { title: "Channel", dataIndex: "channelNo", render: (value) => value || "-" },
    {
      title: "Amallar",
      dataIndex: "actions",
      render: (_, record) => (
        <Space>
          {canManage && <Button size="small" type="default" onClick={() => handleTestCameraStream(record)}>Test</Button>}
          {canManage && <Button size="small" onClick={() => openCameraDrawer(record)}>Tahrirlash</Button>}
          {canManage && (
            <Popconfirm title="Kamera o'chirilsinmi?" onConfirm={() => handleDeleteCamera(record)}>
              <Button size="small" danger>O'chirish</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return { nvrColumns, areaColumns, cameraColumns };
};

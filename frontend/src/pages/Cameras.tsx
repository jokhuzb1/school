import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { VideoCameraOutlined } from "@ant-design/icons";
import { useSchool } from "../hooks/useSchool";
import {
  PageHeader,
  StatItem,
  WebRtcPlayer,
  HlsPlayer,
  useHeaderMeta,
} from "../shared/ui";
import type { Camera, CameraArea, CameraStreamInfo, Nvr } from "../types";
import { cameraApi, CAMERA_API_MODE, getStatusBadge } from "../entities/camera";
import {
  CAMERA_SNAPSHOT_REFRESH_MS,
  buildHlsUrl,
  buildWebrtcWhepUrl,
} from "../config";
import dayjs from "dayjs";

const { Text } = Typography;

const DEFAULT_SYNC_SAMPLE = {
  areas: [{ name: "Entrance", externalId: "area-1" }],
  cameras: [
    {
      name: "Gate Cam",
      externalId: "cam-001",
      channelNo: 1,
      streamUrl: "rtsp://user:pass@192.168.1.50:554/Streaming/Channels/101",
      status: "ONLINE",
      areaExternalId: "area-1",
    },
  ],
};

const getErrorMessage = (err: any) =>
  err?.response?.data?.error || err?.message || "Xatolik";

const getNvrStatusTag = (status?: string | null) => {
  if (status === "ok") return <Tag color="green">OK</Tag>;
  if (status === "partial") return <Tag color="orange">Partial</Tag>;
  if (status === "offline") return <Tag color="red">Offline</Tag>;
  return <Tag color="gray">Unknown</Tag>;
};

const Cameras: React.FC = () => {
  const { schoolId, isSchoolAdmin, isSuperAdmin } = useSchool();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const [areas, setAreas] = useState<CameraArea[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [nvrs, setNvrs] = useState<Nvr[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAreaId, setSelectedAreaId] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [streamInfo, setStreamInfo] = useState<CameraStreamInfo | null>(null);
  const [snapshotTick, setSnapshotTick] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [activeTab, setActiveTab] = useState("overview");

  const [nvrDrawerOpen, setNvrDrawerOpen] = useState(false);
  const [editingNvr, setEditingNvr] = useState<Nvr | null>(null);
  const [areaDrawerOpen, setAreaDrawerOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<CameraArea | null>(null);
  const [cameraDrawerOpen, setCameraDrawerOpen] = useState(false);
  const [editingCamera, setEditingCamera] = useState<Camera | null>(null);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncTarget, setSyncTarget] = useState<Nvr | null>(null);
  const [syncPayload, setSyncPayload] = useState(
    JSON.stringify(DEFAULT_SYNC_SAMPLE, null, 2),
  );
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncResultOpen, setSyncResultOpen] = useState(false);
  const [webrtcSettingsOpen, setWebrtcSettingsOpen] = useState(false);
  const [webrtcSettingsValue, setWebrtcSettingsValue] = useState("");
  const [webrtcSettingsError, setWebrtcSettingsError] = useState<string | null>(
    null,
  );
  const [webrtcConfigVersion, setWebrtcConfigVersion] = useState(0);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployTarget, setDeployTarget] = useState<Nvr | null>(null);
  const [deployScope, setDeployScope] = useState<"nvr" | "school">("nvr");

  const [nvrForm] = Form.useForm();
  const [areaForm] = Form.useForm();
  const [cameraForm] = Form.useForm();
  const [deployForm] = Form.useForm();

  const canManage = isSchoolAdmin || isSuperAdmin;

  const getWebrtcSettingsRaw = () =>
    localStorage.getItem("webrtcIceServers") ||
    (import.meta as any).env?.VITE_WEBRTC_ICE_SERVERS ||
    "";

  const openWebrtcSettings = () => {
    setWebrtcSettingsValue(getWebrtcSettingsRaw());
    setWebrtcSettingsError(null);
    setWebrtcSettingsOpen(true);
  };

  const saveWebrtcSettings = () => {
    const raw = webrtcSettingsValue.trim();
    if (!raw) {
      localStorage.removeItem("webrtcIceServers");
      setWebrtcSettingsOpen(false);
      setWebrtcConfigVersion((v) => v + 1);
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        setWebrtcSettingsError("JSON array bo'lishi kerak");
        return;
      }
      localStorage.setItem("webrtcIceServers", raw);
      setWebrtcSettingsOpen(false);
      setWebrtcConfigVersion((v) => v + 1);
    } catch {
      setWebrtcSettingsError("JSON format noto'g'ri");
    }
  };

  const getSavedDeploySettings = (): any => {
    try {
      const raw = localStorage.getItem("mediamtxDeploySettings");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const openDeployModal = (scope: "nvr" | "school", nvr?: Nvr) => {
    setDeployScope(scope);
    setDeployTarget(nvr || null);
    const saved = getSavedDeploySettings();
    deployForm.resetFields();
    deployForm.setFieldsValue({
      mode: saved.mode || "local",
      autoDeployOnSave: saved.autoDeployOnSave ?? false,
      sshHost: saved.sshHost || "",
      sshPort: saved.sshPort || 22,
      sshUser: saved.sshUser || "",
      sshRemotePath: saved.sshRemotePath || "/etc/mediamtx.yml",
      sshRestartCommand:
        saved.sshRestartCommand || "systemctl restart mediamtx",
      dockerContainer: saved.dockerContainer || "",
      dockerConfigPath: saved.dockerConfigPath || "/mediamtx.yml",
      dockerRestart: saved.dockerRestart !== false,
      localPath:
        saved.localPath ||
        "d:\\projects-advanced\\school\\tools\\mediamtx\\mediamtx.yml",
      localRestartCommand:
        saved.localRestartCommand ||
        "d:\\projects-advanced\\school\\tools\\mediamtx\\restart-mediamtx.bat",
    });
    setDeployModalOpen(true);
  };

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [areasData, camerasData, nvrsData] = await Promise.all([
        cameraApi.getAreas(schoolId),
        cameraApi.getCameras(schoolId),
        cameraApi.getNvrs(schoolId),
      ]);
      setAreas(areasData);
      setCameras(camerasData);
      setNvrs(nvrsData);
      setLastUpdated(new Date());
    } catch (err) {
      message.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [schoolId, setLastUpdated]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setRefresh(load);
    return () => setRefresh(null);
  }, [load, setRefresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSnapshotTick((t) => t + 1);
    }, CAMERA_SNAPSHOT_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadStream = async () => {
      if (!selectedCamera) {
        setStreamInfo(null);
        return;
      }
      try {
        const data = await cameraApi.getCameraStream(selectedCamera.id);
        setStreamInfo(data);
      } catch (err) {
        setStreamInfo(null);
      }
    };
    loadStream();
  }, [selectedCamera]);

  const areaMap = useMemo(() => {
    const map = new Map<string, CameraArea>();
    areas.forEach((area) => map.set(area.id, area));
    return map;
  }, [areas]);

  const camerasWithArea = useMemo(() => {
    return cameras.map((c) => {
      if (c.area || !c.areaId) return c;
      return { ...c, area: areaMap.get(c.areaId) };
    });
  }, [cameras, areaMap]);

  const filtered = useMemo(() => {
    return camerasWithArea.filter((c) => {
      const areaName = c.area?.name?.toLowerCase() || "";
      const matchesArea =
        selectedAreaId === "__classrooms__"
          ? areaName.includes("sinf")
          : selectedAreaId
            ? c.areaId === selectedAreaId
            : true;
      const matchesSearch = search
        ? c.name.toLowerCase().includes(search.toLowerCase())
        : true;
      return matchesArea && matchesSearch;
    });
  }, [camerasWithArea, selectedAreaId, search]);

  useEffect(() => {
    setPage(1);
  }, [selectedAreaId, search]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const stats = useMemo(() => {
    const total = camerasWithArea.length;
    const online = camerasWithArea.filter((c) => c.status === "ONLINE").length;
    const offline = camerasWithArea.filter(
      (c) => c.status === "OFFLINE",
    ).length;
    return { total, online, offline };
  }, [camerasWithArea]);

  const openNvrDrawer = (nvr?: Nvr) => {
    setEditingNvr(nvr || null);
    nvrForm.resetFields();
    if (nvr) {
      nvrForm.setFieldsValue({
        name: nvr.name,
        vendor: nvr.vendor,
        model: nvr.model,
        host: nvr.host,
        httpPort: nvr.httpPort,
        onvifPort: nvr.onvifPort,
        rtspPort: nvr.rtspPort,
        username: nvr.username,
        protocol: nvr.protocol,
        isActive: nvr.isActive,
      });
    } else {
      nvrForm.setFieldsValue({
        protocol: "ONVIF",
        httpPort: 80,
        onvifPort: 80,
        rtspPort: 554,
        isActive: true,
      });
    }
    setNvrDrawerOpen(true);
  };

  const openAreaDrawer = (area?: CameraArea) => {
    setEditingArea(area || null);
    areaForm.resetFields();
    if (area) {
      areaForm.setFieldsValue({
        name: area.name,
        description: area.description,
        nvrId: area.nvrId || undefined,
        externalId: area.externalId || undefined,
      });
    }
    setAreaDrawerOpen(true);
  };

  const openCameraDrawer = (camera?: Camera) => {
    setEditingCamera(camera || null);
    cameraForm.resetFields();
    if (camera) {
      cameraForm.setFieldsValue({
        name: camera.name,
        nvrId: camera.nvrId || undefined,
        areaId: camera.areaId || undefined,
        externalId: camera.externalId || undefined,
        channelNo: camera.channelNo || undefined,
        streamUrl: camera.streamUrl || undefined,
        streamProfile: camera.streamProfile || "main",
        autoGenerateUrl: camera.autoGenerateUrl ?? true,
        status: camera.status,
        isActive: camera.isActive ?? true,
      });
    } else {
      cameraForm.setFieldsValue({
        status: "UNKNOWN",
        isActive: true,
        streamProfile: "sub", // Default: H.264 for WebRTC compatibility
        autoGenerateUrl: true,
      });
    }
    setCameraDrawerOpen(true);
  };

  const handleSaveNvr = async () => {
    if (!schoolId) return;
    try {
      const values = await nvrForm.validateFields();
      const payload = { ...values } as Record<string, any>;
      if (!payload.password) delete payload.password;
      if (editingNvr) {
        await cameraApi.updateNvr(editingNvr.id, payload);
        message.success("NVR yangilandi");
      } else {
        await cameraApi.createNvr(schoolId, payload);
        message.success("NVR qo'shildi");
      }
      setNvrDrawerOpen(false);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleSaveArea = async () => {
    if (!schoolId) return;
    try {
      const values = await areaForm.validateFields();
      const payload = { ...values } as Record<string, any>;
      if (editingArea) {
        await cameraApi.updateArea(editingArea.id, payload);
        message.success("Hudud yangilandi");
      } else {
        await cameraApi.createArea(schoolId, payload);
        message.success("Hudud qo'shildi");
      }
      setAreaDrawerOpen(false);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleSaveCamera = async () => {
    if (!schoolId) return;
    try {
      const values = await cameraForm.validateFields();
      const payload = { ...values } as Record<string, any>;
      if (editingCamera) {
        await cameraApi.updateCamera(editingCamera.id, payload);
        message.success("Kamera yangilandi");
      } else {
        await cameraApi.createCamera(schoolId, payload);
        message.success("Kamera qo'shildi");
      }
      setCameraDrawerOpen(false);
      await load();

      // Avtomatik MediaMTX deploy
      const saved = getSavedDeploySettings();
      if (saved.autoDeployOnSave) {
        try {
          await cameraApi.deploySchoolMediaMtx(schoolId, saved);
          message.success("MediaMTX config avtomatik yangilandi");
        } catch (deployErr) {
          message.warning("Kamera saqlandi, lekin MediaMTX deploy xatosi");
        }
      }
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleDeleteNvr = async (nvr: Nvr) => {
    try {
      await cameraApi.deleteNvr(nvr.id);
      message.success("NVR o'chirildi");
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleDeleteArea = async (area: CameraArea) => {
    try {
      await cameraApi.deleteArea(area.id);
      message.success("Hudud o'chirildi");
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleDeleteCamera = async (camera: Camera) => {
    try {
      await cameraApi.deleteCamera(camera.id);
      message.success("Kamera o'chirildi");
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleTestCameraStream = async (camera: Camera) => {
    try {
      message.loading({
        content: "Stream test qilinmoqda...",
        key: "stream-test",
      });
      const result = await cameraApi.testCameraStream(camera.id);
      if (result.success) {
        message.success({
          content: `✅ ${result.message}`,
          key: "stream-test",
        });
      } else {
        message.error({
          content: `❌ ${result.message || result.error}`,
          key: "stream-test",
        });
      }
    } catch (err) {
      message.error({ content: getErrorMessage(err), key: "stream-test" });
    }
  };

  const handleTestNvr = async (nvr: Nvr) => {
    try {
      const result = await cameraApi.testNvrConnection(nvr.id);
      setHealthData(result);
      setHealthModalOpen(true);
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleOnvifSync = async (nvr: Nvr) => {
    try {
      const result = await cameraApi.onvifSync(nvr.id, {
        overwriteNames: false,
      });
      setSyncResult(result);
      setSyncResultOpen(true);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleDownloadMediaMtx = async (nvr: Nvr) => {
    try {
      const content = await cameraApi.downloadMediaMtxConfig(nvr.id);
      const blob = new Blob([content], { type: "text/yaml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mediamtx_${nvr.id}.yml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success("MediaMTX config yuklandi");
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleDownloadSchoolConfig = async () => {
    if (!schoolId) return;
    try {
      const content = await cameraApi.downloadSchoolMediaMtxConfig(schoolId);
      const blob = new Blob([content], { type: "text/yaml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mediamtx_school_${schoolId}.yml`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      message.success("School MediaMTX config yuklandi");
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleDeployMediaMtx = async () => {
    try {
      const values = await deployForm.validateFields();
      const payload: any = { mode: values.mode };
      if (values.mode === "ssh") {
        payload.ssh = {
          host: values.sshHost,
          port: values.sshPort,
          user: values.sshUser,
          remotePath: values.sshRemotePath,
          restartCommand: values.sshRestartCommand || undefined,
        };
      } else if (values.mode === "docker") {
        payload.docker = {
          container: values.dockerContainer,
          configPath: values.dockerConfigPath,
          restart: values.dockerRestart,
        };
      }

      localStorage.setItem(
        "mediamtxDeploySettings",
        JSON.stringify({
          mode: values.mode,
          sshHost: values.sshHost,
          sshPort: values.sshPort,
          sshUser: values.sshUser,
          sshRemotePath: values.sshRemotePath,
          sshRestartCommand: values.sshRestartCommand,
          dockerContainer: values.dockerContainer,
          dockerConfigPath: values.dockerConfigPath,
          dockerRestart: values.dockerRestart,
          localPath: values.localPath,
          localRestartCommand: values.localRestartCommand,
        }),
      );

      if (values.mode === "local") {
        payload.local = {
          path: values.localPath,
          restartCommand: values.localRestartCommand || undefined,
        };
      }

      if (deployScope === "school") {
        await cameraApi.deploySchoolMediaMtx(schoolId!, payload);
      } else if (deployTarget) {
        await cameraApi.deployMediaMtx(deployTarget.id, payload);
      } else {
        throw new Error("NVR tanlanmagan");
      }

      message.success("MediaMTX deploy bajarildi");
      setDeployModalOpen(false);
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const openSyncModal = (nvr?: Nvr) => {
    setSyncTarget(nvr || null);
    setSyncPayload(JSON.stringify(DEFAULT_SYNC_SAMPLE, null, 2));
    setSyncModalOpen(true);
  };

  const handleSync = async () => {
    if (!syncTarget) {
      message.error("NVR tanlanmagan");
      return;
    }
    try {
      const payload = JSON.parse(syncPayload || "{}");
      await cameraApi.syncNvr(syncTarget.id, payload);
      message.success("Sync bajarildi");
      setSyncModalOpen(false);
      await load();
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

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
            HTTP:{record.httpPort} ONVIF:{record.onvifPort} RTSP:
            {record.rtspPort}
          </Text>
        </Space>
      ),
    },
    {
      title: "Protokol",
      dataIndex: "protocol",
      render: (value) => <Tag color="blue">{value}</Tag>,
    },
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
          <Button size="small" onClick={() => handleTestNvr(record)}>
            Test
          </Button>
          <Button size="small" onClick={() => handleOnvifSync(record)}>
            ONVIF Sync
          </Button>
          <Button size="small" onClick={() => handleDownloadMediaMtx(record)}>
            MediaMTX Config
          </Button>
          <Button size="small" onClick={() => openDeployModal("nvr", record)}>
            Deploy
          </Button>
          <Button size="small" onClick={() => openSyncModal(record)}>
            Sync
          </Button>
          {canManage && (
            <Button size="small" onClick={() => openNvrDrawer(record)}>
              Tahrirlash
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title="NVR o'chirilsinmi?"
              onConfirm={() => handleDeleteNvr(record)}
            >
              <Button size="small" danger>
                O'chirish
              </Button>
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
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description || "-"}
          </Text>
        </Space>
      ),
    },
    {
      title: "NVR",
      dataIndex: "nvrId",
      render: (value) =>
        value ? nvrs.find((nvr) => nvr.id === value)?.name || value : "-",
    },
    {
      title: "Kameralar",
      dataIndex: "_count",
      render: (_, record) => {
        const count =
          record._count?.cameras ??
          camerasWithArea.filter((c) => c.areaId === record.id).length;
        return <Badge count={count} />;
      },
    },
    {
      title: "Amallar",
      dataIndex: "actions",
      render: (_, record) => (
        <Space>
          {canManage && (
            <Button size="small" onClick={() => openAreaDrawer(record)}>
              Tahrirlash
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title="Hudud o'chirilsinmi?"
              onConfirm={() => handleDeleteArea(record)}
            >
              <Button size="small" danger>
                O'chirish
              </Button>
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
          <Text type="secondary" style={{ fontSize: 12 }}>
            {canManage ? record.streamUrl || "-" : "-"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Hudud",
      dataIndex: "areaId",
      render: (_, record) => record.area?.name || "-",
    },
    {
      title: "NVR",
      dataIndex: "nvrId",
      render: (value) =>
        value ? nvrs.find((nvr) => nvr.id === value)?.name || value : "-",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value) => {
        const status = getStatusBadge(value);
        return <Tag color={status.color}>{status.text}</Tag>;
      },
    },
    {
      title: "Channel",
      dataIndex: "channelNo",
      render: (value) => value || "-",
    },
    {
      title: "Amallar",
      dataIndex: "actions",
      render: (_, record) => (
        <Space>
          {canManage && (
            <Button
              size="small"
              type="default"
              onClick={() => handleTestCameraStream(record)}
            >
              Test
            </Button>
          )}
          {canManage && (
            <Button size="small" onClick={() => openCameraDrawer(record)}>
              Tahrirlash
            </Button>
          )}
          {canManage && (
            <Popconfirm
              title="Kamera o'chirilsinmi?"
              onConfirm={() => handleDeleteCamera(record)}
            >
              <Button size="small" danger>
                O'chirish
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const overviewContent = (
    <>
      {loading ? null : filtered.length === 0 ? (
        <Empty description="Kamera topilmadi" />
      ) : (
        <Row gutter={[12, 12]}>
          {paged.map((cam) => {
            const status = getStatusBadge(cam.status);
            return (
              <Col key={cam.id} xs={24} sm={12} md={8} lg={6}>
                <Card
                  hoverable
                  onClick={() => setSelectedCamera(cam)}
                  cover={
                    cam.snapshotUrl ? (
                      <img
                        src={`${cam.snapshotUrl}?t=${snapshotTick}`}
                        alt={cam.name}
                        style={{ height: 140, objectFit: "cover" }}
                      />
                    ) : null
                  }
                  size="small"
                >
                  <Space
                    direction="vertical"
                    size={4}
                    style={{ width: "100%" }}
                  >
                    <Text strong>{cam.name}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {cam.area?.name || "-"}
                    </Text>
                    <Tag color={status.color}>{status.text}</Tag>
                    {cam.lastSeenAt && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Songgi: {dayjs(cam.lastSeenAt).format("DD MMM, HH:mm")}
                      </Text>
                    )}
                  </Space>
                </Card>
              </Col>
            );
          })}
        </Row>
      )}
      {filtered.length > 0 && (
        <div
          style={{ marginTop: 16, display: "flex", justifyContent: "center" }}
        >
          <Pagination
            size="small"
            current={page}
            pageSize={pageSize}
            total={filtered.length}
            showSizeChanger
            pageSizeOptions={[8, 16, 24, 48]}
            onChange={(nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            }}
            showTotal={(total) => `Jami: ${total}`}
          />
        </div>
      )}
    </>
  );

  const nvrContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Space wrap>
        {canManage && (
          <Button type="primary" onClick={() => openNvrDrawer()}>
            NVR qo'shish
          </Button>
        )}
        {canManage && (
          <Button onClick={handleDownloadSchoolConfig}>School Config</Button>
        )}
        {canManage && (
          <Button onClick={() => openDeployModal("school")}>
            School Deploy
          </Button>
        )}
        <Button onClick={openWebrtcSettings}>WebRTC sozlama</Button>
      </Space>
      <Table
        rowKey="id"
        dataSource={nvrs}
        columns={nvrColumns}
        pagination={false}
        locale={{ emptyText: "NVR topilmadi" }}
      />
    </Space>
  );

  const areaContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      {canManage && (
        <Button type="primary" onClick={() => openAreaDrawer()}>
          Hudud qo'shish
        </Button>
      )}
      <Table
        rowKey="id"
        dataSource={areas}
        columns={areaColumns}
        pagination={false}
        locale={{ emptyText: "Hudud topilmadi" }}
      />
    </Space>
  );

  const cameraContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      {canManage && (
        <Button type="primary" onClick={() => openCameraDrawer()}>
          Kamera qo'shish
        </Button>
      )}
      <Table
        rowKey="id"
        dataSource={camerasWithArea}
        columns={cameraColumns}
        pagination={{ pageSize: 10 }}
        locale={{ emptyText: "Kamera topilmadi" }}
      />
    </Space>
  );

  const syncContent = (
    <Space direction="vertical" style={{ width: "100%" }} size={12}>
      <Text type="secondary">
        Manual sync orqali NVR'dan kelgan kamera va hududlar ro'yxatini
        yuborasiz. JSON formatda bo'lishi kerak.
      </Text>
      <Space>
        <Select
          placeholder="NVR tanlang"
          style={{ minWidth: 220 }}
          value={syncTarget?.id}
          onChange={(value) =>
            setSyncTarget(nvrs.find((nvr) => nvr.id === value) || null)
          }
          options={nvrs.map((nvr) => ({
            value: nvr.id,
            label: `${nvr.name} (${nvr.host})`,
          }))}
        />
        <Button
          onClick={() => openSyncModal(syncTarget || undefined)}
          disabled={!syncTarget}
        >
          JSON kiritish
        </Button>
      </Space>
    </Space>
  );

  return (
    <div>
      <PageHeader>
        <StatItem
          icon={<VideoCameraOutlined />}
          label="Kameralar"
          value={stats.total}
          color="#1890ff"
        />
        <StatItem
          label="Online"
          value={stats.online}
          color="#52c41a"
          icon={<span />}
        />
        <StatItem
          label="Offline"
          value={stats.offline}
          color="#ff4d4f"
          icon={<span />}
        />
        <Space>
          <Text type="secondary">Hudud:</Text>
          <Select
            allowClear
            size="small"
            placeholder="Barchasi"
            value={selectedAreaId}
            onChange={setSelectedAreaId}
            style={{ width: 200 }}
            options={[
              { value: "__classrooms__", label: "Sinf xonalari" },
              ...areas.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
        </Space>
        <Input.Search
          allowClear
          size="small"
          placeholder="Kamera qidirish"
          style={{ width: 220 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </PageHeader>

      {CAMERA_API_MODE === "mock" && (
        <Alert
          type="warning"
          style={{ marginTop: 12 }}
          message="Camera API mock rejimda. To'liq boshqaruv uchun VITE_CAMERA_API_MODE=live va VITE_API_URL ni sozlang."
        />
      )}

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        style={{ marginTop: 12 }}
        items={[
          { key: "overview", label: "Ko'rinish", children: overviewContent },
          { key: "nvrs", label: "NVR", children: nvrContent },
          { key: "areas", label: "Hududlar", children: areaContent },
          { key: "cameras", label: "Kameralar", children: cameraContent },
          { key: "sync", label: "Sync", children: syncContent },
        ]}
      />

      <Modal
        open={!!selectedCamera}
        onCancel={() => setSelectedCamera(null)}
        title={
          <Space>
            {selectedCamera?.name}
            {streamInfo?.codec && (
              <Tag color={streamInfo.isH265 ? "orange" : "green"}>
                {streamInfo.codec}
              </Tag>
            )}
          </Space>
        }
        footer={null}
        width={720}
      >
        {selectedCamera ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            {/* Player - codec ga qarab avtomatik tanlash */}
            {streamInfo?.isH265 ? (
              // H.265 - HLS Player ishlatish
              streamInfo?.webrtcPath && (
                <HlsPlayer
                  key={`hls-${selectedCamera.id}-${webrtcConfigVersion}`}
                  hlsUrl={
                    streamInfo.hlsUrl || buildHlsUrl(streamInfo.webrtcPath)
                  }
                  onError={(err) => console.log("HLS error:", err)}
                />
              )
            ) : // H.264 - WebRTC Player ishlatish
            streamInfo?.webrtcPath ? (
              <WebRtcPlayer
                key={`webrtc-${selectedCamera.id}-${webrtcConfigVersion}`}
                whepUrl={buildWebrtcWhepUrl(streamInfo.webrtcPath)}
                onError={(err) => console.log("WebRTC error:", err)}
              />
            ) : (
              streamInfo?.webrtcPath && (
                <HlsPlayer
                  key={`hls-${selectedCamera.id}-${webrtcConfigVersion}`}
                  hlsUrl={buildHlsUrl(streamInfo.webrtcPath)}
                  onError={(err) => console.log("HLS error:", err)}
                />
              )
            )}

            {/* Fallback: Snapshot */}
            {!streamInfo?.webrtcPath && selectedCamera.snapshotUrl && (
              <img
                src={`${selectedCamera.snapshotUrl}?t=${snapshotTick}`}
                alt={selectedCamera.name}
                style={{ width: "100%", borderRadius: 6 }}
              />
            )}

            {/* Stream Info */}
            <Space direction="vertical" size={4}>
              {streamInfo?.codec && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Codec: {streamInfo.codec} | Player:{" "}
                  {streamInfo.recommendedPlayer?.toUpperCase()}
                </Text>
              )}
              {streamInfo?.rtspUrl && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  RTSP: {streamInfo.rtspUrl}
                </Text>
              )}
              {streamInfo?.hlsUrl && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  HLS: {streamInfo.hlsUrl}
                </Text>
              )}
            </Space>

            {!streamInfo?.webrtcPath && !selectedCamera.snapshotUrl && (
              <Text type="secondary">
                Stream sozlanmagan. MediaMTX server va path to'g'ri bo'lishi
                kerak.
              </Text>
            )}
          </Space>
        ) : null}
      </Modal>

      <Drawer
        open={nvrDrawerOpen}
        onClose={() => setNvrDrawerOpen(false)}
        title={editingNvr ? "NVR tahrirlash" : "NVR qo'shish"}
        width={520}
        extra={
          <Button type="primary" onClick={handleSaveNvr}>
            Saqlash
          </Button>
        }
      >
        <Form layout="vertical" form={nvrForm}>
          <Form.Item name="name" label="NVR nomi" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="vendor"
            label="Vendor"
            tooltip="RTSP URL formati vendor ga qarab o'zgaradi"
          >
            <Select
              allowClear
              placeholder="Vendor tanlang"
              options={[
                { value: "hikvision", label: "Hikvision" },
                { value: "dahua", label: "Dahua" },
                { value: "seetong", label: "Seetong" },
                { value: "generic", label: "Generic ONVIF" },
              ]}
            />
          </Form.Item>
          <Form.Item name="model" label="Model">
            <Input />
          </Form.Item>
          <Form.Item name="host" label="Host" rules={[{ required: true }]}>
            <Input placeholder="192.168.1.50" />
          </Form.Item>
          <Space size={12} style={{ width: "100%" }}>
            <Form.Item name="httpPort" label="HTTP Port" style={{ flex: 1 }}>
              <InputNumber min={1} max={65535} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="onvifPort" label="ONVIF Port" style={{ flex: 1 }}>
              <InputNumber min={1} max={65535} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="rtspPort" label="RTSP Port" style={{ flex: 1 }}>
              <InputNumber min={1} max={65535} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item
            name="username"
            label="Username"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={editingNvr ? [] : [{ required: true }]}
          >
            <Input.Password
              placeholder={
                editingNvr ? "O'zgartirmaslik uchun bo'sh qoldiring" : undefined
              }
            />
          </Form.Item>
          <Form.Item
            name="protocol"
            label="Protokol"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "ONVIF", label: "ONVIF" },
                { value: "RTSP", label: "RTSP" },
                { value: "HYBRID", label: "HYBRID" },
              ]}
            />
          </Form.Item>
          <Form.Item name="isActive" label="Faol" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        open={areaDrawerOpen}
        onClose={() => setAreaDrawerOpen(false)}
        title={editingArea ? "Hudud tahrirlash" : "Hudud qo'shish"}
        width={420}
        extra={
          <Button type="primary" onClick={handleSaveArea}>
            Saqlash
          </Button>
        }
      >
        <Form layout="vertical" form={areaForm}>
          <Form.Item
            name="name"
            label="Hudud nomi"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Izoh">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="nvrId" label="NVR">
            <Select
              allowClear
              options={nvrs.map((nvr) => ({
                value: nvr.id,
                label: `${nvr.name} (${nvr.host})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="externalId" label="External ID">
            <Input />
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        open={cameraDrawerOpen}
        onClose={() => setCameraDrawerOpen(false)}
        title={editingCamera ? "Kamera tahrirlash" : "Kamera qo'shish"}
        width={520}
        extra={
          <Button type="primary" onClick={handleSaveCamera}>
            Saqlash
          </Button>
        }
      >
        <Form layout="vertical" form={cameraForm}>
          <Form.Item
            name="name"
            label="Kamera nomi"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="nvrId" label="NVR">
            <Select
              allowClear
              placeholder="NVR tanlang (avtomatik URL uchun)"
              options={nvrs.map((nvr) => ({
                value: nvr.id,
                label: `${nvr.name} (${nvr.host})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="areaId" label="Hudud">
            <Select
              allowClear
              options={areas.map((area) => ({
                value: area.id,
                label: area.name,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="channelNo"
            label="Kanal raqami"
            tooltip="NVR'dagi kamera kanali (1, 2, 3...)"
          >
            <InputNumber min={1} style={{ width: "100%" }} placeholder="1" />
          </Form.Item>
          <Form.Item
            name="streamProfile"
            label="Stream sifati"
            tooltip="main - yuqori sifat (H.265), sub - past sifat (H.264)"
          >
            <Select
              options={[
                { value: "main", label: "Main (Yuqori sifat - H.265)" },
                {
                  value: "sub",
                  label: "Sub (Past sifat - H.264, WebRTC uchun)",
                },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="autoGenerateUrl"
            label="URL avtomatik yaratish"
            valuePropName="checked"
            tooltip="NVR va kanal asosida URL avtomatik generatsiya qilinadi"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            name="streamUrl"
            label="Stream URL"
            tooltip="Avtomatik yaratish o'chirilgan bo'lsa, to'liq RTSP URL kiriting"
          >
            <Input placeholder="rtsp://user:pass@192.168.1.1:554/ch1/main/av_stream" />
          </Form.Item>
          <Form.Item
            name="externalId"
            label="External ID"
            tooltip="Tashqi tizim bilan integratsiya uchun"
          >
            <Input placeholder="cam-001" />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "ONLINE", label: "🟢 ONLINE" },
                { value: "OFFLINE", label: "🔴 OFFLINE" },
                { value: "UNKNOWN", label: "⚪ UNKNOWN" },
              ]}
            />
          </Form.Item>
          <Form.Item name="isActive" label="Faol" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Drawer>

      <Modal
        open={syncModalOpen}
        onCancel={() => setSyncModalOpen(false)}
        onOk={handleSync}
        title={syncTarget ? `Sync: ${syncTarget.name}` : "Sync"}
        okText="Yuborish"
        width={720}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Text type="secondary">
            JSON formatidagi areas va cameras payloadini kiriting.
          </Text>
          <Input.TextArea
            rows={10}
            value={syncPayload}
            onChange={(e) => setSyncPayload(e.target.value)}
          />
        </Space>
      </Modal>

      <Modal
        open={healthModalOpen}
        onCancel={() => setHealthModalOpen(false)}
        footer={null}
        title="NVR Health"
      >
        {healthData ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Status">
              {healthData.status}
            </Descriptions.Item>
            <Descriptions.Item label="Host">
              {healthData.health?.host}
            </Descriptions.Item>
            <Descriptions.Item label="HTTP">
              {healthData.health?.http?.ok ? "OK" : "FAIL"}
            </Descriptions.Item>
            <Descriptions.Item label="ONVIF">
              {healthData.health?.onvif?.ok ? "OK" : "FAIL"}
            </Descriptions.Item>
            <Descriptions.Item label="RTSP">
              {healthData.health?.rtsp?.ok ? "OK" : "FAIL"}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        open={syncResultOpen}
        onCancel={() => setSyncResultOpen(false)}
        footer={null}
        title="ONVIF Sync"
      >
        {syncResult ? (
          <Descriptions column={1} size="small">
            <Descriptions.Item label="Created">
              {syncResult.stats?.created ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {syncResult.stats?.updated ?? 0}
            </Descriptions.Item>
            <Descriptions.Item label="Total">
              {syncResult.stats?.total ?? 0}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>

      <Modal
        open={webrtcSettingsOpen}
        onCancel={() => setWebrtcSettingsOpen(false)}
        onOk={saveWebrtcSettings}
        okText="Saqlash"
        title="WebRTC ICE Servers"
      >
        <Space direction="vertical" style={{ width: "100%" }} size={8}>
          <Text type="secondary">
            JSON array kiriting. Misol: [{"{"} "urls":
            "stun:stun.l.google.com:19302" {"}"}]
          </Text>
          <Input.TextArea
            rows={6}
            value={webrtcSettingsValue}
            onChange={(e) => setWebrtcSettingsValue(e.target.value)}
            placeholder='[{"urls":"stun:stun.l.google.com:19302"}]'
          />
          {webrtcSettingsError && (
            <Alert type="error" message={webrtcSettingsError} />
          )}
        </Space>
      </Modal>

      <Modal
        open={deployModalOpen}
        onCancel={() => setDeployModalOpen(false)}
        onOk={handleDeployMediaMtx}
        okText="Deploy"
        title={
          deployScope === "school"
            ? "MediaMTX Deploy (School)"
            : `MediaMTX Deploy (${deployTarget?.name || "NVR"})`
        }
      >
        <Form layout="vertical" form={deployForm}>
          <Form.Item
            name="mode"
            label="Deploy mode"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: "local", label: "Local" },
                { value: "ssh", label: "SSH" },
                { value: "docker", label: "Docker" },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="autoDeployOnSave"
            label="Kamera saqlanganida avtomatik deploy"
            valuePropName="checked"
            tooltip="Kamera qo'shilganida yoki yangilanganida MediaMTX config avtomatik yangilanadi"
          >
            <Switch />
          </Form.Item>

          <Form.Item shouldUpdate>
            {({ getFieldValue }) =>
              getFieldValue("mode") === "local" ? (
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Form.Item
                    name="localPath"
                    label="Local config path"
                    rules={[{ required: true }]}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    name="localRestartCommand"
                    label="Restart command (optional)"
                  >
                    <Input placeholder='taskkill /IM mediamtx.exe /F && start "" "d:\\projects-advanced\\school\\tools\\mediamtx\\mediamtx.exe" "d:\\projects-advanced\\school\\tools\\mediamtx\\mediamtx.yml"' />
                  </Form.Item>
                </Space>
              ) : getFieldValue("mode") === "ssh" ? (
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Form.Item
                    name="sshHost"
                    label="SSH Host"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="192.168.1.200" />
                  </Form.Item>
                  <Form.Item name="sshPort" label="SSH Port">
                    <InputNumber
                      min={1}
                      max={65535}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    name="sshUser"
                    label="SSH User"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="root" />
                  </Form.Item>
                  <Form.Item
                    name="sshRemotePath"
                    label="Remote config path"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="/etc/mediamtx.yml" />
                  </Form.Item>
                  <Form.Item name="sshRestartCommand" label="Restart command">
                    <Input placeholder="systemctl restart mediamtx" />
                  </Form.Item>
                </Space>
              ) : (
                <Space direction="vertical" style={{ width: "100%" }} size={8}>
                  <Form.Item
                    name="dockerContainer"
                    label="Docker container"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="mediamtx" />
                  </Form.Item>
                  <Form.Item
                    name="dockerConfigPath"
                    label="Config path"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="/mediamtx.yml" />
                  </Form.Item>
                  <Form.Item
                    name="dockerRestart"
                    label="Restart container"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Space>
              )
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Cameras;

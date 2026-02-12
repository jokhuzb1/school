import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Form, Input, Select, Space, Typography, message } from "antd";
import { VideoCameraOutlined } from "@ant-design/icons";
import { useSchool } from "@entities/school";
import { cameraApi, CAMERA_API_MODE } from "../entities/camera";
import { CAMERA_SNAPSHOT_REFRESH_MS } from "@shared/config";
import { PageHeader, StatItem, useHeaderMeta } from "../shared/ui";
import type { Camera, CameraArea, CameraStreamInfo, Nvr } from "@shared/types";
import { buildRtspUrlLocal, getErrorMessage, DEFAULT_SYNC_SAMPLE } from "./cameras.utils";
import { buildCamerasColumns } from "./camerasColumns";
import { CamerasTabs } from "./CamerasTabs";
import { CamerasPreviewModal } from "./CamerasPreviewModal";
import { CamerasDrawers } from "./CamerasDrawers";
import { CamerasOperationModals } from "./CamerasOperationModals";
import { useCamerasCrudActions } from "./useCamerasCrudActions";
import { useCamerasOpsActions } from "./useCamerasOpsActions";

const { Text } = Typography;

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
  const [syncPayload, setSyncPayload] = useState(JSON.stringify(DEFAULT_SYNC_SAMPLE, null, 2));
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncResultOpen, setSyncResultOpen] = useState(false);
  const [webrtcSettingsOpen, setWebrtcSettingsOpen] = useState(false);
  const [webrtcSettingsValue, setWebrtcSettingsValue] = useState("");
  const [webrtcSettingsError, setWebrtcSettingsError] = useState<string | null>(null);
  const [webrtcConfigVersion, setWebrtcConfigVersion] = useState(0);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [deployTarget, setDeployTarget] = useState<Nvr | null>(null);
  const [deployScope, setDeployScope] = useState<"nvr" | "school">("nvr");

  const [nvrForm] = Form.useForm();
  const [areaForm] = Form.useForm();
  const [cameraForm] = Form.useForm();
  const [deployForm] = Form.useForm();

  const canManage = isSchoolAdmin || isSuperAdmin;

  const streamUrlMode = Form.useWatch("streamUrlMode", cameraForm);
  const streamVendor = Form.useWatch("streamVendor", cameraForm);
  const rtspHost = Form.useWatch("rtspHost", cameraForm);
  const rtspPort = Form.useWatch("rtspPort", cameraForm);
  const rtspUsername = Form.useWatch("rtspUsername", cameraForm);
  const rtspPassword = Form.useWatch("rtspPassword", cameraForm);
  const rtspChannelNo = Form.useWatch("channelNo", cameraForm);
  const rtspProfile = Form.useWatch("streamProfile", cameraForm);
  const autoGenerateUrl = Form.useWatch("autoGenerateUrl", cameraForm);

  const rtspPreview = useMemo(() => {
    if (streamUrlMode !== "parts") return "";
    if (!streamVendor || !rtspHost || !rtspPort || !rtspUsername || !rtspPassword || !rtspChannelNo || !rtspProfile) return "";
    return buildRtspUrlLocal({ vendor: streamVendor, host: rtspHost, port: Number(rtspPort), username: rtspUsername, password: rtspPassword, channelNo: Number(rtspChannelNo), profile: rtspProfile });
  }, [streamUrlMode, streamVendor, rtspHost, rtspPort, rtspUsername, rtspPassword, rtspChannelNo, rtspProfile]);

  const getSavedDeploySettings = (): any => {
    try {
      const raw = localStorage.getItem("mediamtxDeploySettings");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const load = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const [areasData, camerasData, nvrsData] = await Promise.all([cameraApi.getAreas(schoolId), cameraApi.getCameras(schoolId), cameraApi.getNvrs(schoolId)]);
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

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setRefresh(load); return () => setRefresh(null); }, [load, setRefresh]);
  useEffect(() => { const timer = setInterval(() => setSnapshotTick((t) => t + 1), CAMERA_SNAPSHOT_REFRESH_MS); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const loadStream = async () => {
      if (!selectedCamera) { setStreamInfo(null); return; }
      try { setStreamInfo(await cameraApi.getCameraStream(selectedCamera.id)); } catch { setStreamInfo(null); }
    };
    loadStream();
  }, [selectedCamera]);

  const areaMap = useMemo(() => {
    const map = new Map<string, CameraArea>();
    areas.forEach((area) => map.set(area.id, area));
    return map;
  }, [areas]);
  const camerasWithArea = useMemo(() => cameras.map((c) => (c.area || !c.areaId ? c : { ...c, area: areaMap.get(c.areaId) })), [cameras, areaMap]);
  const filtered = useMemo(() => camerasWithArea.filter((c) => {
    const areaName = c.area?.name?.toLowerCase() || "";
    const matchesArea = selectedAreaId === "__classrooms__" ? areaName.includes("sinf") : selectedAreaId ? c.areaId === selectedAreaId : true;
    const matchesSearch = search ? c.name.toLowerCase().includes(search.toLowerCase()) : true;
    return matchesArea && matchesSearch;
  }), [camerasWithArea, selectedAreaId, search]);
  useEffect(() => { setPage(1); }, [selectedAreaId, search]);
  const paged = useMemo(() => filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize), [filtered, page, pageSize]);
  const stats = useMemo(() => ({ total: camerasWithArea.length, online: camerasWithArea.filter((c) => c.status === "ONLINE").length, offline: camerasWithArea.filter((c) => c.status === "OFFLINE").length }), [camerasWithArea]);

  const { openNvrDrawer, openAreaDrawer, openCameraDrawer, handleSaveNvr, handleSaveArea, handleSaveCamera } = useCamerasCrudActions({
    schoolId, nvrForm, areaForm, cameraForm, editingNvr, editingArea, editingCamera, setEditingNvr, setEditingArea, setEditingCamera, setNvrDrawerOpen, setAreaDrawerOpen, setCameraDrawerOpen, load, getSavedDeploySettings,
  });

  const {
    openWebrtcSettings,
    saveWebrtcSettings,
    openDeployModal,
    handleDeleteNvr,
    handleDeleteArea,
    handleDeleteCamera,
    handleTestCameraStream,
    handleTestNvr,
    handleOnvifSync,
    handleDownloadMediaMtx,
    handleDownloadSchoolConfig,
    handleDeployMediaMtx,
    openSyncModal,
    handleSync,
  } = useCamerasOpsActions({
    schoolId, deployForm, webrtcSettingsValue, syncPayload, syncTarget, deployScope, deployTarget,
    setWebrtcSettingsOpen, setWebrtcSettingsValue, setWebrtcSettingsError, setWebrtcConfigVersion,
    setDeployScope, setDeployTarget, setDeployModalOpen, setHealthData, setHealthModalOpen,
    setSyncResult, setSyncResultOpen, setSyncTarget, setSyncPayload, setSyncModalOpen, load, getSavedDeploySettings,
  });

  const { nvrColumns, areaColumns, cameraColumns } = buildCamerasColumns({
    canManage, nvrs, camerasWithArea, handleTestNvr, handleOnvifSync, handleDownloadMediaMtx,
    openDeployModal, openSyncModal, openNvrDrawer, handleDeleteNvr, openAreaDrawer, handleDeleteArea,
    handleTestCameraStream, openCameraDrawer, handleDeleteCamera,
  });

  return (
    <div>
      <PageHeader>
        <StatItem icon={<VideoCameraOutlined />} label="Kameralar" value={stats.total} color="#1890ff" />
        <StatItem label="Online" value={stats.online} color="#52c41a" icon={<span />} />
        <StatItem label="Offline" value={stats.offline} color="#ff4d4f" icon={<span />} />
        <Space><Text type="secondary">Hudud:</Text><Select allowClear size="small" placeholder="Barchasi" value={selectedAreaId} onChange={setSelectedAreaId} style={{ width: 200 }} options={[{ value: "__classrooms__", label: "Sinf xonalari" }, ...areas.map((a) => ({ value: a.id, label: a.name }))]} /></Space>
        <Input.Search allowClear size="small" placeholder="Kamera qidirish" style={{ width: 220 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </PageHeader>

      {CAMERA_API_MODE === "mock" && <Alert type="warning" style={{ marginTop: 12 }} message="Camera API mock rejimda. To'liq boshqaruv uchun VITE_CAMERA_API_MODE=live va VITE_API_URL ni sozlang." />}

      <CamerasTabs
        loading={loading} filtered={filtered} paged={paged} snapshotTick={snapshotTick} page={page} pageSize={pageSize}
        setPage={setPage} setPageSize={setPageSize} activeTab={activeTab} setActiveTab={setActiveTab} canManage={canManage}
        nvrs={nvrs} areas={areas} camerasWithArea={camerasWithArea} nvrColumns={nvrColumns} areaColumns={areaColumns} cameraColumns={cameraColumns}
        setSelectedCamera={setSelectedCamera} handleDownloadSchoolConfig={handleDownloadSchoolConfig} openDeployModal={(scope) => openDeployModal(scope)}
        openWebrtcSettings={openWebrtcSettings} openNvrDrawer={() => openNvrDrawer()} openAreaDrawer={() => openAreaDrawer()} openCameraDrawer={() => openCameraDrawer()}
        syncTarget={syncTarget} setSyncTarget={setSyncTarget} openSyncModal={openSyncModal}
      />

      <CamerasPreviewModal selectedCamera={selectedCamera} streamInfo={streamInfo} webrtcConfigVersion={webrtcConfigVersion} snapshotTick={snapshotTick} onClose={() => setSelectedCamera(null)} />

      <CamerasDrawers
        nvrDrawerOpen={nvrDrawerOpen} areaDrawerOpen={areaDrawerOpen} cameraDrawerOpen={cameraDrawerOpen}
        editingNvr={editingNvr} editingArea={editingArea} editingCamera={editingCamera}
        nvrForm={nvrForm} areaForm={areaForm} cameraForm={cameraForm}
        onCloseNvr={() => setNvrDrawerOpen(false)} onCloseArea={() => setAreaDrawerOpen(false)} onCloseCamera={() => setCameraDrawerOpen(false)}
        handleSaveNvr={handleSaveNvr} handleSaveArea={handleSaveArea} handleSaveCamera={handleSaveCamera}
        nvrs={nvrs} areas={areas} autoGenerateUrl={!!autoGenerateUrl} streamUrlMode={streamUrlMode || "parts"} rtspPreview={rtspPreview}
      />

      <CamerasOperationModals
        syncModalOpen={syncModalOpen} setSyncModalOpen={setSyncModalOpen} handleSync={handleSync} syncTarget={syncTarget}
        syncPayload={syncPayload} setSyncPayload={setSyncPayload} healthModalOpen={healthModalOpen} setHealthModalOpen={setHealthModalOpen}
        healthData={healthData} syncResultOpen={syncResultOpen} setSyncResultOpen={setSyncResultOpen} syncResult={syncResult}
        webrtcSettingsOpen={webrtcSettingsOpen} setWebrtcSettingsOpen={setWebrtcSettingsOpen} saveWebrtcSettings={saveWebrtcSettings}
        webrtcSettingsValue={webrtcSettingsValue} setWebrtcSettingsValue={setWebrtcSettingsValue} webrtcSettingsError={webrtcSettingsError}
        deployModalOpen={deployModalOpen} setDeployModalOpen={setDeployModalOpen} handleDeployMediaMtx={handleDeployMediaMtx}
        deployScope={deployScope} deployTarget={deployTarget} deployForm={deployForm}
      />
    </div>
  );
};

export default Cameras;


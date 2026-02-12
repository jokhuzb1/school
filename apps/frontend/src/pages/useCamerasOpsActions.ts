import { message } from "antd";
import type { Camera, CameraArea, Nvr } from "@shared/types";
import { cameraApi } from "../entities/camera";
import { DEFAULT_SYNC_SAMPLE, getErrorMessage } from "./cameras.utils";

type UseCamerasOpsActionsParams = {
  schoolId: string | null;
  deployForm: any;
  webrtcSettingsValue: string;
  syncPayload: string;
  syncTarget: Nvr | null;
  deployScope: "nvr" | "school";
  deployTarget: Nvr | null;
  setWebrtcSettingsOpen: (open: boolean) => void;
  setWebrtcSettingsValue: (value: string) => void;
  setWebrtcSettingsError: (value: string | null) => void;
  setWebrtcConfigVersion: (updater: (v: number) => number) => void;
  setDeployScope: (scope: "nvr" | "school") => void;
  setDeployTarget: (nvr: Nvr | null) => void;
  setDeployModalOpen: (open: boolean) => void;
  setHealthData: (data: any) => void;
  setHealthModalOpen: (open: boolean) => void;
  setSyncResult: (data: any) => void;
  setSyncResultOpen: (open: boolean) => void;
  setSyncTarget: (nvr: Nvr | null) => void;
  setSyncPayload: (payload: string) => void;
  setSyncModalOpen: (open: boolean) => void;
  load: () => Promise<void>;
  getSavedDeploySettings: () => any;
};

export const useCamerasOpsActions = ({
  schoolId,
  deployForm,
  webrtcSettingsValue,
  syncPayload,
  syncTarget,
  deployScope,
  deployTarget,
  setWebrtcSettingsOpen,
  setWebrtcSettingsValue,
  setWebrtcSettingsError,
  setWebrtcConfigVersion,
  setDeployScope,
  setDeployTarget,
  setDeployModalOpen,
  setHealthData,
  setHealthModalOpen,
  setSyncResult,
  setSyncResultOpen,
  setSyncTarget,
  setSyncPayload,
  setSyncModalOpen,
  load,
  getSavedDeploySettings,
}: UseCamerasOpsActionsParams) => {
  const getWebrtcSettingsRaw = () => localStorage.getItem("webrtcIceServers") || (import.meta as any).env?.VITE_WEBRTC_ICE_SERVERS || "";

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
      sshRestartCommand: saved.sshRestartCommand || "systemctl restart mediamtx",
      dockerContainer: saved.dockerContainer || "",
      dockerConfigPath: saved.dockerConfigPath || "/mediamtx.yml",
      dockerRestart: saved.dockerRestart !== false,
      localPath: saved.localPath || "d:\\projects-advanced\\school\\tools\\mediamtx\\mediamtx.yml",
      localRestartCommand: saved.localRestartCommand || "d:\\projects-advanced\\school\\tools\\mediamtx\\restart-mediamtx.bat",
    });
    setDeployModalOpen(true);
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
      message.loading({ content: "Stream test qilinmoqda...", key: "stream-test" });
      const result = await cameraApi.testCameraStream(camera.id);
      if (result.success) message.success({ content: `✅ ${result.message}`, key: "stream-test" });
      else message.error({ content: `❌ ${result.message || result.error}`, key: "stream-test" });
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
      const result = await cameraApi.onvifSync(nvr.id, { overwriteNames: false });
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
      link.href = url; link.download = `mediamtx_${nvr.id}.yml`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
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
      link.href = url; link.download = `mediamtx_school_${schoolId}.yml`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      message.success("School MediaMTX config yuklandi");
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  const handleDeployMediaMtx = async () => {
    try {
      const values = await deployForm.validateFields();
      const payload: any = { mode: values.mode };
      if (values.mode === "ssh") payload.ssh = { host: values.sshHost, port: values.sshPort, user: values.sshUser, remotePath: values.sshRemotePath, restartCommand: values.sshRestartCommand || undefined };
      else if (values.mode === "docker") payload.docker = { container: values.dockerContainer, configPath: values.dockerConfigPath, restart: values.dockerRestart };
      if (values.mode === "local") payload.local = { path: values.localPath, restartCommand: values.localRestartCommand || undefined };

      localStorage.setItem("mediamtxDeploySettings", JSON.stringify({
        mode: values.mode, autoDeployOnSave: values.autoDeployOnSave, sshHost: values.sshHost, sshPort: values.sshPort, sshUser: values.sshUser, sshRemotePath: values.sshRemotePath, sshRestartCommand: values.sshRestartCommand, dockerContainer: values.dockerContainer, dockerConfigPath: values.dockerConfigPath, dockerRestart: values.dockerRestart, localPath: values.localPath, localRestartCommand: values.localRestartCommand,
      }));

      if (deployScope === "school") await cameraApi.deploySchoolMediaMtx(schoolId!, payload);
      else if (deployTarget) await cameraApi.deployMediaMtx(deployTarget.id, payload);
      else throw new Error("NVR tanlanmagan");
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

  return {
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
  };
};

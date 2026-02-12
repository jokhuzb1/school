import { message } from "antd";
import type { Camera, CameraArea, Nvr } from "@shared/types";
import { cameraApi } from "../entities/camera";
import { buildRtspUrlLocal, getErrorMessage } from "./cameras.utils";

type UseCamerasCrudActionsParams = {
  schoolId: string | null;
  nvrForm: any;
  areaForm: any;
  cameraForm: any;
  editingNvr: Nvr | null;
  editingArea: CameraArea | null;
  editingCamera: Camera | null;
  setEditingNvr: (nvr: Nvr | null) => void;
  setEditingArea: (area: CameraArea | null) => void;
  setEditingCamera: (camera: Camera | null) => void;
  setNvrDrawerOpen: (open: boolean) => void;
  setAreaDrawerOpen: (open: boolean) => void;
  setCameraDrawerOpen: (open: boolean) => void;
  load: () => Promise<void>;
  getSavedDeploySettings: () => any;
};

export const useCamerasCrudActions = ({
  schoolId,
  nvrForm,
  areaForm,
  cameraForm,
  editingNvr,
  editingArea,
  editingCamera,
  setEditingNvr,
  setEditingArea,
  setEditingCamera,
  setNvrDrawerOpen,
  setAreaDrawerOpen,
  setCameraDrawerOpen,
  load,
  getSavedDeploySettings,
}: UseCamerasCrudActionsParams) => {
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
      nvrForm.setFieldsValue({ protocol: "ONVIF", httpPort: 80, onvifPort: 80, rtspPort: 554, isActive: true });
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
        streamUrlMode: "full",
        streamVendor: "hikvision",
        rtspHost: "",
        rtspPort: 554,
        rtspUsername: "",
        rtspPassword: "",
        streamProfile: camera.streamProfile || "main",
        autoGenerateUrl: camera.autoGenerateUrl ?? true,
        status: camera.status,
        isActive: camera.isActive ?? true,
      });
    } else {
      cameraForm.setFieldsValue({
        status: "UNKNOWN",
        isActive: true,
        streamProfile: "sub",
        autoGenerateUrl: true,
        streamUrlMode: "parts",
        streamVendor: "hikvision",
        rtspPort: 554,
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
      if (payload.autoGenerateUrl === false) {
        if (payload.streamUrlMode === "parts") {
          const missing = !payload.rtspHost || !payload.rtspPort || !payload.rtspUsername || !payload.rtspPassword || !payload.channelNo || !payload.streamProfile || !payload.streamVendor;
          if (missing) {
            message.error("RTSP qismlarini to'liq kiriting");
            return;
          }
          payload.streamUrl = buildRtspUrlLocal({
            vendor: payload.streamVendor,
            host: payload.rtspHost,
            port: Number(payload.rtspPort),
            username: payload.rtspUsername,
            password: payload.rtspPassword,
            channelNo: Number(payload.channelNo),
            profile: payload.streamProfile,
          });
        } else if (!payload.streamUrl) {
          message.error("To'liq RTSP URL kiriting yoki qismlardan yarating");
          return;
        }
      }
      delete payload.streamUrlMode;
      delete payload.streamVendor;
      delete payload.rtspHost;
      delete payload.rtspPort;
      delete payload.rtspUsername;
      delete payload.rtspPassword;
      if (editingCamera) {
        await cameraApi.updateCamera(editingCamera.id, payload);
        message.success("Kamera yangilandi");
      } else {
        await cameraApi.createCamera(schoolId, payload);
        message.success("Kamera qo'shildi");
      }
      setCameraDrawerOpen(false);
      await load();

      const saved = getSavedDeploySettings();
      if (saved.autoDeployOnSave) {
        try {
          await cameraApi.deploySchoolMediaMtx(schoolId, saved);
          message.success("MediaMTX config avtomatik yangilandi");
        } catch {
          message.warning("Kamera saqlandi, lekin MediaMTX deploy xatosi");
        }
      }
    } catch (err) {
      message.error(getErrorMessage(err));
    }
  };

  return { openNvrDrawer, openAreaDrawer, openCameraDrawer, handleSaveNvr, handleSaveArea, handleSaveCamera };
};

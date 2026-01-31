import type { Camera, CameraArea, CameraStreamInfo, Nvr } from "../../../types";
import {
  getMockAreas,
  getMockCameras,
  getMockNvrs,
  getMockStreamInfo,
} from "./mock";
import api from "../../../services/api";

type CameraApiMode = "mock" | "live";
const CAMERA_API_MODE: CameraApiMode =
  (import.meta.env.VITE_CAMERA_API_MODE as CameraApiMode) || "live";

export { CAMERA_API_MODE };

export const cameraApi = {
  async getNvrs(schoolId: string): Promise<Nvr[]> {
    if (CAMERA_API_MODE === "mock") {
      return getMockNvrs(schoolId);
    }
    const response = await api.get<Nvr[]>(`/schools/${schoolId}/nvrs`);
    return response.data;
  },
  async createNvr(schoolId: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post<Nvr>(`/schools/${schoolId}/nvrs`, payload);
    return response.data;
  },
  async updateNvr(id: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.put<Nvr>(`/nvrs/${id}`, payload);
    return response.data;
  },
  async deleteNvr(id: string) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.delete<Nvr>(`/nvrs/${id}`);
    return response.data;
  },
  async testNvrConnection(id: string) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post(`/nvrs/${id}/test-connection`);
    return response.data;
  },
  async syncNvr(id: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post(`/nvrs/${id}/sync`, payload);
    return response.data;
  },
  async onvifSync(id: string, payload?: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post(`/nvrs/${id}/onvif-sync`, payload || {});
    return response.data;
  },
  async downloadMediaMtxConfig(id: string): Promise<string> {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.get<string>(`/nvrs/${id}/mediamtx-config`, {
      responseType: "text" as any,
    });
    return response.data as any;
  },
  async downloadSchoolMediaMtxConfig(schoolId: string): Promise<string> {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.get<string>(
      `/schools/${schoolId}/mediamtx-config`,
      { responseType: "text" as any },
    );
    return response.data as any;
  },
  async deployMediaMtx(id: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post(`/nvrs/${id}/mediamtx-deploy`, payload);
    return response.data;
  },
  async deploySchoolMediaMtx(schoolId: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post(
      `/schools/${schoolId}/mediamtx-deploy`,
      payload,
    );
    return response.data;
  },
  async getAreas(schoolId: string): Promise<CameraArea[]> {
    if (CAMERA_API_MODE === "mock") {
      return getMockAreas(schoolId);
    }
    const response = await api.get<CameraArea[]>(
      `/schools/${schoolId}/camera-areas`,
    );
    return response.data;
  },
  async createArea(schoolId: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post<CameraArea>(
      `/schools/${schoolId}/camera-areas`,
      payload,
    );
    return response.data;
  },
  async updateArea(id: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.put<CameraArea>(`/camera-areas/${id}`, payload);
    return response.data;
  },
  async deleteArea(id: string) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.delete<CameraArea>(`/camera-areas/${id}`);
    return response.data;
  },
  async getCameras(schoolId: string): Promise<Camera[]> {
    if (CAMERA_API_MODE === "mock") {
      return getMockCameras(schoolId);
    }
    const response = await api.get<Camera[]>(`/schools/${schoolId}/cameras`);
    return response.data;
  },
  async getCameraStream(cameraId: string): Promise<CameraStreamInfo> {
    if (CAMERA_API_MODE === "mock") {
      return getMockStreamInfo(cameraId);
    }
    const response = await api.get<CameraStreamInfo>(
      `/cameras/${cameraId}/stream`,
    );
    return response.data;
  },
  async createCamera(schoolId: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post<Camera>(
      `/schools/${schoolId}/cameras`,
      payload,
    );
    return response.data;
  },
  async updateCamera(id: string, payload: Record<string, any>) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.put<Camera>(`/cameras/${id}`, payload);
    return response.data;
  },
  async deleteCamera(id: string) {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.delete<Camera>(`/cameras/${id}`);
    return response.data;
  },
  async testCameraStream(id: string): Promise<{
    success: boolean;
    rtspUrl?: string;
    host?: string;
    port?: number;
    streamProfile?: string;
    message?: string;
    error?: string;
  }> {
    if (CAMERA_API_MODE === "mock") {
      return { success: true, message: "Mock mode - no real test" };
    }
    const response = await api.post(`/cameras/${id}/test-stream`);
    return response.data;
  },
  async previewRtspUrl(
    schoolId: string,
    payload: {
      nvrId: string;
      channelNo: number;
      streamProfile?: string;
    },
  ): Promise<{
    rtspUrl: string;
    vendor: string;
    profile: string;
    host: string;
    port: number;
  }> {
    if (CAMERA_API_MODE === "mock") {
      throw new Error("Camera API is in mock mode");
    }
    const response = await api.post(
      `/schools/${schoolId}/preview-rtsp-url`,
      payload,
    );
    return response.data;
  },
};

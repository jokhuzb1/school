import type { Camera, CameraArea } from "../../../types";
import { getMockAreas, getMockCameras } from "./mock";
import api from "../../../services/api";

type CameraApiMode = "mock" | "live";
const CAMERA_API_MODE: CameraApiMode =
  (import.meta.env.VITE_CAMERA_API_MODE as CameraApiMode) || "mock";

export const cameraApi = {
  async getAreas(schoolId: string): Promise<CameraArea[]> {
    if (CAMERA_API_MODE === "mock") {
      return getMockAreas(schoolId);
    }
    const response = await api.get<CameraArea[]>(
      `/schools/${schoolId}/camera-areas`,
    );
    return response.data;
  },
  async getCameras(schoolId: string): Promise<Camera[]> {
    if (CAMERA_API_MODE === "mock") {
      return getMockCameras(schoolId);
    }
    const response = await api.get<Camera[]>(
      `/schools/${schoolId}/cameras`,
    );
    return response.data;
  },
};

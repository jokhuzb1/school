import type { Camera, CameraArea, CameraStreamInfo, Nvr } from "@shared/types";
import { buildCameraAreas, buildMockCameras } from "../model";

export async function getMockNvrs(schoolId: string): Promise<Nvr[]> {
  const now = new Date().toISOString();
  return [
    {
      id: "nvr-demo",
      schoolId,
      name: "Demo NVR",
      vendor: "ONVIF",
      model: "8232C",
      host: "192.168.1.50",
      httpPort: 80,
      onvifPort: 80,
      rtspPort: 554,
      username: "admin",
      protocol: "ONVIF",
      isActive: true,
      lastHealthCheckAt: now,
      lastHealthStatus: "ok",
      lastHealthError: null,
      lastSyncAt: now,
      lastSyncStatus: "ok",
      lastSyncError: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export async function getMockAreas(schoolId: string): Promise<CameraArea[]> {
  const now = new Date().toISOString();
  return buildCameraAreas({ schoolId, now });
}

export async function getMockCameras(schoolId: string): Promise<Camera[]> {
  const now = new Date().toISOString();
  const areas = await getMockAreas(schoolId);
  return buildMockCameras({ schoolId, areas, now });
}

export async function getMockStreamInfo(cameraId: string): Promise<CameraStreamInfo> {
  return {
    cameraId,
    webrtcUrl: "http://localhost:8889/whep/demo/camera",
    webrtcPath: "demo/camera",
    rtspUrl: "rtsp://user:pass@192.168.1.50:554/Streaming/Channels/101",
    rtspSource: "mock",
  };
}

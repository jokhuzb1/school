import type { Camera, CameraArea } from "../../../types";
import { buildCameraAreas, buildMockCameras } from "../model";

export async function getMockAreas(schoolId: string): Promise<CameraArea[]> {
  const now = new Date().toISOString();
  return buildCameraAreas({ schoolId, now });
}

export async function getMockCameras(schoolId: string): Promise<Camera[]> {
  const now = new Date().toISOString();
  const areas = await getMockAreas(schoolId);
  return buildMockCameras({ schoolId, areas, now });
}

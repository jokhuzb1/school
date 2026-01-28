import type { Camera, CameraArea, CameraStatus } from "../../../types";

export function buildCameraAreas(params: {
  schoolId: string;
  now: string;
}): CameraArea[] {
  const { schoolId, now } = params;
  return [
    { id: "area-entrance", name: "Kirish", schoolId, createdAt: now, updatedAt: now },
    { id: "area-corridor-1", name: "1-qavat koridor", schoolId, createdAt: now, updatedAt: now },
    { id: "area-room-1a", name: "1-A sinf", schoolId, createdAt: now, updatedAt: now },
    { id: "area-room-1b", name: "1-B sinf", schoolId, createdAt: now, updatedAt: now },
    { id: "area-room-2a", name: "2-A sinf", schoolId, createdAt: now, updatedAt: now },
    { id: "area-room-2b", name: "2-B sinf", schoolId, createdAt: now, updatedAt: now },
    { id: "area-courtyard", name: "Hovli", schoolId, createdAt: now, updatedAt: now },
    { id: "area-lab", name: "Laboratoriya", schoolId, createdAt: now, updatedAt: now },
  ];
}

export function buildMockCameras(params: {
  schoolId: string;
  areas: CameraArea[];
  now: string;
}): Camera[] {
  const { schoolId, areas, now } = params;
  const getArea = (id: string) => areas.find((a) => a.id === id)!;
  const make = (
    id: string,
    name: string,
    areaId: string,
    status: CameraStatus,
    snapshotUrl?: string,
  ): Camera => ({
    id,
    name,
    schoolId,
    areaId,
    area: getArea(areaId),
    status,
    snapshotUrl,
    streamUrl: undefined,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  });

  return [
    make("cam-1", "Kirish 1", "area-entrance", "ONLINE", "https://picsum.photos/seed/cam-1/640/360"),
    make("cam-2", "Kirish 2", "area-entrance", "OFFLINE", "https://picsum.photos/seed/cam-2/640/360"),
    make("cam-3", "Koridor A", "area-corridor-1", "ONLINE", "https://picsum.photos/seed/cam-3/640/360"),
    make("cam-4", "Koridor B", "area-corridor-1", "UNKNOWN", "https://picsum.photos/seed/cam-4/640/360"),
    make("cam-7", "1-A sinf", "area-room-1a", "ONLINE", "https://picsum.photos/seed/cam-7/640/360"),
    make("cam-8", "1-B sinf", "area-room-1b", "OFFLINE", "https://picsum.photos/seed/cam-8/640/360"),
    make("cam-9", "2-A sinf", "area-room-2a", "ONLINE", "https://picsum.photos/seed/cam-9/640/360"),
    make("cam-10", "2-B sinf", "area-room-2b", "UNKNOWN", "https://picsum.photos/seed/cam-10/640/360"),
    make("cam-5", "Hovli 1", "area-courtyard", "ONLINE", "https://picsum.photos/seed/cam-5/640/360"),
    make("cam-6", "Lab 1", "area-lab", "ONLINE", "https://picsum.photos/seed/cam-6/640/360"),
  ];
}

export function getStatusBadge(status: CameraStatus) {
  if (status === "ONLINE") return { color: "green", text: "Online" };
  if (status === "OFFLINE") return { color: "red", text: "Offline" };
  return { color: "gray", text: "Unknown" };
}

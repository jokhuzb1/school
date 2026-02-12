import type { Camera, CameraArea, CameraStatus } from "@shared/types";

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
    nvrId: "nvr-demo",
    externalId: id,
    channelNo: Number(id.replace(/\D/g, "")) || undefined,
    status,
    snapshotUrl,
    streamUrl: undefined,
    isActive: true,
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Maktab muhitiga mos mock tasvirlar
  const mockImages = {
    entrance: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=640&h=360&fit=crop", // School entrance
    corridor: "https://images.unsplash.com/photo-1580537659466-0a9bfa916a54?w=640&h=360&fit=crop", // Hallway
    classroom: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=640&h=360&fit=crop", // Classroom
    courtyard: "https://images.unsplash.com/photo-1541178735493-479c1a27ed24?w=640&h=360&fit=crop", // School yard
    lab: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=640&h=360&fit=crop", // Computer lab
  };

  return [
    make("cam-1", "Kirish 1", "area-entrance", "ONLINE", mockImages.entrance),
    make("cam-2", "Kirish 2", "area-entrance", "OFFLINE", mockImages.entrance),
    make("cam-3", "Koridor A", "area-corridor-1", "ONLINE", mockImages.corridor),
    make("cam-4", "Koridor B", "area-corridor-1", "UNKNOWN", mockImages.corridor),
    make("cam-7", "1-A sinf", "area-room-1a", "ONLINE", mockImages.classroom),
    make("cam-8", "1-B sinf", "area-room-1b", "OFFLINE", mockImages.classroom),
    make("cam-9", "2-A sinf", "area-room-2a", "ONLINE", mockImages.classroom),
    make("cam-10", "2-B sinf", "area-room-2b", "UNKNOWN", mockImages.classroom),
    make("cam-5", "Hovli 1", "area-courtyard", "ONLINE", mockImages.courtyard),
    make("cam-6", "Lab 1", "area-lab", "ONLINE", mockImages.lab),
  ];
}


export function getStatusBadge(status: CameraStatus) {
  if (status === "ONLINE") return { color: "green", text: "Online" };
  if (status === "OFFLINE") return { color: "red", text: "Offline" };
  return { color: "gray", text: "Unknown" };
}

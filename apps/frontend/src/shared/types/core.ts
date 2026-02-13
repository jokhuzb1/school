import type { DailyAttendance } from "./attendance";

export type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "GUARD";

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export type EffectiveAttendanceStatus =
  | AttendanceStatus
  | "PENDING_EARLY"
  | "PENDING_LATE";

export type DeviceType = "ENTRANCE" | "EXIT";
export type Gender = "MALE" | "FEMALE";
export type EventType = "IN" | "OUT";

export type NvrProtocol = "ONVIF" | "RTSP" | "HYBRID";
export interface Nvr {
  id: string;
  schoolId: string;
  name: string;
  vendor?: string | null;
  model?: string | null;
  host: string;
  httpPort: number;
  onvifPort: number;
  rtspPort: number;
  username: string;
  protocol: NvrProtocol;
  isActive: boolean;
  lastHealthCheckAt?: string | null;
  lastHealthStatus?: string | null;
  lastHealthError?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface School {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  webhookSecretIn?: string;
  webhookSecretOut?: string;
  lateThresholdMinutes: number;
  absenceCutoffMinutes: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    students: number;
    classes: number;
    devices: number;
  };
  todayStats?: {
    present: number;
    late: number;
    absent: number;
    pendingEarly?: number;
    pendingLate?: number;
    excused?: number;
    attendancePercent: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  schoolId?: string;
  school?: School;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  id: string;
  name: string;
  gradeLevel: number;
  schoolId: string;
  startTime: string;
  endTime?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { students: number };
  todayPresent?: number;
  todayLate?: number;
  todayAbsent?: number;
  totalStudents?: number;
}

export interface Student {
  id: string;
  deviceStudentId?: string;
  name: string;
  gender?: Gender;
  firstName?: string;
  lastName?: string;
  fatherName?: string;
  schoolId: string;
  classId?: string;
  class?: Class;
  parentPhone?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  todayStatus?: AttendanceStatus | null;
  todayEffectiveStatus?: EffectiveAttendanceStatus | null;
  todayFirstScan?: string | null;
  attendance?: DailyAttendance[];
}

export interface Device {
  id: string;
  name: string;
  deviceId: string;
  schoolId: string;
  type: DeviceType;
  location?: string;
  isActive: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CameraArea {
  id: string;
  name: string;
  schoolId: string;
  nvrId?: string | null;
  externalId?: string | null;
  description?: string;
  createdAt: string;
  updatedAt: string;
  _count?: { cameras: number };
}

export type CameraStatus = "ONLINE" | "OFFLINE" | "UNKNOWN";
export type StreamProfile = "main" | "sub";
export interface Camera {
  id: string;
  name: string;
  schoolId: string;
  areaId?: string | null;
  nvrId?: string | null;
  externalId?: string | null;
  channelNo?: number | null;
  area?: CameraArea;
  snapshotUrl?: string;
  streamUrl?: string;
  streamProfile?: StreamProfile;
  autoGenerateUrl?: boolean;
  status: CameraStatus;
  isActive?: boolean;
  lastSeenAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CameraStreamInfo {
  cameraId: string;
  webrtcUrl?: string | null;
  webrtcPath?: string | null;
  rtspUrl?: string | null;
  rtspSource?: string | null;
  hlsUrl?: string | null;
  streamProfile?: "main" | "sub";
  codec?: string;
  isH265?: boolean;
  recommendedPlayer?: "webrtc" | "hls" | "both";
}

export type SearchItem = {
  id: string;
  title: string;
  subtitle?: string | null;
  route: string;
};

export type SearchGroup = {
  key: string;
  label: string;
  items: SearchItem[];
};

// User roles
export type Role = "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "GUARD";

// Attendance status
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
export type EffectiveAttendanceStatus =
  | AttendanceStatus
  | "PENDING_EARLY"
  | "PENDING_LATE";

// Device type
export type DeviceType = "ENTRANCE" | "EXIT";

// Event type
export type EventType = "IN" | "OUT";

// NVR
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

// School
export interface School {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  webhookSecretIn: string;
  webhookSecretOut: string;
  lateThresholdMinutes: number;
  absenceCutoffMinutes: number;
  timezone: string;
  createdAt: string;
  updatedAt: string;
  // Statistika
  _count?: {
    students: number;
    classes: number;
    devices: number;
  };
  // Bugungi davomat
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

// User
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

// Class
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
  // Bugungi davomat statistikasi
  todayPresent?: number;
  todayLate?: number;
  todayAbsent?: number;
  totalStudents?: number;
}

// Student
export interface Student {
  id: string;
  deviceStudentId?: string;
  name: string;
  schoolId: string;
  classId?: string;
  class?: Class;
  parentPhone?: string;
  parentName?: string;
  photoUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // Today's attendance (populated by list endpoint)
  todayStatus?: AttendanceStatus | null;
  todayEffectiveStatus?: EffectiveAttendanceStatus | null;
  todayFirstScan?: string | null;
  // Expanded attendance (populated when fetching with attendance)
  attendance?: DailyAttendance[];
}

// Device
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

// Camera area (room/zone)
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

// Camera
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

// Attendance Event
export interface AttendanceEvent {
  id: string;
  studentId?: string;
  student?: Student;
  schoolId: string;
  deviceId?: string;
  device?: Device;
  eventType: EventType;
  timestamp: string;
  rawPayload: any;
  createdAt: string;
}

// Daily Attendance
export interface DailyAttendance {
  id: string;
  studentId: string;
  student?: Student;
  schoolId: string;
  date: string;
  status: EffectiveAttendanceStatus;
  firstScanTime?: string;
  lastScanTime?: string;
  lateMinutes?: number;
  totalTimeOnPremises?: number;
  notes?: string;
  // Yangi IN/OUT tracking fieldlar
  lastInTime?: string;
  lastOutTime?: string;
  currentlyInSchool?: boolean;
  scanCount?: number;
  createdAt: string;
  updatedAt: string;
}

// Holiday
export interface Holiday {
  id: string;
  schoolId: string;
  date: string;
  name: string;
  createdAt: string;
}

// Vaqt filterlari turlari
export type PeriodType =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "year"
  | "custom";
export type AttendanceScope = "started" | "active";

// Students response with period stats
export interface StudentsResponse extends PaginatedResponse<Student> {
  period: PeriodType;
  periodLabel: string;
  startDate: string;
  endDate: string;
  isSingleDay: boolean;
  stats: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    pending?: number;
    pendingEarly?: number;
    pendingLate?: number;
  };
}

// Dashboard Stats
export interface DashboardStats {
  // Vaqt oralig'i ma'lumotlari
  period?: "today" | "yesterday" | "week" | "month" | "year" | "custom";
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
  daysCount?: number;

  // Asosiy statistikalar (o'rtacha yoki bir kunlik)
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  excusedToday: number;
  presentPercentage: number;

  // Jami sonlar (vaqt oralig'idagi)
  totalPresent?: number;
  totalLate?: number;
  totalAbsent?: number;
  totalExcused?: number;

  // Hozir maktabda bo'lganlar (faqat bugun uchun)
  currentlyInSchool?: number;

  morningStats?: { present: number; late: number; absent: number };
  afternoonStats?: { present: number; late: number; absent: number };
  classBreakdown?: Array<{
    classId: string;
    className: string;
    total: number;
    present: number;
    late: number;
  }>;
  weeklyStats?: Array<{
    date: string;
    dayName: string;
    present: number;
    late: number;
    absent: number;
  }>;
  notYetArrived?: Array<{
    id: string;
    name: string;
    className: string;
    pendingStatus?: "PENDING_EARLY" | "PENDING_LATE";
  }>;
  notYetArrivedCount?: number;
  pendingEarlyCount?: number;
  latePendingCount?: number;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Login response
export interface LoginResponse {
  token: string;
  user: User;
}

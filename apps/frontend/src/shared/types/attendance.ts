import type { Device, EffectiveAttendanceStatus, EventType, Student } from "./core";
import type { PaginatedResponse } from "./api";

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
  lastInTime?: string;
  lastOutTime?: string;
  currentlyInSchool?: boolean;
  scanCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Holiday {
  id: string;
  schoolId: string;
  date: string;
  name: string;
  createdAt: string;
}

export type PeriodType =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "year"
  | "custom";
export type AttendanceScope = "started" | "active";

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

export interface DashboardStats {
  period?: "today" | "yesterday" | "week" | "month" | "year" | "custom";
  periodLabel?: string;
  startDate?: string;
  endDate?: string;
  daysCount?: number;
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  excusedToday: number;
  presentPercentage: number;
  totalPresent?: number;
  totalLate?: number;
  totalAbsent?: number;
  totalExcused?: number;
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

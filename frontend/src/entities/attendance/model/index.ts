import type {
  AttendanceStatus,
  DailyAttendance,
  EffectiveAttendanceStatus,
  Student,
} from "../../../types";
import {
  ATTENDANCE_STATUS_TAG,
  EFFECTIVE_STATUS_COLORS,
  EFFECTIVE_STATUS_LABELS,
} from "../../../shared/attendance";

export function getAttendanceStatsFromRecords(records: DailyAttendance[]) {
  const total = records.length;
  const present = records.filter(
    (r) => r.status === "PRESENT" || r.status === "LATE",
  ).length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  return { total, present, late, absent, excused };
}

export function getAttendanceStatsForStudentDetail(records: DailyAttendance[]) {
  const total = records.length;
  const present = records.filter((r) => r.status === "PRESENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  return { total, present, late, absent, excused };
}

export function getEffectiveStatusTagConfig(
  status: EffectiveAttendanceStatus | null | undefined,
) {
  if (!status) return { color: "default", text: "-", icon: null };
  const color = EFFECTIVE_STATUS_COLORS[status] || "default";
  const text = EFFECTIVE_STATUS_LABELS[status] || String(status);
  const icon =
    status in ATTENDANCE_STATUS_TAG
      ? ATTENDANCE_STATUS_TAG[status as AttendanceStatus].icon
      : null;
  return { color, text, icon };
}

export function getEffectiveStatusCounts(
  items: Array<{ effectiveStatus: EffectiveAttendanceStatus }>,
) {
  const present = items.filter((s) => s.effectiveStatus === "PRESENT").length;
  const late = items.filter((s) => s.effectiveStatus === "LATE").length;
  const absent = items.filter((s) => s.effectiveStatus === "ABSENT").length;
  const excused = items.filter((s) => s.effectiveStatus === "EXCUSED").length;
  const pendingEarly = items.filter(
    (s) => s.effectiveStatus === "PENDING_EARLY",
  ).length;
  const pendingLate = items.filter(
    (s) => s.effectiveStatus === "PENDING_LATE",
  ).length;
  return {
    present,
    late,
    absent,
    excused,
    pendingEarly,
    pendingLate,
    pending: pendingEarly + pendingLate,
  };
}

export function getStudentListStatsFallback(
  students: Array<Student>,
  total: number,
) {
  const withStatus = students.map((s) => ({
    effectiveStatus:
      (s as any).todayEffectiveStatus || (s as any).todayStatus,
  }));
  const counts = getEffectiveStatusCounts(
    withStatus.filter((s) => s.effectiveStatus) as Array<{
      effectiveStatus: EffectiveAttendanceStatus;
    }>,
  );
  return {
    total,
    ...counts,
  };
}

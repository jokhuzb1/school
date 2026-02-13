/**
 * Attendance Status Utility
 * Single Source of Truth for status calculation
 */

import { getTimePartsInZone } from "../../../utils/date";

export type EffectiveStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "EXCUSED"
  | "PENDING_EARLY"
  | "PENDING_LATE";

export interface StatusInput {
  /** DailyAttendance.status from database (null if no record) */
  dbStatus: string | null;
  /** Class.startTime in HH:mm format */
  classStartTime: string | null;
  /** School.absenceCutoffMinutes */
  absenceCutoffMinutes: number;
  /** Current time in minutes from midnight (for timezone-aware calculation) */
  nowMinutes: number;
}

/**
 * Computes the effective attendance status for a student.
 *
 * Logic:
 * 1. If dbStatus exists -> return it as-is
 * 2. If classStartTime is null -> return 'PENDING_EARLY'
 * 3. If now < classStart -> return 'PENDING_EARLY' (dars hali boshlanmagan)
 * 4. If now < classStart + cutoff -> return 'PENDING_LATE' (dars boshlangan, cutoff muddati o'tmagan)
 * 5. Otherwise -> return 'ABSENT' (cutoff o'tgan, kelmagan)
 */
export function computeAttendanceStatus(input: StatusInput): EffectiveStatus {
  const { dbStatus, classStartTime, absenceCutoffMinutes, nowMinutes } = input;

  // 1. If status exists in database, return it
  if (dbStatus) {
    return dbStatus as EffectiveStatus;
  }

  // 2. No class start time -> can't calculate, assume pending
  if (!classStartTime) {
    return "PENDING_EARLY";
  }

  // 3. Parse class start time
  const [hours, minutes] = classStartTime.split(":").map(Number);
  const classStartMinutes = hours * 60 + minutes;

  // 4. If current time is before class start, still pending
  if (nowMinutes < classStartMinutes) {
    return "PENDING_EARLY";
  }

  // 5. If current time is within cutoff window, still pending
  const cutoffMinutes = classStartMinutes + absenceCutoffMinutes;
  if (nowMinutes < cutoffMinutes) {
    return "PENDING_LATE";
  }

  // 6. Cutoff passed, no scan -> ABSENT
  return "ABSENT";
}

/**
 * Helper to get current time in minutes for a specific timezone
 */
export function getNowMinutesInZone(date: Date, timezone: string): number {
  const timeParts = getTimePartsInZone(date, timezone);
  return timeParts.hours * 60 + timeParts.minutes;
}

/**
 * Batch compute status for multiple students
 */
export function computeStudentStatuses(
  students: Array<{
    id: string;
    todayStatus: string | null;
    classStartTime: string | null;
  }>,
  absenceCutoffMinutes: number,
  nowMinutes: number,
): Map<string, EffectiveStatus> {
  const result = new Map<string, EffectiveStatus>();

  for (const student of students) {
    result.set(
      student.id,
      computeAttendanceStatus({
        dbStatus: student.todayStatus,
        classStartTime: student.classStartTime,
        absenceCutoffMinutes,
        nowMinutes,
      }),
    );
  }

  return result;
}

export function calculateAttendancePercent(
  present: number,
  late: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return Math.round(((present + late) / total) * 100);
}

export function splitNoScanCountsByClass(params: {
  classes: Array<{ id: string; startTime: string | null }>;
  classStudentCounts: Map<string, number>;
  classAttendanceCounts: Map<string, number>;
  absenceCutoffMinutes: number;
  nowMinutes: number;
}): { pendingEarly: number; pendingLate: number; absent: number } {
  const {
    classes,
    classStudentCounts,
    classAttendanceCounts,
    absenceCutoffMinutes,
    nowMinutes,
  } = params;

  let pendingEarly = 0;
  let pendingLate = 0;
  let absent = 0;

  classes.forEach((cls) => {
    const totalInClass = classStudentCounts.get(cls.id) || 0;
    const attendedInClass = classAttendanceCounts.get(cls.id) || 0;
    const notArrived = Math.max(0, totalInClass - attendedInClass);
    if (notArrived === 0) return;

    if (!cls.startTime) {
      pendingEarly += notArrived;
      return;
    }

    const [h, m] = cls.startTime.split(":").map(Number);
    const classStartMinutes = h * 60 + m;
    const cutoffMinutes = classStartMinutes + absenceCutoffMinutes;

    if (nowMinutes < classStartMinutes) {
      pendingEarly += notArrived;
    } else if (nowMinutes < cutoffMinutes) {
      pendingLate += notArrived;
    } else {
      absent += notArrived;
    }
  });

  return { pendingEarly, pendingLate, absent };
}

export function getActiveClassIds(params: {
  classes: Array<{ id: string; startTime: string | null; endTime?: string | null }>;
  nowMinutes: number;
  absenceCutoffMinutes: number;
}): string[] {
  const { classes, nowMinutes, absenceCutoffMinutes } = params;
  const active: string[] = [];

  const toMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  classes.forEach((cls) => {
    if (!cls.startTime) return;
    const start = toMinutes(cls.startTime);
    const endFromSchedule = cls.endTime ? toMinutes(cls.endTime) : start;
    const cutoffEnd = start + absenceCutoffMinutes;
    const end = Math.max(endFromSchedule, cutoffEnd);
    if (nowMinutes >= start && nowMinutes < end) {
      active.push(cls.id);
    }
  });

  return active;
}

export function getStartedClassIds(params: {
  classes: Array<{ id: string; startTime: string | null }>;
  nowMinutes: number;
}): string[] {
  const { classes, nowMinutes } = params;
  const started: string[] = [];

  const toMinutes = (time: string): number => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  classes.forEach((cls) => {
    if (!cls.startTime) {
      started.push(cls.id);
      return;
    }
    const start = toMinutes(cls.startTime);
    if (nowMinutes >= start) {
      started.push(cls.id);
    }
  });

  return started;
}

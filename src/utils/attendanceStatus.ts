/**
 * Attendance Status Utility
 * Single Source of Truth for status calculation
 */

import { getTimePartsInZone } from "./date";

export type EffectiveStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "EXCUSED"
  | "PENDING";

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
 * 2. If classStartTime is null -> return 'PENDING'
 * 3. If now < classStart -> return 'PENDING' (dars hali boshlanmagan)
 * 4. If now < classStart + cutoff -> return 'PENDING' (cutoff muddati o'tmagan)
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
    return "PENDING";
  }

  // 3. Parse class start time
  const [hours, minutes] = classStartTime.split(":").map(Number);
  const classStartMinutes = hours * 60 + minutes;

  // 4. If current time is before class start, still pending
  if (nowMinutes < classStartMinutes) {
    return "PENDING";
  }

  // 5. If current time is within cutoff window, still pending
  const cutoffMinutes = classStartMinutes + absenceCutoffMinutes;
  if (nowMinutes < cutoffMinutes) {
    return "PENDING";
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

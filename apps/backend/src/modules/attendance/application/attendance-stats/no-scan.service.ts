import {
  computeAttendanceStatus,
  splitNoScanCountsByClass,
} from "../../../../utils/attendanceStatus";
import { AttendanceStatsReadPort } from "./ports";
import { ClassCountRow } from "./types";

export async function getAttendanceCountsByClass(params: {
  schoolId: string;
  dateStart: Date;
  dateEnd: Date;
  classIds: string[];
  repo: AttendanceStatsReadPort;
}): Promise<{ classAttendanceMap: Map<string, number>; unassignedAttended: number }> {
  const { schoolId, dateStart, dateEnd, classIds, repo } = params;

  if (!classIds.length) {
    return { classAttendanceMap: new Map(), unassignedAttended: 0 };
  }

  const records = await repo.getAttendanceClassRows({
    schoolId,
    dateStart,
    dateEnd,
    classIds,
  });

  const classAttendanceMap = new Map<string, number>();
  let unassignedAttended = 0;

  records.forEach((row) => {
    const classId = row.classId || null;
    if (classId) {
      classAttendanceMap.set(
        classId,
        (classAttendanceMap.get(classId) || 0) + 1,
      );
    } else {
      unassignedAttended += 1;
    }
  });

  return { classAttendanceMap, unassignedAttended };
}

export async function computeNoScanSplit(params: {
  schoolId: string;
  dateStart: Date;
  dateEnd: Date;
  classIds: string[];
  classes: Array<{ id: string; startTime: string | null }>;
  classStudentCounts: ClassCountRow[];
  absenceCutoffMinutes: number;
  nowMinutes: number;
  repo: AttendanceStatsReadPort;
}): Promise<{
  noScanSplit: { pendingEarly: number; pendingLate: number; absent: number };
  totalActiveStudents: number;
}> {
  const {
    schoolId,
    dateStart,
    dateEnd,
    classIds,
    classes,
    classStudentCounts,
    absenceCutoffMinutes,
    nowMinutes,
    repo,
  } = params;

  if (!classIds.length) {
    return {
      noScanSplit: { pendingEarly: 0, pendingLate: 0, absent: 0 },
      totalActiveStudents: 0,
    };
  }

  const attendanceCounts = await getAttendanceCountsByClass({
    schoolId,
    dateStart,
    dateEnd,
    classIds,
    repo,
  });

  const classStudentMap = new Map<string, number>();
  let totalActiveStudents = 0;
  let unassignedTotal = 0;
  classStudentCounts.forEach((row) => {
    if (row.classId) {
      classStudentMap.set(row.classId, row._count);
      totalActiveStudents += row._count;
    } else {
      unassignedTotal = row._count;
    }
  });

  const classAttendanceMap = new Map(attendanceCounts.classAttendanceMap);
  const classesForSplit = [...classes];

  if (unassignedTotal > 0 || attendanceCounts.unassignedAttended > 0) {
    const unassignedKey = "__unassigned__";
    classStudentMap.set(unassignedKey, unassignedTotal);
    classAttendanceMap.set(
      unassignedKey,
      attendanceCounts.unassignedAttended,
    );
    classesForSplit.push({ id: unassignedKey, startTime: null });
  }

  const noScanSplit = splitNoScanCountsByClass({
    classes: classesForSplit,
    classStudentCounts: classStudentMap,
    classAttendanceCounts: classAttendanceMap,
    absenceCutoffMinutes,
    nowMinutes,
  });

  return { noScanSplit, totalActiveStudents };
}

export async function getPendingNotArrivedList(params: {
  schoolId: string;
  classIds: string[];
  arrivedStudentIds: string[];
  absenceCutoffMinutes: number;
  nowMinutes: number;
  limit?: number;
  repo: AttendanceStatsReadPort;
}): Promise<
  Array<{
    id: string;
    name: string;
    className: string;
    pendingStatus: "PENDING_EARLY" | "PENDING_LATE";
  }>
> {
  const {
    schoolId,
    classIds,
    arrivedStudentIds,
    absenceCutoffMinutes,
    nowMinutes,
    limit = 20,
    repo,
  } = params;

  if (!classIds.length) return [];

  const notYetArrived = await repo.getPendingNotArrivedStudents({
    schoolId,
    classIds,
    arrivedStudentIds,
    limit,
  });

  return notYetArrived
    .map((student) => {
      const status = computeAttendanceStatus({
        dbStatus: null,
        classStartTime: student.classStartTime,
        absenceCutoffMinutes,
        nowMinutes,
      });

      if (status === "PENDING_EARLY" || status === "PENDING_LATE") {
        return {
          id: student.id,
          name: student.name,
          className: student.className,
          pendingStatus: status,
        };
      }

      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

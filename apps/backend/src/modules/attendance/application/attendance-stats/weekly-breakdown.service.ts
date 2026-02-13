import { AttendanceStatsReadPort } from "./ports";
import { DateRange, WeeklyStatus } from "./types";

export async function getWeeklyStatusMap(params: {
  schoolId: string;
  startDate: Date;
  endDate: Date;
  classIds?: string[] | null;
  repo: AttendanceStatsReadPort;
}): Promise<Map<string, WeeklyStatus>> {
  const { schoolId, startDate, endDate, classIds, repo } = params;
  const map = new Map<string, WeeklyStatus>();
  if (Array.isArray(classIds) && classIds.length === 0) return map;

  const rows = await repo.getAttendanceDateStatusCounts({
    schoolId,
    startDate,
    endDate,
    classIds,
  });

  rows.forEach((row) => {
    const dateKey = row.date.toISOString().split("T")[0];
    if (!map.has(dateKey)) {
      map.set(dateKey, { present: 0, late: 0, absent: 0 });
    }
    const entry = map.get(dateKey)!;
    if (row.status === "PRESENT") entry.present += row.count;
    else if (row.status === "LATE") entry.late += row.count;
    else if (row.status === "ABSENT") entry.absent += row.count;
  });

  return map;
}

export async function getClassBreakdown(params: {
  schoolId: string;
  dateRange: DateRange;
  classIds?: string[] | null;
  classes: Array<{ id: string; name: string; _count: { students: number } }>;
  repo: AttendanceStatsReadPort;
}): Promise<
  Array<{ classId: string; className: string; total: number; present: number; late: number }>
> {
  const { schoolId, dateRange, classIds, classes, repo } = params;
  if (classes.length === 0) return [];

  const classBreakdownQuery = await repo.getAttendanceClassBreakdown({
    schoolId,
    dateRange,
    classIds,
  });

  const classStatsMap = new Map<string, { present: number; late: number }>();
  classBreakdownQuery.forEach((row) => {
    if (!row.classId) return;
    if (!classStatsMap.has(row.classId)) {
      classStatsMap.set(row.classId, { present: 0, late: 0 });
    }
    const entry = classStatsMap.get(row.classId)!;
    const count = row.count;
    if (row.status === "PRESENT") entry.present += count;
    else if (row.status === "LATE") {
      entry.present += count;
      entry.late = count;
    }
  });

  return classes.map((cls) => {
    const stats = classStatsMap.get(cls.id) || { present: 0, late: 0 };
    return {
      classId: cls.id,
      className: cls.name,
      total: cls._count.students,
      present: stats.present,
      late: stats.late,
    };
  });
}

import prisma from "../../../prisma";
import { Prisma } from "@prisma/client";
import { addDaysUtc } from "../../../utils/date";
import { computeAttendanceStatus, splitNoScanCountsByClass } from "../../../utils/attendanceStatus";

export type StatusCounts = {
  present: number;
  late: number;
  absent: number;
  excused: number;
};

export type DateRange = {
  startDate: Date;
  endDate: Date;
};

export type WeeklyStatus = {
  present: number;
  late: number;
  absent: number;
};

export type ClassCountRow = {
  classId: string | null;
  _count: number;
};

const emptyStatusCounts = (): StatusCounts => ({
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
});

async function getDistinctAttendanceDaysCount(params: {
  schoolId: string;
  dateStart: Date;
  dateEnd: Date;
  classIds?: string[] | null;
}): Promise<number> {
  const { schoolId, dateStart, dateEnd, classIds } = params;
  if (Array.isArray(classIds) && classIds.length === 0) return 1;

  const classFilterSql = Array.isArray(classIds)
    ? Prisma.sql`AND s."classId" IN (${Prisma.join(classIds)})`
    : Prisma.empty;

  const res = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(DISTINCT da."date"::date)::bigint as count
      FROM "DailyAttendance" da
      JOIN "Student" s ON da."studentId" = s.id
      WHERE da."schoolId" = ${schoolId}
        AND da."date" >= ${dateStart}
        AND da."date" < ${dateEnd}
        AND s."isActive" = true
        ${classFilterSql}
    `;

  return Number(res?.[0]?.count || 0) || 1;
}

export async function getStatusCountsByRange(params: {
  schoolId: string;
  dateRange: DateRange;
  classIds?: string[] | null;
}): Promise<{ counts: StatusCounts; daysCount: number }> {
  const { schoolId, dateRange, classIds } = params;
  if (Array.isArray(classIds) && classIds.length === 0) {
    return { counts: emptyStatusCounts(), daysCount: 1 };
  }

  const rangeEnd = addDaysUtc(dateRange.endDate, 1);
  const where: any = {
    schoolId,
    date: { gte: dateRange.startDate, lt: rangeEnd },
  };
  if (Array.isArray(classIds)) {
    where.student = { classId: { in: classIds }, isActive: true };
  } else {
    where.student = { isActive: true };
  }

  const [stats, daysCount] = await Promise.all([
    prisma.dailyAttendance.groupBy({
      by: ["status"],
      where,
      _count: true,
    }),
    getDistinctAttendanceDaysCount({
      schoolId,
      dateStart: dateRange.startDate,
      dateEnd: rangeEnd,
      classIds,
    }),
  ]);

  const counts = emptyStatusCounts();
  stats.forEach((stat) => {
    if (stat.status === "PRESENT") counts.present = stat._count;
    else if (stat.status === "LATE") counts.late = stat._count;
    else if (stat.status === "ABSENT") counts.absent = stat._count;
    else if (stat.status === "EXCUSED") counts.excused = stat._count;
  });

  return { counts, daysCount };
}

export async function getWeeklyStatusMap(params: {
  schoolId: string;
  startDate: Date;
  endDate: Date;
  classIds?: string[] | null;
}): Promise<Map<string, WeeklyStatus>> {
  const { schoolId, startDate, endDate, classIds } = params;
  const map = new Map<string, WeeklyStatus>();
  if (Array.isArray(classIds) && classIds.length === 0) return map;

  const where: any = {
    schoolId,
    date: { gte: startDate, lt: endDate },
  };
  if (Array.isArray(classIds)) {
    where.student = { classId: { in: classIds }, isActive: true };
  } else {
    where.student = { isActive: true };
  }

  const rows = await prisma.dailyAttendance.groupBy({
    by: ["date", "status"],
    where,
    _count: true,
  });

  rows.forEach((row) => {
    const dateKey = row.date.toISOString().split("T")[0];
    if (!map.has(dateKey)) {
      map.set(dateKey, { present: 0, late: 0, absent: 0 });
    }
    const entry = map.get(dateKey)!;
    if (row.status === "PRESENT") entry.present += row._count;
    else if (row.status === "LATE") entry.late += row._count;
    else if (row.status === "ABSENT") entry.absent += row._count;
  });

  return map;
}

export async function getClassBreakdown(params: {
  schoolId: string;
  dateRange: DateRange;
  classIds?: string[] | null;
  classes: Array<{ id: string; name: string; _count: { students: number } }>;
}): Promise<
  Array<{ classId: string; className: string; total: number; present: number; late: number }>
> {
  const { schoolId, dateRange, classIds, classes } = params;
  if (classes.length === 0) return [];

  const rangeEnd = addDaysUtc(dateRange.endDate, 1);
  const classFilterSql =
    Array.isArray(classIds) && classIds.length > 0
      ? Prisma.sql`AND s."classId" IN (${Prisma.join(classIds)})`
      : Prisma.empty;

  const classBreakdownQuery = await prisma.$queryRaw<
    Array<{
      classId: string;
      status: string;
      count: bigint;
    }>
  >`
    SELECT s."classId", da."status", COUNT(*)::bigint as count
    FROM "DailyAttendance" da
    JOIN "Student" s ON da."studentId" = s.id
    WHERE da."schoolId" = ${schoolId} 
      AND da."date" >= ${dateRange.startDate}
      AND da."date" < ${rangeEnd}
      AND s."isActive" = true
      ${classFilterSql}
    GROUP BY s."classId", da."status"
  `;

  const classStatsMap = new Map<string, { present: number; late: number }>();
  classBreakdownQuery.forEach((row) => {
    if (!row.classId) return;
    if (!classStatsMap.has(row.classId)) {
      classStatsMap.set(row.classId, { present: 0, late: 0 });
    }
    const entry = classStatsMap.get(row.classId)!;
    const count = Number(row.count);
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

export async function computeNoScanSplit(params: {
  schoolId: string;
  dateStart: Date;
  dateEnd: Date;
  classIds: string[];
  classes: Array<{ id: string; startTime: string | null }>;
  classStudentCounts: ClassCountRow[];
  absenceCutoffMinutes: number;
  nowMinutes: number;
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

export async function getAttendanceCountsByClass(params: {
  schoolId: string;
  dateStart: Date;
  dateEnd: Date;
  classIds: string[];
}): Promise<{ classAttendanceMap: Map<string, number>; unassignedAttended: number }> {
  const { schoolId, dateStart, dateEnd, classIds } = params;

  if (!classIds.length) {
    return { classAttendanceMap: new Map(), unassignedAttended: 0 };
  }

  const records = await prisma.dailyAttendance.findMany({
    where: {
      schoolId,
      date: { gte: dateStart, lt: dateEnd },
      student: { classId: { in: classIds }, isActive: true },
    },
    select: {
      student: { select: { classId: true } },
    },
  });

  const classAttendanceMap = new Map<string, number>();
  let unassignedAttended = 0;

  records.forEach((row) => {
    const classId = row.student?.classId || null;
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

export async function getPendingNotArrivedList(params: {
  schoolId: string;
  classIds: string[];
  arrivedStudentIds: string[];
  absenceCutoffMinutes: number;
  nowMinutes: number;
  limit?: number;
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
  } = params;

  if (!classIds.length) return [];

  const notYetArrived = await prisma.student.findMany({
    where: {
      schoolId,
      isActive: true,
      classId: { in: classIds },
      id: { notIn: arrivedStudentIds.length > 0 ? arrivedStudentIds : ["none"] },
    },
    take: limit,
    include: { class: { select: { name: true, startTime: true } } },
    orderBy: { name: "asc" },
  });

  return notYetArrived
    .map((s) => {
      const status = computeAttendanceStatus({
        dbStatus: null,
        classStartTime: s.class?.startTime || null,
        absenceCutoffMinutes,
        nowMinutes,
      });

      if (status === "PENDING_EARLY" || status === "PENDING_LATE") {
        return {
          id: s.id,
          name: s.name,
          className: s.class?.name || "-",
          pendingStatus: status,
        };
      }

      return null;
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

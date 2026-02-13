import prisma from "../prisma";
import { addDaysUtc, getDateOnlyInZone } from "../utils/date";
import {
  getActiveClassIds,
  getNowMinutesInZone,
  getStartedClassIds,
} from "../utils/attendanceStatus";
import {
  ClassCountRow,
  computeNoScanSplit,
  getStatusCountsByRange,
  getWeeklyStatusMap,
  StatusCounts,
} from "../modules/attendance";

export type SnapshotScope = "started" | "active";

export interface SchoolSnapshotStats {
  totalStudents: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  currentlyInSchool: number;
  pendingEarly: number;
  pendingLate: number;
}

export interface SchoolSnapshotPayload {
  type: "school_snapshot";
  schoolId: string;
  scope: SnapshotScope;
  timestamp: string;
  stats: SchoolSnapshotStats;
  weeklyStats?: WeeklySnapshotEntry[];
}

export interface ClassSnapshotPayload {
  type: "class_snapshot";
  schoolId: string;
  classId: string;
  scope: SnapshotScope;
  timestamp: string;
  stats: SchoolSnapshotStats;
  weeklyStats?: WeeklySnapshotEntry[];
}

export type SnapshotPayload = SchoolSnapshotPayload | ClassSnapshotPayload;

export interface WeeklySnapshotEntry {
  date: string;
  dayName: string;
  present: number;
  late: number;
  absent: number;
}

const emptyStats = (): SchoolSnapshotStats => ({
  totalStudents: 0,
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
  currentlyInSchool: 0,
  pendingEarly: 0,
  pendingLate: 0,
});

const emptyStatusCounts = (): StatusCounts => ({
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
});

const WEEKDAY_SHORT = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];

type SnapshotBase = {
  scope: SnapshotScope;
  timestamp: string;
  stats: SchoolSnapshotStats;
  weeklyStats?: WeeklySnapshotEntry[];
};

async function computeSnapshotBase(params: {
  schoolId: string;
  scope: SnapshotScope;
  classId?: string;
  includeWeekly?: boolean;
}): Promise<SnapshotBase | null> {
  const { schoolId, scope, classId, includeWeekly } = params;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, timezone: true, absenceCutoffMinutes: true },
  });

  if (!school) return null;

  const now = new Date();
  const timezone = school.timezone || "Asia/Tashkent";
  const today = getDateOnlyInZone(now, timezone);
  const todayEnd = addDaysUtc(today, 1);

  const classes = await prisma.class.findMany({
    where: { schoolId },
    select: { id: true, startTime: true, endTime: true },
  });

  const filteredClasses = classId
    ? classes.filter((cls) => cls.id === classId)
    : classes;

  if (classId && filteredClasses.length === 0) {
    return null;
  }

  const nowMinutes = getNowMinutesInZone(now, timezone);
  const startedClassIds = getStartedClassIds({
    classes: filteredClasses.map((cls) => ({
      id: cls.id,
      startTime: cls.startTime,
    })),
    nowMinutes,
  });
  const activeClassIds = getActiveClassIds({
    classes: filteredClasses.map((cls) => ({
      id: cls.id,
      startTime: cls.startTime,
      endTime: cls.endTime,
    })),
    nowMinutes,
    absenceCutoffMinutes: school.absenceCutoffMinutes,
  });

  const effectiveClassIds =
    scope === "active" ? activeClassIds : startedClassIds;

  const dateRange = { startDate: today, endDate: today };
  const fallbackClassIds =
    scope === "started" && effectiveClassIds.length === 0
      ? filteredClasses.map((cls) => cls.id)
      : effectiveClassIds;
  const rangeClassIds = fallbackClassIds.length > 0 ? fallbackClassIds : [];

  const [statusResult, currentlyInSchoolCount, classStudentCounts] =
    rangeClassIds.length > 0
      ? await Promise.all([
          getStatusCountsByRange({
            schoolId: school.id,
            dateRange,
            classIds: rangeClassIds,
          }),
          prisma.dailyAttendance.count({
            where: {
              schoolId: school.id,
              date: { gte: today, lt: todayEnd },
              currentlyInSchool: true,
              student: { classId: { in: rangeClassIds } },
            },
          }),
          prisma.student.groupBy({
            by: ["classId"],
            where: {
              schoolId: school.id,
              isActive: true,
              classId: { in: rangeClassIds },
            },
            _count: true,
          }),
        ])
      : [
          { counts: emptyStatusCounts(), daysCount: 1 },
          0,
          [] as ClassCountRow[],
        ];

  const classesForSplit = filteredClasses
    .filter((cls) => rangeClassIds.includes(cls.id))
    .map((cls) => ({ id: cls.id, startTime: cls.startTime || null }));

  const { noScanSplit, totalActiveStudents } = rangeClassIds.length
    ? await computeNoScanSplit({
        schoolId: school.id,
        dateStart: today,
        dateEnd: todayEnd,
        classIds: rangeClassIds,
        classes: classesForSplit,
        classStudentCounts: classStudentCounts as ClassCountRow[],
        absenceCutoffMinutes: school.absenceCutoffMinutes,
        nowMinutes,
      })
    : {
        noScanSplit: { pendingEarly: 0, pendingLate: 0, absent: 0 },
        totalActiveStudents: 0,
      };

  const stats = statusResult.counts;

  let weeklyStats: WeeklySnapshotEntry[] | undefined;
  if (includeWeekly) {
    const weekDates: Date[] = [];
    for (let i = 6; i >= 0; i--) {
      weekDates.push(addDaysUtc(today, -i));
    }
    const weeklyMap = await getWeeklyStatusMap({
      schoolId: school.id,
      startDate: weekDates[0],
      endDate: addDaysUtc(weekDates[6], 1),
      classIds: rangeClassIds.length > 0 ? rangeClassIds : [],
    });

    weeklyStats = weekDates.map((date) => {
      const dateKey = date.toISOString().split("T")[0];
      const entry = weeklyMap.get(dateKey) || {
        present: 0,
        late: 0,
        absent: 0,
      };
      return {
        date: dateKey,
        dayName: WEEKDAY_SHORT[date.getUTCDay()],
        present: entry.present,
        late: entry.late,
        absent: entry.absent,
      };
    });
  }

  return {
    scope,
    timestamp: now.toISOString(),
    stats: {
      totalStudents: totalActiveStudents,
      present: stats.present,
      late: stats.late,
      absent: stats.absent + noScanSplit.absent,
      excused: stats.excused,
      currentlyInSchool: currentlyInSchoolCount,
      pendingEarly: noScanSplit.pendingEarly,
      pendingLate: noScanSplit.pendingLate,
    },
    weeklyStats,
  };
}

export async function computeSchoolSnapshot(
  schoolId: string,
  scope: SnapshotScope = "started",
  options: { includeWeekly?: boolean } = {},
): Promise<SchoolSnapshotPayload | null> {
  const base = await computeSnapshotBase({
    schoolId,
    scope,
    includeWeekly: options.includeWeekly,
  });

  if (!base) return null;

  return {
    type: "school_snapshot",
    schoolId,
    scope: base.scope,
    timestamp: base.timestamp,
    stats: base.stats,
    weeklyStats: base.weeklyStats,
  };
}

export async function computeClassSnapshot(
  schoolId: string,
  classId: string,
  scope: SnapshotScope = "started",
  options: { includeWeekly?: boolean } = {},
): Promise<ClassSnapshotPayload | null> {
  const base = await computeSnapshotBase({
    schoolId,
    classId,
    scope,
    includeWeekly: options.includeWeekly,
  });

  if (!base) return null;

  return {
    type: "class_snapshot",
    schoolId,
    classId,
    scope: base.scope,
    timestamp: base.timestamp,
    stats: base.stats,
    weeklyStats: base.weeklyStats,
  };
}

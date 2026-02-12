import {
  DashboardHttpDeps,
  DateRangeType,
} from "./dashboard.routes.deps";

type AdminSchool = {
  id: string;
  timezone: string | null;
  absenceCutoffMinutes: number;
};

export type AdminPerSchoolStats = {
  schoolId: string;
  attendanceCounts: { present: number; late: number; absent: number; excused: number };
  currentlyInSchoolCount: number;
  weeklyStatusMap: Map<string, { present: number; late: number; absent: number }>;
  totalStudents: number;
  daysCount: number;
  noScanSplit: { pendingEarly: number; pendingLate: number; absent: number };
};

export async function buildAdminPerSchoolStats(params: {
  deps: DashboardHttpDeps;
  school: AdminSchool;
  now: Date;
  periodType: DateRangeType;
  startDate?: string;
  endDate?: string;
  attendanceScope: "started" | "active";
}): Promise<AdminPerSchoolStats> {
  const { deps, school, now, periodType, startDate, endDate, attendanceScope } =
    params;
  const { attendanceRepo,
    addDaysUtc,
    getDateOnlyInZone,
    getDateRangeInZone,
    getActiveClassIds,
    getNowMinutesInZone,
    getStartedClassIds,
    computeNoScanSplit,
    getStatusCountsByRange,
    getWeeklyStatusMap,
  } = deps;

  const tz = school.timezone || "Asia/Tashkent";
  const today = getDateOnlyInZone(now, tz);
  const dateRange = getDateRangeInZone(periodType, tz, startDate, endDate);
  const isSingleDay = dateRange.startDate.getTime() === dateRange.endDate.getTime();
  const isToday = isSingleDay && dateRange.startDate.getTime() === today.getTime();
  const weekEnd = dateRange.endDate;
  const weekStart = addDaysUtc(weekEnd, -6);
  const weekRangeEnd = addDaysUtc(weekEnd, 1);
  const nowMinutes = getNowMinutesInZone(now, tz);

  const classes = await attendanceRepo.class.findMany({
    where: { schoolId: school.id },
    select: { id: true, startTime: true, endTime: true },
  });
  const scopedClassIds = classes.map((cls) => cls.id);
  const activeClassIds = getActiveClassIds({
    classes,
    nowMinutes,
    absenceCutoffMinutes: school.absenceCutoffMinutes,
  });
  const startedClassIds = getStartedClassIds({ classes, nowMinutes });
  const effectiveClassIds = isToday
    ? attendanceScope === "active"
      ? activeClassIds
      : startedClassIds
    : scopedClassIds;
  const effectiveClassIdsWithFallback =
    isToday && attendanceScope === "started" && effectiveClassIds.length === 0
      ? scopedClassIds
      : effectiveClassIds;

  if (effectiveClassIdsWithFallback.length === 0) {
    return {
      schoolId: school.id,
      attendanceCounts: { present: 0, late: 0, absent: 0, excused: 0 },
      currentlyInSchoolCount: 0,
      weeklyStatusMap: new Map<
        string,
        { present: number; late: number; absent: number }
      >(),
      totalStudents: 0,
      daysCount: 1,
      noScanSplit: { pendingEarly: 0, pendingLate: 0, absent: 0 },
    };
  }

  const [statusResult, currentlyInSchoolCount, weeklyStatusMap, classStudentCounts] =
    await Promise.all([
      getStatusCountsByRange({
        schoolId: school.id,
        dateRange,
        classIds: effectiveClassIdsWithFallback,
      }),
      isToday
        ? attendanceRepo.dailyAttendance.count({
            where: {
              schoolId: school.id,
              date: { gte: today, lt: addDaysUtc(today, 1) },
              currentlyInSchool: true,
              student: { classId: { in: effectiveClassIdsWithFallback } },
            },
          })
        : Promise.resolve(0),
      getWeeklyStatusMap({
        schoolId: school.id,
        startDate: weekStart,
        endDate: weekRangeEnd,
        classIds: effectiveClassIdsWithFallback,
      }),
      attendanceRepo.student.groupBy({
        by: ["classId"],
        where: {
          schoolId: school.id,
          isActive: true,
          classId: { in: effectiveClassIdsWithFallback },
        },
        _count: true,
      }),
    ]);

  let totalActiveStudents = 0;
  classStudentCounts.forEach((row) => {
    if (row.classId) {
      totalActiveStudents += row._count;
    }
  });

  const classesForSplit = classes
    .filter((cls) => effectiveClassIdsWithFallback.includes(cls.id))
    .map((cls) => ({ id: cls.id, startTime: cls.startTime || null }));
  const noScanSplit = isToday
    ? (
        await computeNoScanSplit({
          schoolId: school.id,
          dateStart: today,
          dateEnd: addDaysUtc(today, 1),
          classIds: effectiveClassIdsWithFallback,
          classes: classesForSplit,
          classStudentCounts,
          absenceCutoffMinutes: school.absenceCutoffMinutes,
          nowMinutes,
        })
      ).noScanSplit
    : { pendingEarly: 0, pendingLate: 0, absent: 0 };

  return {
    schoolId: school.id,
    attendanceCounts: statusResult.counts,
    currentlyInSchoolCount,
    weeklyStatusMap,
    totalStudents: totalActiveStudents,
    daysCount: isSingleDay ? 1 : statusResult.daysCount,
    noScanSplit,
  };
}


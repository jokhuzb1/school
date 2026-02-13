import { DashboardHttpDeps } from "./dashboard.routes.deps";

export async function loadSchoolDashboardMetrics(params: {
  deps: DashboardHttpDeps;
  schoolId: string;
  isToday: boolean;
  today: Date;
  todayEnd: Date;
  studentFilter: any;
  attendanceStudentFilter: any;
  dateRange: { startDate: Date; endDate: Date };
  weekDates: Date[];
  periodClassIds: string[] | null;
}) {
  const {
    deps,
    schoolId,
    isToday,
    today,
    todayEnd,
    studentFilter,
    attendanceStudentFilter,
    dateRange,
    weekDates,
    periodClassIds,
  } = params;
  const { attendanceRepo, addDaysUtc, getStatusCountsByRange, getWeeklyStatusMap } = deps;

  const [
    totalStudents,
    statusResult,
    currentlyInSchoolCount,
    weeklyStatusMap,
    arrivedStudentIds,
    classStudentCounts,
  ] = await Promise.all([
    attendanceRepo.student.count({ where: studentFilter }),
    getStatusCountsByRange({
      schoolId,
      dateRange,
      classIds: periodClassIds,
    }),
    isToday
      ? attendanceRepo.dailyAttendance.count({
          where: {
            schoolId,
            date: { gte: today, lt: todayEnd },
            currentlyInSchool: true,
            ...attendanceStudentFilter,
          },
        })
      : Promise.resolve(0),
    getWeeklyStatusMap({
      schoolId,
      startDate: weekDates[0],
      endDate: addDaysUtc(weekDates[6], 1),
      classIds: periodClassIds,
    }),
    isToday
      ? attendanceRepo.dailyAttendance.findMany({
          where: {
            schoolId,
            date: { gte: today, lt: todayEnd },
            ...attendanceStudentFilter,
          },
          select: { studentId: true },
        })
      : Promise.resolve([]),
    isToday
      ? attendanceRepo.student.groupBy({
          by: ["classId"],
          where: {
            schoolId,
            isActive: true,
            classId: { in: params.periodClassIds || ["__none__"] },
          },
          _count: true,
        })
      : Promise.resolve([]),
  ]);

  return {
    totalStudents,
    statusResult,
    currentlyInSchoolCount,
    weeklyStatusMap,
    arrivedStudentIds,
    classStudentCounts,
  };
}


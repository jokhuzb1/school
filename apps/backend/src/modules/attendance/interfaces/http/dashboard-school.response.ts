type WeeklyStatus = { present: number; late: number; absent: number };

type BuildSchoolDashboardResponseInput = {
  period?: string;
  dateRange: { label: string; startDate: Date; endDate: Date };
  daysCount: number;
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  excusedToday: number;
  currentlyInSchoolCount: number;
  timezone: string;
  totalPresent: number;
  totalLate: number;
  totalAbsent: number;
  totalExcused: number;
  classBreakdown: any;
  weekDates: Date[];
  weeklyStatusMap: Map<string, WeeklyStatus>;
  pendingEarlyCount: number;
  latePendingCount: number;
  notYetArrived: any[];
  isToday: boolean;
  noScanAbsent: number;
  calculateAttendancePercent: (
    present: number,
    late: number,
    total: number,
  ) => number;
  normalizeAbsentCount: (input: {
    totalStudents: number;
    present: number;
    late: number;
    excused: number;
    pendingEarly: number;
    pendingLate: number;
    absentRaw: number;
  }) => number;
};

export function buildSchoolWeeklyStats(
  weekDates: Date[],
  weeklyStatusMap: Map<string, WeeklyStatus>,
) {
  return weekDates.map((date) => {
    const dateKey = date.toISOString().split("T")[0];
    const dayIndex = date.getUTCDay();
    const stats = weeklyStatusMap.get(dateKey) || {
      present: 0,
      late: 0,
      absent: 0,
    };
    return {
      date: dateKey,
      dayName: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][dayIndex],
      present: stats.present,
      late: stats.late,
      absent: stats.absent,
    };
  });
}

export function buildSchoolDashboardResponse(
  input: BuildSchoolDashboardResponseInput,
) {
  const {
    period,
    dateRange,
    daysCount,
    totalStudents,
    presentToday,
    lateToday,
    absentToday,
    excusedToday,
    currentlyInSchoolCount,
    timezone,
    totalPresent,
    totalLate,
    totalAbsent,
    totalExcused,
    classBreakdown,
    weekDates,
    weeklyStatusMap,
    pendingEarlyCount,
    latePendingCount,
    notYetArrived,
    isToday,
    noScanAbsent,
    calculateAttendancePercent,
    normalizeAbsentCount,
  } = input;

  const adjustedAbsentToday = normalizeAbsentCount({
    totalStudents,
    present: presentToday,
    late: lateToday,
    excused: excusedToday,
    pendingEarly: isToday ? pendingEarlyCount : 0,
    pendingLate: isToday ? latePendingCount : 0,
    absentRaw: absentToday + (isToday ? noScanAbsent : 0),
  });

  return {
    period: period || "today",
    periodLabel: dateRange.label,
    startDate: dateRange.startDate.toISOString(),
    endDate: dateRange.endDate.toISOString(),
    daysCount,
    totalStudents,
    presentToday,
    lateToday,
    absentToday: adjustedAbsentToday,
    excusedToday,
    currentlyInSchool: currentlyInSchoolCount,
    timezone,
    presentPercentage: calculateAttendancePercent(
      presentToday,
      lateToday,
      totalStudents,
    ),
    totalPresent,
    totalLate,
    totalAbsent,
    totalExcused,
    currentTime: new Date().toISOString(),
    classBreakdown,
    weeklyStats: buildSchoolWeeklyStats(weekDates, weeklyStatusMap),
    notYetArrived: isToday ? notYetArrived : [],
    notYetArrivedCount: isToday ? pendingEarlyCount + latePendingCount : 0,
    pendingEarlyCount: isToday ? pendingEarlyCount : 0,
    latePendingCount: isToday ? latePendingCount : 0,
  };
}


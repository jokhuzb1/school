import { addDaysUtc } from "../../../../utils/date";
import { AttendanceStatsReadPort } from "./ports";
import { DateRange, emptyStatusCounts, StatusCounts } from "./types";

export async function getStatusCountsByRange(params: {
  schoolId: string;
  dateRange: DateRange;
  classIds?: string[] | null;
  repo: AttendanceStatsReadPort;
}): Promise<{ counts: StatusCounts; daysCount: number }> {
  const { schoolId, dateRange, classIds, repo } = params;
  if (Array.isArray(classIds) && classIds.length === 0) {
    return { counts: emptyStatusCounts(), daysCount: 1 };
  }

  const rangeEnd = addDaysUtc(dateRange.endDate, 1);
  const [stats, daysCount] = await Promise.all([
    repo.getAttendanceStatusCounts({
      schoolId,
      dateRange,
      classIds,
    }),
    repo.countDistinctAttendanceDays({
      schoolId,
      dateStart: dateRange.startDate,
      dateEnd: rangeEnd,
      classIds,
    }),
  ]);

  const counts = emptyStatusCounts();
  stats.forEach((stat) => {
    if (stat.status === "PRESENT") counts.present = stat.count;
    else if (stat.status === "LATE") counts.late = stat.count;
    else if (stat.status === "ABSENT") counts.absent = stat.count;
    else if (stat.status === "EXCUSED") counts.excused = stat.count;
  });

  return { counts, daysCount };
}

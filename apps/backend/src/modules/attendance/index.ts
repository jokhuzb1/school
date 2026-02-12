import {
  getStatusCountsByRange as getStatusCountsByRangeUseCase,
} from "./application/attendance-stats/status-counts.service";
import {
  getClassBreakdown as getClassBreakdownUseCase,
  getWeeklyStatusMap as getWeeklyStatusMapUseCase,
} from "./application/attendance-stats/weekly-breakdown.service";
import {
  computeNoScanSplit as computeNoScanSplitUseCase,
  getAttendanceCountsByClass as getAttendanceCountsByClassUseCase,
  getPendingNotArrivedList as getPendingNotArrivedListUseCase,
} from "./application/attendance-stats/no-scan.service";
import { AttendanceStatsReadPort } from "./application/attendance-stats/ports";
import { ClassCountRow, DateRange } from "./application/attendance-stats/types";
import { attendanceStatsPrismaRepository } from "./infrastructure/attendance-stats/attendance-stats.prisma-repository";

export * from "./domain";
export * from "./application/attendance-stats/types";
export * from "./application/attendance-stats/ports";

export { attendanceStatsPrismaRepository };

export async function getStatusCountsByRange(params: {
  schoolId: string;
  dateRange: DateRange;
  classIds?: string[] | null;
  repo?: AttendanceStatsReadPort;
}) {
  const { repo = attendanceStatsPrismaRepository, ...rest } = params;
  return getStatusCountsByRangeUseCase({ ...rest, repo });
}

export async function getWeeklyStatusMap(params: {
  schoolId: string;
  startDate: Date;
  endDate: Date;
  classIds?: string[] | null;
  repo?: AttendanceStatsReadPort;
}) {
  const { repo = attendanceStatsPrismaRepository, ...rest } = params;
  return getWeeklyStatusMapUseCase({ ...rest, repo });
}

export async function getClassBreakdown(params: {
  schoolId: string;
  dateRange: DateRange;
  classIds?: string[] | null;
  classes: Array<{ id: string; name: string; _count: { students: number } }>;
  repo?: AttendanceStatsReadPort;
}) {
  const { repo = attendanceStatsPrismaRepository, ...rest } = params;
  return getClassBreakdownUseCase({ ...rest, repo });
}

export async function getAttendanceCountsByClass(params: {
  schoolId: string;
  dateStart: Date;
  dateEnd: Date;
  classIds: string[];
  repo?: AttendanceStatsReadPort;
}) {
  const { repo = attendanceStatsPrismaRepository, ...rest } = params;
  return getAttendanceCountsByClassUseCase({ ...rest, repo });
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
  repo?: AttendanceStatsReadPort;
}) {
  const { repo = attendanceStatsPrismaRepository, ...rest } = params;
  return computeNoScanSplitUseCase({ ...rest, repo });
}

export async function getPendingNotArrivedList(params: {
  schoolId: string;
  classIds: string[];
  arrivedStudentIds: string[];
  absenceCutoffMinutes: number;
  nowMinutes: number;
  limit?: number;
  repo?: AttendanceStatsReadPort;
}) {
  const { repo = attendanceStatsPrismaRepository, ...rest } = params;
  return getPendingNotArrivedListUseCase({ ...rest, repo });
}

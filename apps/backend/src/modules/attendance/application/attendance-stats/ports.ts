import { DateRange } from "./types";

export type AttendanceStatusCountRow = {
  status: string;
  count: number;
};

export type AttendanceDateStatusCountRow = {
  date: Date;
  status: string;
  count: number;
};

export type AttendanceClassBreakdownRow = {
  classId: string;
  status: string;
  count: number;
};

export type AttendanceClassRow = {
  classId: string | null;
};

export type PendingNotArrivedStudentRow = {
  id: string;
  name: string;
  className: string;
  classStartTime: string | null;
};

export type AttendanceStatsReadPort = {
  countDistinctAttendanceDays(params: {
    schoolId: string;
    dateStart: Date;
    dateEnd: Date;
    classIds?: string[] | null;
  }): Promise<number>;
  getAttendanceStatusCounts(params: {
    schoolId: string;
    dateRange: DateRange;
    classIds?: string[] | null;
  }): Promise<AttendanceStatusCountRow[]>;
  getAttendanceDateStatusCounts(params: {
    schoolId: string;
    startDate: Date;
    endDate: Date;
    classIds?: string[] | null;
  }): Promise<AttendanceDateStatusCountRow[]>;
  getAttendanceClassBreakdown(params: {
    schoolId: string;
    dateRange: DateRange;
    classIds?: string[] | null;
  }): Promise<AttendanceClassBreakdownRow[]>;
  getAttendanceClassRows(params: {
    schoolId: string;
    dateStart: Date;
    dateEnd: Date;
    classIds: string[];
  }): Promise<AttendanceClassRow[]>;
  getPendingNotArrivedStudents(params: {
    schoolId: string;
    classIds: string[];
    arrivedStudentIds: string[];
    limit: number;
  }): Promise<PendingNotArrivedStudentRow[]>;
};

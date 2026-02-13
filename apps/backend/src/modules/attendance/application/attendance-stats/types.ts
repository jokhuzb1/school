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

export const emptyStatusCounts = (): StatusCounts => ({
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
});

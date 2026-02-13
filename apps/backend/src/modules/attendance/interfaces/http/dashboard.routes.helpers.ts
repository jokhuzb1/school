export function normalizeAbsentCount(params: {
  totalStudents: number;
  present: number;
  late: number;
  excused?: number;
  pendingEarly?: number;
  pendingLate?: number;
  absentRaw: number;
}): number {
  const total = Math.max(0, params.totalStudents || 0);
  const reserved =
    Math.max(0, params.present || 0) +
    Math.max(0, params.late || 0) +
    Math.max(0, params.excused || 0) +
    Math.max(0, params.pendingEarly || 0) +
    Math.max(0, params.pendingLate || 0);
  const maxAbsent = Math.max(0, total - reserved);
  return Math.min(Math.max(0, params.absentRaw || 0), maxAbsent);
}


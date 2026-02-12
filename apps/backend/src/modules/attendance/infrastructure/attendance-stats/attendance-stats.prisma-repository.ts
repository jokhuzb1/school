import { Prisma } from "@prisma/client";
import prisma from "../../../../prisma";
import { addDaysUtc } from "../../../../utils/date";
import {
  AttendanceClassBreakdownRow,
  AttendanceClassRow,
  AttendanceDateStatusCountRow,
  AttendanceStatsReadPort,
  AttendanceStatusCountRow,
  PendingNotArrivedStudentRow,
} from "../../application/attendance-stats/ports";

export const attendanceStatsPrismaRepository: AttendanceStatsReadPort = {
  async countDistinctAttendanceDays(params) {
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
  },

  async getAttendanceStatusCounts(params) {
    const { schoolId, dateRange, classIds } = params;
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

    const rows = await prisma.dailyAttendance.groupBy({
      by: ["status"],
      where,
      _count: true,
    });

    return rows.map(
      (row) =>
        ({
          status: row.status,
          count: row._count,
        }) satisfies AttendanceStatusCountRow,
    );
  },

  async getAttendanceDateStatusCounts(params) {
    const { schoolId, startDate, endDate, classIds } = params;
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

    return rows.map(
      (row) =>
        ({
          date: row.date,
          status: row.status,
          count: row._count,
        }) satisfies AttendanceDateStatusCountRow,
    );
  },

  async getAttendanceClassBreakdown(params) {
    const { schoolId, dateRange, classIds } = params;
    const rangeEnd = addDaysUtc(dateRange.endDate, 1);
    const classFilterSql =
      Array.isArray(classIds) && classIds.length > 0
        ? Prisma.sql`AND s."classId" IN (${Prisma.join(classIds)})`
        : Prisma.empty;

    const rows = await prisma.$queryRaw<
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

    return rows.map(
      (row) =>
        ({
          classId: row.classId,
          status: row.status,
          count: Number(row.count),
        }) satisfies AttendanceClassBreakdownRow,
    );
  },

  async getAttendanceClassRows(params) {
    const { schoolId, dateStart, dateEnd, classIds } = params;
    if (!classIds.length) return [];

    const rows = await prisma.dailyAttendance.findMany({
      where: {
        schoolId,
        date: { gte: dateStart, lt: dateEnd },
        student: { classId: { in: classIds }, isActive: true },
      },
      select: {
        student: { select: { classId: true } },
      },
    });

    return rows.map(
      (row) =>
        ({
          classId: row.student?.classId || null,
        }) satisfies AttendanceClassRow,
    );
  },

  async getPendingNotArrivedStudents(params) {
    const { schoolId, classIds, arrivedStudentIds, limit } = params;
    if (!classIds.length) return [];

    const rows = await prisma.student.findMany({
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

    return rows.map(
      (row) =>
        ({
          id: row.id,
          name: row.name,
          className: row.class?.name || "-",
          classStartTime: row.class?.startTime || null,
        }) satisfies PendingNotArrivedStudentRow,
    );
  },
};

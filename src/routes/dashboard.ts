import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import {
  addDaysUtc,
  dateKeyToUtcDate,
  getDateOnlyInZone,
  getDateRangeInZone,
  DateRangeType,
} from "../utils/date";
import {
  getTeacherAllowedClassIds,
  requireRoles,
  requireSchoolScope,
} from "../utils/authz";
import { sendHttpError } from "../utils/httpErrors";
import { Prisma } from "@prisma/client";
import {
  computeAttendanceStatus,
  getActiveClassIds,
  getNowMinutesInZone,
  getStartedClassIds,
  splitNoScanCountsByClass,
} from "../utils/attendanceStatus";

// ✅ OPTIMIZED: SuperAdmin uchun barcha maktablar statistikasi
export async function adminDashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/admin/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        // Faqat SUPER_ADMIN uchun
        if (request.user.role !== "SUPER_ADMIN") {
          throw { statusCode: 403, message: "Forbidden" };
        }

        const now = new Date();
        const { scope, period, startDate, endDate } = request.query as {
          scope?: "started" | "active";
          period?: DateRangeType;
          startDate?: string;
          endDate?: string;
        };
        const attendanceScope = scope === "active" ? "active" : "started";
        const periodType: DateRangeType = period || "today";

        // ✅ OPTIMIZATION 1: Bitta query bilan barcha maktablar + counts
        const schools = await prisma.school.findMany({
          include: {
            _count: {
              select: { students: true, classes: true, devices: true },
            },
          },
        });

        // Per-school attendance stats using each school's timezone
        const perSchool = await Promise.all(
          schools.map(async (school) => {
            const tz = school.timezone || "Asia/Tashkent";
            const today = getDateOnlyInZone(now, tz);
            const dateRange = getDateRangeInZone(
              periodType,
              tz,
              startDate,
              endDate,
            );
            const rangeEnd = addDaysUtc(dateRange.endDate, 1);
            const isSingleDay =
              dateRange.startDate.getTime() === dateRange.endDate.getTime();
            const isToday =
              isSingleDay && dateRange.startDate.getTime() === today.getTime();
            const weekEnd = dateRange.endDate;
            const weekStart = addDaysUtc(weekEnd, -6);
            const weekRangeEnd = addDaysUtc(weekEnd, 1);

            const nowMinutes = getNowMinutesInZone(now, tz);
            const classes = await prisma.class.findMany({
              where: { schoolId: school.id },
              select: { id: true, startTime: true, endTime: true },
            });
            const scopedClassIds = classes.map((cls) => cls.id);
            const activeClassIds = getActiveClassIds({
              classes,
              nowMinutes,
              absenceCutoffMinutes: school.absenceCutoffMinutes,
            });
            const startedClassIds = getStartedClassIds({
              classes,
              nowMinutes,
            });
            const effectiveClassIds = isToday
              ? attendanceScope === "active"
                ? activeClassIds
                : startedClassIds
              : scopedClassIds;

            if (effectiveClassIds.length === 0) {
              return {
                schoolId: school.id,
                attendanceStats: [],
                currentlyInSchoolCount: 0,
                weeklyAttendance: [],
                totalStudents: 0,
                daysCount: 1,
                noScanSplit: { pendingEarly: 0, pendingLate: 0, absent: 0 },
              };
            }

            const [
              attendanceStats,
              currentlyInSchoolCount,
              weeklyAttendance,
              classStudentCounts,
              classAttendanceCounts,
              daysCount,
            ] = await Promise.all([
              prisma.dailyAttendance.groupBy({
                by: ["status"],
                where: {
                  schoolId: school.id,
                  date: { gte: dateRange.startDate, lt: rangeEnd },
                  student: { classId: { in: effectiveClassIds } },
                },
                _count: true,
              }),
              isToday
                ? prisma.dailyAttendance.count({
                    where: {
                      schoolId: school.id,
                      date: { gte: today, lt: addDaysUtc(today, 1) },
                      currentlyInSchool: true,
                      student: { classId: { in: effectiveClassIds } },
                    },
                  })
                : Promise.resolve(0),
              prisma.dailyAttendance.groupBy({
                by: ["date", "status"],
                where: {
                  schoolId: school.id,
                  date: {
                    gte: weekStart,
                    lt: weekRangeEnd,
                  },
                  student: { classId: { in: effectiveClassIds } },
                },
                _count: true,
              }),
              prisma.student.groupBy({
                by: ["classId"],
                where: { schoolId: school.id, isActive: true, classId: { in: effectiveClassIds } },
                _count: true,
              }),
              isToday
                ? prisma.$queryRaw<
                    Array<{
                      classId: string | null;
                      count: bigint;
                    }>
                  >`
                    SELECT s."classId", COUNT(*)::bigint as count
                    FROM "DailyAttendance" da
                    JOIN "Student" s ON da."studentId" = s.id
                    WHERE da."schoolId" = ${school.id}
                      AND da."date" >= ${today}
                      AND da."date" < ${addDaysUtc(today, 1)}
                      AND s."isActive" = true
                      AND s."classId" IN (${Prisma.join(effectiveClassIds)})
                    GROUP BY s."classId"
                  `
                : Promise.resolve([]),
              isSingleDay
                ? Promise.resolve(1)
                : prisma
                    .$queryRaw<Array<{ count: bigint }>>`
                      SELECT COUNT(DISTINCT da."date"::date)::bigint as count
                      FROM "DailyAttendance" da
                      JOIN "Student" s ON da."studentId" = s.id
                      WHERE da."schoolId" = ${school.id}
                        AND da."date" >= ${dateRange.startDate}
                        AND da."date" < ${rangeEnd}
                        AND s."classId" IN (${Prisma.join(effectiveClassIds)})
                    `
                    .then((res) => Number(res?.[0]?.count || 0) || 1),
            ]);

            const classStudentMap = new Map<string, number>();
            let totalActiveStudents = 0;
            classStudentCounts.forEach((row) => {
              if (row.classId) {
                classStudentMap.set(row.classId, row._count);
                totalActiveStudents += row._count;
              }
            });

            const classAttendanceMap = new Map<string, number>();
            if (isToday) {
              (classAttendanceCounts as Array<{ classId: string | null; count: bigint }>).forEach(
                (row) => {
                  if (row.classId) {
                    classAttendanceMap.set(row.classId, Number(row.count));
                  }
                },
              );
            }

            const classesForSplit = classes.filter((cls) =>
              effectiveClassIds.includes(cls.id),
            );
            const noScanSplit = isToday
              ? splitNoScanCountsByClass({
                  classes: classesForSplit,
                  classStudentCounts: classStudentMap,
                  classAttendanceCounts: classAttendanceMap,
                  absenceCutoffMinutes: school.absenceCutoffMinutes,
                  nowMinutes,
                })
              : { pendingEarly: 0, pendingLate: 0, absent: 0 };

            return {
              schoolId: school.id,
              attendanceStats,
              currentlyInSchoolCount,
              weeklyAttendance,
              totalStudents: totalActiveStudents,
              daysCount,
              noScanSplit,
            };
          }),
        );

        // Map attendance stats by school
        const statsMap = new Map<
          string,
          { present: number; late: number; absent: number; excused: number }
        >();
        const currentlyInSchoolMap = new Map<string, number>();
        const totalStudentsMap = new Map<string, number>();
        const daysCountMap = new Map<string, number>();
        const weeklyMap = new Map<
          string,
          { present: number; late: number; absent: number }
        >();
        const weeklyDateKeys = new Set<string>();
        const noScanMap = new Map<
          string,
          { pendingEarly: number; pendingLate: number; absent: number }
        >();

        perSchool.forEach((row) => {
          if (!row || !row.schoolId) return;
          const stats = { present: 0, late: 0, absent: 0, excused: 0 };
          row.attendanceStats.forEach((stat) => {
            if (stat.status === "PRESENT") stats.present = stat._count;
            else if (stat.status === "LATE") stats.late = stat._count;
            else if (stat.status === "ABSENT") stats.absent = stat._count;
            else if (stat.status === "EXCUSED") stats.excused = stat._count;
          });
          statsMap.set(row.schoolId, stats);
          currentlyInSchoolMap.set(row.schoolId, row.currentlyInSchoolCount);
          totalStudentsMap.set(row.schoolId, row.totalStudents || 0);
          daysCountMap.set(row.schoolId, row.daysCount || 1);
          if (row.noScanSplit) {
            noScanMap.set(row.schoolId, row.noScanSplit);
          }

          row.weeklyAttendance.forEach((stat) => {
            const dateKey = stat.date.toISOString().split("T")[0];
            weeklyDateKeys.add(dateKey);
            if (!weeklyMap.has(dateKey)) {
              weeklyMap.set(dateKey, { present: 0, late: 0, absent: 0 });
            }
            const entry = weeklyMap.get(dateKey)!;
            if (stat.status === "PRESENT") entry.present += stat._count;
            else if (stat.status === "LATE") entry.late += stat._count;
            else if (stat.status === "ABSENT") entry.absent += stat._count;
          });
        });

        // Maktablar statistikasini yig'ish - O(n) vaqt, database query YO'Q
        const schoolsWithStats = schools.map((school) => {
          const stats = statsMap.get(school.id) || {
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
          };
          const daysCount = daysCountMap.get(school.id) || 1;
          const avgPresent =
            daysCount > 1 ? Math.round(stats.present / daysCount) : stats.present;
          const avgLate =
            daysCount > 1 ? Math.round(stats.late / daysCount) : stats.late;
          const avgAbsent =
            daysCount > 1 ? Math.round(stats.absent / daysCount) : stats.absent;
          const avgExcused =
            daysCount > 1
              ? Math.round(stats.excused / daysCount)
              : stats.excused;
          const totalStudents = totalStudentsMap.get(school.id) || 0;
          const currentlyInSchool = currentlyInSchoolMap.get(school.id) || 0;
          const totalPresent = avgPresent + avgLate;
          const noScanSplit =
            noScanMap.get(school.id) || {
              pendingEarly: 0,
              pendingLate: 0,
              absent: 0,
            };
          const attendancePercent =
            totalStudents > 0
              ? Math.round((totalPresent / totalStudents) * 100)
              : 0;

          return {
            id: school.id,
            name: school.name,
            address: school.address,
            totalStudents,
            totalClasses: school._count.classes,
            totalDevices: school._count.devices,
            presentToday: avgPresent,
            lateToday: avgLate,
            absentToday: avgAbsent + noScanSplit.absent,
            excusedToday: avgExcused,
            pendingEarlyCount: noScanSplit.pendingEarly,
            latePendingCount: noScanSplit.pendingLate,
            currentlyInSchool,
            attendancePercent,
          };
        });

        // Umumiy statistika - faqat JavaScript hisoblash
        const totals = schoolsWithStats.reduce(
          (acc, s) => ({
            totalSchools: acc.totalSchools + 1,
            totalStudents: acc.totalStudents + s.totalStudents,
            presentToday: acc.presentToday + s.presentToday,
            lateToday: acc.lateToday + s.lateToday,
            absentToday: acc.absentToday + s.absentToday,
            excusedToday: acc.excusedToday + (s.excusedToday || 0),
            pendingEarlyCount: acc.pendingEarlyCount + (s.pendingEarlyCount || 0),
            latePendingCount: acc.latePendingCount + (s.latePendingCount || 0),
            currentlyInSchool: acc.currentlyInSchool + s.currentlyInSchool,
          }),
          {
            totalSchools: 0,
            totalStudents: 0,
            presentToday: 0,
            lateToday: 0,
            absentToday: 0,
            excusedToday: 0,
            pendingEarlyCount: 0,
            latePendingCount: 0,
            currentlyInSchool: 0,
          },
        );

        const overallArrived = totals.presentToday + totals.lateToday;
        const overallPercent =
          totals.totalStudents > 0
            ? Math.round((overallArrived / totals.totalStudents) * 100)
            : 0;

        const sortedDateKeys = Array.from(weeklyDateKeys).sort();
        const endKey =
          sortedDateKeys[sortedDateKeys.length - 1] ||
          getDateOnlyInZone(now, "UTC").toISOString().split("T")[0];
        const endDateUtc = dateKeyToUtcDate(endKey);
        const weekDates: Date[] = [];
        for (let i = 6; i >= 0; i--) {
          weekDates.push(addDaysUtc(endDateUtc, -i));
        }

        const weeklyStats = weekDates.map((date) => {
          const dateKey = date.toISOString().split("T")[0];
          const stats = weeklyMap.get(dateKey) || {
            present: 0,
            late: 0,
            absent: 0,
          };
          return {
            date: dateKey,
            dayName: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][
              date.getUTCDay()
            ],
            present: stats.present + stats.late,
            late: stats.late,
            absent: stats.absent,
          };
        });

        const recentEvents = await prisma.attendanceEvent.findMany({
          orderBy: { timestamp: "desc" },
          take: 15,
          include: {
            student: { include: { class: true } },
            device: true,
            school: true,
          },
        });

        return {
          totals: { ...totals, attendancePercent: overallPercent },
          schools: schoolsWithStats,
          recentEvents,
          weeklyStats,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}
// ✅ OPTIMIZED: School Dashboard with Time Filters
export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { classId, period, startDate, endDate, scope } = request.query as {
          classId?: string;
          period?: DateRangeType;
          startDate?: string;
          endDate?: string;
          scope?: "started" | "active";
        };
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const allowedClassIds =
          user.role === "TEACHER"
            ? await getTeacherAllowedClassIds(user.sub)
            : [];
        if (
          user.role === "TEACHER" &&
          classId &&
          !allowedClassIds.includes(classId)
        ) {
          return reply.status(403).send({ error: "forbidden" });
        }

        const now = new Date();
        const school = await prisma.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true, absenceCutoffMinutes: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";
        const absenceCutoffMinutes = school?.absenceCutoffMinutes ?? 180;
        const today = getDateOnlyInZone(now, tz);
        const todayEnd = addDaysUtc(today, 1);

        // Vaqt oralig'ini hisoblash (maktab timezone bo'yicha)
        const dateRange = getDateRangeInZone(
          period || "today",
          tz,
          startDate,
          endDate,
        );
        const isSingleDay =
          dateRange.startDate.getTime() === dateRange.endDate.getTime();
        const isToday =
          isSingleDay && dateRange.startDate.getTime() === today.getTime();
        const attendanceScope = scope === "active" ? "active" : "started";

        const classWhere: any = {
          schoolId,
          ...(classId
            ? { id: classId }
            : user.role === "TEACHER"
              ? {
                  id: {
                    in: allowedClassIds.length ? allowedClassIds : ["__none__"],
                  },
                }
              : {}),
        };

        const classes = await prisma.class.findMany({
          where: classWhere,
          include: { _count: { select: { students: true } } },
        });

        const scopedClassIds = classes.map((cls) => cls.id);
        const nowMinutes = getNowMinutesInZone(now, tz);
        const activeClassIds = isToday
          ? getActiveClassIds({
              classes: classes.map((cls) => ({
                id: cls.id,
                startTime: cls.startTime || null,
                endTime: cls.endTime || null,
              })),
              nowMinutes,
              absenceCutoffMinutes,
            })
          : scopedClassIds;
        const startedClassIds = isToday
          ? getStartedClassIds({
              classes: classes.map((cls) => ({
                id: cls.id,
                startTime: cls.startTime || null,
              })),
              nowMinutes,
            })
          : scopedClassIds;
        const effectiveClassIds = isToday
          ? attendanceScope === "active"
            ? activeClassIds
            : startedClassIds
          : scopedClassIds;
        const classIdFilterList =
          effectiveClassIds.length > 0 ? effectiveClassIds : ["__none__"];

        const classScopeFilter: any = classId
          ? { classId }
          : user.role === "TEACHER"
            ? {
                classId: {
                  in: allowedClassIds.length ? allowedClassIds : ["__none__"],
                },
              }
            : {};

        const studentFilter: any = isToday
          ? {
              schoolId,
              isActive: true,
              classId: { in: classIdFilterList },
            }
          : {
              schoolId,
              isActive: true,
              ...classScopeFilter,
            };

        // Haftalik sanalar tayyorlash (tanlangan davr oxiriga nisbatan)
        const weekDates: Date[] = [];
        for (let i = 6; i >= 0; i--) {
          weekDates.push(addDaysUtc(dateRange.endDate, -i));
        }

        // ✅ OPTIMIZATION 2: Barcha asosiy ma'lumotlarni parallel olish
        // Vaqt oralig'iga qarab date filter
        const rangeEnd = addDaysUtc(dateRange.endDate, 1);
        const dateFilter = {
          date: { gte: dateRange.startDate, lt: rangeEnd },
        };

        const attendanceStudentFilter = isToday
          ? { student: { classId: { in: classIdFilterList } } }
          : classId
            ? { student: { classId } }
            : user.role === "TEACHER"
              ? {
                  student: {
                    classId: {
                      in: allowedClassIds.length ? allowedClassIds : ["__none__"],
                    },
                  },
                }
              : {};

        const classFilterSql = Prisma.sql`AND s."classId" IN (${Prisma.join(classIdFilterList)})`;

        const [
          totalStudents,
          periodAttendanceStats,
          currentlyInSchoolCount,
          trendAttendance,
          arrivedStudentIds,
          totalAttendanceDays,
          classStudentCounts,
          classAttendanceCounts,
        ] = await Promise.all([
          // Total students
          prisma.student.count({ where: studentFilter }),
          // ✅ Period attendance - vaqt oralig'i bo'yicha groupBy query
          prisma.dailyAttendance.groupBy({
            by: ["status"],
            where: {
              schoolId,
              ...dateFilter,
              ...attendanceStudentFilter,
            },
            _count: true,
          }),
          // Hozir maktabda (faqat bugun uchun)
          isToday
            ? prisma.dailyAttendance.count({
                where: {
                  schoolId,
                  date: { gte: today, lt: todayEnd },
                  currentlyInSchool: true,
                  ...attendanceStudentFilter,
                },
              })
            : Promise.resolve(0),
          // ✅ Trend statistika - vaqt oralig'iga qarab
          prisma.dailyAttendance.groupBy({
            by: ["date", "status"],
            where: {
              schoolId,
              date: {
                gte: weekDates[0],
                lt: addDaysUtc(weekDates[6], 1),
              },
              ...attendanceStudentFilter,
            },
            _count: true,
          }),
          // Kelgan studentlar ID lari (faqat bugun uchun)
          isToday
            ? prisma.dailyAttendance.findMany({
                where: {
                  schoolId,
                  date: { gte: today, lt: todayEnd },
                  ...attendanceStudentFilter,
                },
                select: { studentId: true },
              })
            : Promise.resolve([]),
          // Vaqt oralig'idagi kunlar soni (o'rtacha hisoblash uchun)
          isSingleDay
            ? Promise.resolve(1)
            : prisma
                .$queryRaw<Array<{ count: bigint }>>`
                  SELECT COUNT(DISTINCT da."date"::date)::bigint as count
                  FROM "DailyAttendance" da
                  JOIN "Student" s ON da."studentId" = s.id
                  WHERE da."schoolId" = ${schoolId}
                    AND da."date" >= ${dateRange.startDate}
                    AND da."date" < ${rangeEnd}
                    ${classFilterSql}
                `
                .then((res) => Number(res?.[0]?.count || 0) || 1),
          // Active students by class (for no-scan split) - only for today
          isToday
            ? prisma.student.groupBy({
                by: ["classId"],
                where: {
                  schoolId,
                  isActive: true,
                  classId: { in: classIdFilterList },
                },
                _count: true,
              })
            : Promise.resolve([]),
          // Attendance records by class for today (any status) - only for today
          isToday
            ? prisma.$queryRaw<
                Array<{
                  classId: string | null;
                  count: bigint;
                }>
              >`
                SELECT s."classId", COUNT(*)::bigint as count
                FROM "DailyAttendance" da
                JOIN "Student" s ON da."studentId" = s.id
              WHERE da."schoolId" = ${schoolId}
                  AND da."date" >= ${today}
                  AND da."date" < ${todayEnd}
                  AND s."isActive" = true
                  AND s."classId" IN (${Prisma.join(classIdFilterList)})
                GROUP BY s."classId"
              `
            : Promise.resolve([]),
        ]);

        const daysCount =
          typeof totalAttendanceDays === "number" ? totalAttendanceDays : 1;

        // Period stats parsing
        let presentCount = 0,
          lateCount = 0,
          absentCount = 0,
          excusedCount = 0;
        periodAttendanceStats.forEach((stat) => {
          if (stat.status === "PRESENT") presentCount = stat._count;
          else if (stat.status === "LATE") lateCount = stat._count;
          else if (stat.status === "ABSENT") absentCount = stat._count;
          else if (stat.status === "EXCUSED") excusedCount = stat._count;
        });

        // Agar bir nechta kun bo'lsa, o'rtacha hisoblash
        const presentToday = isSingleDay
          ? presentCount
          : Math.round(presentCount / daysCount);
        const lateToday = isSingleDay
          ? lateCount
          : Math.round(lateCount / daysCount);
        const absentToday = isSingleDay
          ? absentCount
          : Math.round(absentCount / daysCount);
        const excusedToday = isSingleDay
          ? excusedCount
          : Math.round(excusedCount / daysCount);

        // ✅ OPTIMIZATION 3: Class breakdown - vaqt oralig'iga qarab raw query
        const classBreakdownQuery = await prisma.$queryRaw<
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
            ${classFilterSql}
          GROUP BY s."classId", da."status"
        `;

        // Class stats map
        const classStatsMap = new Map<
          string,
          { present: number; late: number }
        >();
        classBreakdownQuery.forEach((row) => {
          if (!row.classId) return;
          if (!classStatsMap.has(row.classId)) {
            classStatsMap.set(row.classId, { present: 0, late: 0 });
          }
          const entry = classStatsMap.get(row.classId)!;
          const count = Number(row.count);
          if (row.status === "PRESENT") entry.present += count;
          else if (row.status === "LATE") {
            entry.present += count;
            entry.late = count;
          }
        });

        const classesForBreakdown = isToday
          ? classes.filter((cls) => effectiveClassIds.includes(cls.id))
          : classes;

        const classBreakdown = classesForBreakdown.map((cls) => {
          const stats = classStatsMap.get(cls.id) || { present: 0, late: 0 };
          return {
            classId: cls.id,
            className: cls.name,
            total: cls._count.students,
            present: stats.present,
            late: stats.late,
          };
        });

        // ✅ OPTIMIZATION 4: Trend statistikani map qilish
        const trendMap = new Map<
          string,
          { present: number; late: number; absent: number }
        >();
        trendAttendance.forEach((stat) => {
          const dateKey = stat.date.toISOString().split("T")[0];
          if (!trendMap.has(dateKey)) {
            trendMap.set(dateKey, { present: 0, late: 0, absent: 0 });
          }
          const entry = trendMap.get(dateKey)!;
          if (stat.status === "PRESENT") entry.present += stat._count;
          else if (stat.status === "LATE") entry.late += stat._count;
          else if (stat.status === "ABSENT") entry.absent += stat._count;
        });

        const weeklyStats = weekDates.map((date) => {
          const dateKey = date.toISOString().split("T")[0];
          const dayIndex = date.getUTCDay();
          const stats = trendMap.get(dateKey) || {
            present: 0,
            late: 0,
            absent: 0,
          };
          return {
            date: dateKey,
            dayName: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][dayIndex],
            present: stats.present + stats.late,
            late: stats.late,
            absent: stats.absent,
          };
        });

        // ✅ OPTIMIZATION 5: Not yet arrived - parallel query
        const arrivedIds = arrivedStudentIds.map((a) => a.studentId);

        const hasScopedClasses = isToday && effectiveClassIds.length > 0;
        const notYetArrived = hasScopedClasses
          ? await prisma.student.findMany({
              where: {
                schoolId,
                isActive: true,
                classId: { in: classIdFilterList },
                id: { notIn: arrivedIds.length > 0 ? arrivedIds : ["none"] },
              },
              take: 20,
              include: { class: { select: { name: true, startTime: true } } },
              orderBy: { name: "asc" },
            })
          : [];

        const classStudentMap = new Map<string, number>();
        let unassignedTotal = 0;
        (classStudentCounts as any[]).forEach((row) => {
          if (row.classId) {
            classStudentMap.set(row.classId, row._count);
          } else {
            unassignedTotal = row._count;
          }
        });

        const classAttendanceMap = new Map<string, number>();
        let unassignedAttended = 0;
        (classAttendanceCounts as any[]).forEach((row) => {
          if (row.classId) {
            classAttendanceMap.set(row.classId, Number(row.count));
          } else {
            unassignedAttended = Number(row.count);
          }
        });

        const classesForSplit = classesForBreakdown.map((c) => ({
          id: c.id,
          startTime: c.startTime || null,
        }));
        if (unassignedTotal > 0 || unassignedAttended > 0) {
          const unassignedKey = "__unassigned__";
          classStudentMap.set(unassignedKey, unassignedTotal);
          classAttendanceMap.set(unassignedKey, unassignedAttended);
          classesForSplit.push({ id: unassignedKey, startTime: null });
        }

        const noScanSplit = isToday
          ? splitNoScanCountsByClass({
              classes: classesForSplit,
              classStudentCounts: classStudentMap,
              classAttendanceCounts: classAttendanceMap,
              absenceCutoffMinutes,
              nowMinutes,
            })
          : { pendingEarly: 0, pendingLate: 0, absent: 0 };

        // Split not-arrived students into pending vs absent (based on time)
        const pendingNotArrived: Array<
          typeof notYetArrived[number] & { pendingStatus: "PENDING_EARLY" | "PENDING_LATE" }
        > = [];
        let pendingEarlyCount = 0;
        let latePendingCount = 0;

        notYetArrived.forEach((s) => {
          const status = computeAttendanceStatus({
            dbStatus: null, // These students have no DailyAttendance record
            classStartTime: s.class?.startTime || null,
            absenceCutoffMinutes,
            nowMinutes,
          });

          if (status === "PENDING_EARLY") {
            pendingNotArrived.push({ ...s, pendingStatus: "PENDING_EARLY" });
            return;
          }

          if (status === "PENDING_LATE") {
            pendingNotArrived.push({ ...s, pendingStatus: "PENDING_LATE" });
            return;
          }
        });

        if (isToday) {
          pendingEarlyCount = noScanSplit.pendingEarly;
          latePendingCount = noScanSplit.pendingLate;
        }

        const adjustedAbsentToday =
          absentToday + (isToday ? noScanSplit.absent : 0);

        return {
          // Vaqt oralig'i ma'lumotlari
          period: period || "today",
          periodLabel: dateRange.label,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
          daysCount,

          // Statistikalar
          totalStudents,
          presentToday,
          lateToday,
          absentToday: adjustedAbsentToday,
          excusedToday,
          currentlyInSchool: currentlyInSchoolCount,
          timezone: tz,
          presentPercentage:
            totalStudents > 0
              ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
              : 0,

          // Jami sonlar (o'rtacha emas, vaqt oralig'idagi jami)
          totalPresent: presentCount,
          totalLate: lateCount,
          totalAbsent: absentCount,
          totalExcused: excusedCount,

          currentTime: new Date().toISOString(),
          classBreakdown,
          weeklyStats,
          notYetArrived: isToday
            ? pendingNotArrived.map((s) => ({
                id: s.id,
                name: s.name,
                className: s.class?.name || "-",
                pendingStatus: s.pendingStatus,
              }))
            : [],
          notYetArrivedCount: isToday
            ? pendingEarlyCount + latePendingCount
            : 0,
          pendingEarlyCount: isToday ? pendingEarlyCount : 0,
          latePendingCount: isToday ? latePendingCount : 0,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // ✅ Events endpoint - allaqachon optimallashtirilgan
  fastify.get(
    "/schools/:schoolId/events",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { limit = 10 } = request.query;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const allowedClassIds =
          user.role === "TEACHER"
            ? await getTeacherAllowedClassIds(user.sub)
            : [];

        const eventWhere: any = { schoolId };
        if (user.role === "TEACHER") {
          eventWhere.student = {
            classId: {
              in: allowedClassIds.length ? allowedClassIds : ["__none__"],
            },
          };
        }

        const events = await prisma.attendanceEvent.findMany({
          where: eventWhere,
          take: Number(limit),
          orderBy: { timestamp: "desc" },
          include: {
            student: {
              include: {
                class: true,
              },
            },
            device: true,
          },
        });

        return events;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

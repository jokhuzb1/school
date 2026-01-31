import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import {
  addDaysUtc,
  dateKeyToUtcDate,
  getDateOnlyInZone,
  getDateRangeInZone,
  DateRangeType,
} from "../../../utils/date";
import {
  getTeacherAllowedClassIds,
  requireRoles,
  requireSchoolScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import {
  calculateAttendancePercent,
  getActiveClassIds,
  getNowMinutesInZone,
  getStartedClassIds,
} from "../../../utils/attendanceStatus";
import {
  ClassCountRow,
  computeNoScanSplit,
  getClassBreakdown,
  getPendingNotArrivedList,
  getStatusCountsByRange,
  getWeeklyStatusMap,
} from "../../../modules/attendance";

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
            const effectiveClassIdsWithFallback =
              isToday &&
              attendanceScope === "started" &&
              effectiveClassIds.length === 0
                ? scopedClassIds
                : effectiveClassIds;

            if (effectiveClassIdsWithFallback.length === 0) {
              return {
                schoolId: school.id,
                attendanceCounts: { present: 0, late: 0, absent: 0, excused: 0 },
                currentlyInSchoolCount: 0,
                weeklyStatusMap: new Map<string, { present: number; late: number; absent: number }>(),
                totalStudents: 0,
                daysCount: 1,
                noScanSplit: { pendingEarly: 0, pendingLate: 0, absent: 0 },
              };
            }

            const [
              statusResult,
              currentlyInSchoolCount,
              weeklyStatusMap,
              classStudentCounts,
            ] = await Promise.all([
              getStatusCountsByRange({
                schoolId: school.id,
                dateRange,
                classIds: effectiveClassIdsWithFallback,
              }),
              isToday
                ? prisma.dailyAttendance.count({
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
              prisma.student.groupBy({
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
          const stats = row.attendanceCounts || {
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
          };
          statsMap.set(row.schoolId, stats);
          currentlyInSchoolMap.set(row.schoolId, row.currentlyInSchoolCount);
          totalStudentsMap.set(row.schoolId, row.totalStudents || 0);
          daysCountMap.set(row.schoolId, row.daysCount || 1);
          if (row.noScanSplit) {
            noScanMap.set(row.schoolId, row.noScanSplit);
          }

          row.weeklyStatusMap.forEach((stat, dateKey) => {
            weeklyDateKeys.add(dateKey);
            if (!weeklyMap.has(dateKey)) {
              weeklyMap.set(dateKey, { present: 0, late: 0, absent: 0 });
            }
            const entry = weeklyMap.get(dateKey)!;
            entry.present += stat.present;
            entry.late += stat.late;
            entry.absent += stat.absent;
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
          const noScanSplit =
            noScanMap.get(school.id) || {
              pendingEarly: 0,
              pendingLate: 0,
              absent: 0,
            };
          const attendancePercent = calculateAttendancePercent(
            avgPresent,
            avgLate,
            totalStudents,
          );

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

        const overallPercent = calculateAttendancePercent(
          totals.presentToday,
          totals.lateToday,
          totals.totalStudents,
        );

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
            present: stats.present,
            late: stats.late,
            absent: stats.absent,
          };
        });

        const todayUtc = getDateOnlyInZone(now, "UTC");
        const tomorrowUtc = addDaysUtc(todayUtc, 1);
        const recentEvents = await prisma.attendanceEvent.findMany({
          where: { timestamp: { gte: todayUtc, lt: tomorrowUtc } },
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
        const effectiveClassIdsWithFallback =
          isToday &&
          attendanceScope === "started" &&
          effectiveClassIds.length === 0
            ? scopedClassIds
            : effectiveClassIds;
        const classIdFilterList =
          effectiveClassIdsWithFallback.length > 0
            ? effectiveClassIdsWithFallback
            : ["__none__"];

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

        const periodClassIds: string[] | null = isToday
          ? classIdFilterList
          : classId
            ? [classId]
            : user.role === "TEACHER"
              ? allowedClassIds.length
                ? allowedClassIds
                : ["__none__"]
              : null;

        const [
          totalStudents,
          statusResult,
          currentlyInSchoolCount,
          weeklyStatusMap,
          arrivedStudentIds,
          classStudentCounts,
        ] = await Promise.all([
          // Total students
          prisma.student.count({ where: studentFilter }),
          // ✅ Period attendance counts (shared helper)
          getStatusCountsByRange({
            schoolId,
            dateRange,
            classIds: periodClassIds,
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
          // ✅ Weekly stats (shared helper)
          getWeeklyStatusMap({
            schoolId,
            startDate: weekDates[0],
            endDate: addDaysUtc(weekDates[6], 1),
            classIds: periodClassIds,
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
        ]);

        // Period stats parsing
        const daysCount = isSingleDay ? 1 : statusResult.daysCount;
        const presentCount = statusResult.counts.present;
        const lateCount = statusResult.counts.late;
        const absentCount = statusResult.counts.absent;
        const excusedCount = statusResult.counts.excused;

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
        const classesForBreakdown = Array.isArray(periodClassIds)
          ? classes.filter((cls) => periodClassIds.includes(cls.id))
          : classes;

        const classBreakdown = await getClassBreakdown({
          schoolId,
          dateRange,
          classIds: periodClassIds,
          classes: classesForBreakdown,
        });

        const weeklyStats = weekDates.map((date) => {
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

        // ✅ OPTIMIZATION 5: Not yet arrived - parallel query
        const arrivedIds = arrivedStudentIds.map((a) => a.studentId);

        const classesForSplit = classesForBreakdown.map((c) => ({
          id: c.id,
          startTime: c.startTime || null,
        }));
        const noScanSplit = isToday
          ? (
              await computeNoScanSplit({
                schoolId,
                dateStart: today,
                dateEnd: todayEnd,
                classIds: classIdFilterList,
                classes: classesForSplit,
                classStudentCounts: classStudentCounts as ClassCountRow[],
                absenceCutoffMinutes,
                nowMinutes,
              })
            ).noScanSplit
          : { pendingEarly: 0, pendingLate: 0, absent: 0 };

        const pendingNotArrived =
          isToday && classIdFilterList.length > 0
            ? await getPendingNotArrivedList({
                schoolId,
                classIds: classIdFilterList,
                arrivedStudentIds: arrivedIds,
                absenceCutoffMinutes,
                nowMinutes,
              })
            : [];

        let pendingEarlyCount = 0;
        let latePendingCount = 0;

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
          presentPercentage: calculateAttendancePercent(
            presentToday,
            lateToday,
            totalStudents,
          ),

          // Jami sonlar (o'rtacha emas, vaqt oralig'idagi jami)
          totalPresent: presentCount,
          totalLate: lateCount,
          totalAbsent: absentCount,
          totalExcused: excusedCount,

          currentTime: new Date().toISOString(),
          classBreakdown,
          weeklyStats,
          notYetArrived: isToday ? pendingNotArrived : [],
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

        const school = await prisma.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";
        const today = getDateOnlyInZone(new Date(), tz);
        const tomorrow = addDaysUtc(today, 1);

        const allowedClassIds =
          user.role === "TEACHER"
            ? await getTeacherAllowedClassIds(user.sub)
            : [];

        const eventWhere: any = { schoolId };
        eventWhere.timestamp = { gte: today, lt: tomorrow };
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

  // Historical events (API only, no realtime)
  fastify.get(
    "/schools/:schoolId/events/history",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { startDate, endDate, limit = 200, classId } = request.query as {
          startDate: string;
          endDate: string;
          limit?: number;
          classId?: string;
        };
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        if (!startDate || !endDate) {
          return reply.status(400).send({ error: "startDate and endDate required" });
        }

        const school = await prisma.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";

        const start = dateKeyToUtcDate(startDate);
        const end = addDaysUtc(dateKeyToUtcDate(endDate), 1);

        const allowedClassIds =
          user.role === "TEACHER"
            ? await getTeacherAllowedClassIds(user.sub)
            : [];

        const eventWhere: any = {
          schoolId,
          timestamp: { gte: start, lt: end },
        };

        if (classId) {
          if (user.role === "TEACHER" && !allowedClassIds.includes(classId)) {
            return reply.status(403).send({ error: "forbidden" });
          }
          eventWhere.student = { classId };
        } else if (user.role === "TEACHER") {
          eventWhere.student = {
            classId: {
              in: allowedClassIds.length ? allowedClassIds : ["__none__"],
            },
          };
        }

        const events = await prisma.attendanceEvent.findMany({
          where: eventWhere,
          take: Math.min(Number(limit) || 200, 500),
          orderBy: { timestamp: "desc" },
          include: {
            student: { include: { class: true } },
            device: true,
          },
        });

        return {
          timezone: tz,
          startDate,
          endDate,
          data: events,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

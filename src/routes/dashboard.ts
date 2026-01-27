import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import {
  addDaysUtc,
  dateKeyToUtcDate,
  getDateOnlyInZone,
  getDateRangeInZone,
  getTimePartsInZone,
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
  getNowMinutesInZone,
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

        // ✅ OPTIMIZATION 1: Bitta query bilan barcha maktablar + counts
        const schools = await prisma.school.findMany({
          include: {
            _count: {
              select: { students: true, classes: true, devices: true },
            },
          },
        });

        // Active students by school
        const studentCounts = await prisma.student.groupBy({
          by: ["schoolId"],
          where: { isActive: true },
          _count: true,
        });

        const studentCountMap = new Map<string, number>();
        studentCounts.forEach((s) => studentCountMap.set(s.schoolId, s._count));

        // Per-school attendance stats using each school's timezone
        const perSchool = await Promise.all(
          schools.map(async (school) => {
            const tz = school.timezone || "Asia/Tashkent";
            const today = getDateOnlyInZone(now, tz);

            const [attendanceStats, currentlyInSchoolCount, weeklyAttendance] =
              await Promise.all([
                prisma.dailyAttendance.groupBy({
                  by: ["status"],
                  where: { schoolId: school.id, date: today },
                  _count: true,
                }),
                prisma.dailyAttendance.count({
                  where: {
                    schoolId: school.id,
                    date: today,
                    currentlyInSchool: true,
                  },
                }),
                prisma.dailyAttendance.groupBy({
                  by: ["date", "status"],
                  where: {
                    schoolId: school.id,
                    date: {
                      gte: addDaysUtc(today, -6),
                      lte: today,
                    },
                  },
                  _count: true,
                }),
              ]);

            return {
              schoolId: school.id,
              attendanceStats,
              currentlyInSchoolCount,
              weeklyAttendance,
            };
          }),
        );

        // Map attendance stats by school
        const statsMap = new Map<
          string,
          { present: number; late: number; absent: number }
        >();
        const currentlyInSchoolMap = new Map<string, number>();
        const weeklyMap = new Map<
          string,
          { present: number; late: number; absent: number }
        >();
        const weeklyDateKeys = new Set<string>();

        perSchool.forEach((row) => {
          const stats = { present: 0, late: 0, absent: 0 };
          row.attendanceStats.forEach((stat) => {
            if (stat.status === "PRESENT") stats.present = stat._count;
            else if (stat.status === "LATE") stats.late = stat._count;
            else if (stat.status === "ABSENT") stats.absent = stat._count;
          });
          statsMap.set(row.schoolId, stats);
          currentlyInSchoolMap.set(row.schoolId, row.currentlyInSchoolCount);

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
          };
          const totalStudents = studentCountMap.get(school.id) || 0;
          const currentlyInSchool = currentlyInSchoolMap.get(school.id) || 0;
          const totalPresent = stats.present + stats.late;
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
            presentToday: totalPresent,
            lateToday: stats.late,
            absentToday: stats.absent,
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
            currentlyInSchool: acc.currentlyInSchool + s.currentlyInSchool,
          }),
          {
            totalSchools: 0,
            totalStudents: 0,
            presentToday: 0,
            lateToday: 0,
            absentToday: 0,
            currentlyInSchool: 0,
          },
        );

        const overallPercent =
          totals.totalStudents > 0
            ? Math.round((totals.presentToday / totals.totalStudents) * 100)
            : 0;

        const sortedDateKeys = Array.from(weeklyDateKeys).sort();
        const endKey =
          sortedDateKeys[sortedDateKeys.length - 1] ||
          getDateOnlyInZone(now, "UTC").toISOString().split("T")[0];
        const endDate = dateKeyToUtcDate(endKey);
        const weekDates: Date[] = [];
        for (let i = 6; i >= 0; i--) {
          weekDates.push(addDaysUtc(endDate, -i));
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
        const { classId, period, startDate, endDate } = request.query as {
          classId?: string;
          period?: DateRangeType;
          startDate?: string;
          endDate?: string;
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

        // ✅ OPTIMIZATION 1: School va asosiy ma'lumotlarni parallel olish
        const classScopeFilter: any = classId
          ? { classId }
          : user.role === "TEACHER"
            ? {
                classId: {
                  in: allowedClassIds.length ? allowedClassIds : ["__none__"],
                },
              }
            : {};

        const studentFilter: any = {
          schoolId,
          isActive: true,
          ...classScopeFilter,
        };

        // Haftalik sanalar tayyorlash (timezone date key asosida)
        const weekDates: Date[] = [];
        for (let i = 6; i >= 0; i--) {
          weekDates.push(addDaysUtc(today, -i));
        }

        // ✅ OPTIMIZATION 2: Barcha asosiy ma'lumotlarni parallel olish
        // Vaqt oralig'iga qarab date filter
        const dateFilter = isSingleDay
          ? { date: dateRange.startDate }
          : { date: { gte: dateRange.startDate, lte: dateRange.endDate } };

        const attendanceStudentFilter = classId
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

        const [
          totalStudents,
          periodAttendanceStats,
          currentlyInSchoolCount,
          classes,
          classAttendanceStats,
          trendAttendance,
          arrivedStudentIds,
          totalAttendanceDays,
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
                  date: today,
                  currentlyInSchool: true,
                  ...attendanceStudentFilter,
                },
              })
            : Promise.resolve(0),
          // Classes with counts
          prisma.class.findMany({
            where: classWhere,
            include: { _count: { select: { students: true } } },
          }),
          // ✅ Class breakdown - vaqt oralig'i bo'yicha
          prisma.dailyAttendance.groupBy({
            by: ["status"],
            where: { schoolId, ...dateFilter, ...attendanceStudentFilter },
            _count: true,
          }),
          // ✅ Trend statistika - vaqt oralig'iga qarab
          prisma.dailyAttendance.groupBy({
            by: ["date", "status"],
            where: {
              schoolId,
              date: {
                gte: weekDates[0],
                lte: weekDates[6],
              },
              ...attendanceStudentFilter,
            },
            _count: true,
          }),
          // Kelgan studentlar ID lari (faqat bugun uchun)
          isToday
            ? prisma.dailyAttendance.findMany({
                where: { schoolId, date: today, ...attendanceStudentFilter },
                select: { studentId: true },
              })
            : Promise.resolve([]),
          // Vaqt oralig'idagi kunlar soni (o'rtacha hisoblash uchun)
          isSingleDay
            ? Promise.resolve(1)
            : prisma.dailyAttendance
                .groupBy({
                  by: ["date"],
                  where: {
                    schoolId,
                    ...dateFilter,
                    ...attendanceStudentFilter,
                  },
                  _count: true,
                })
                .then((res) => res.length || 1),
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
        const classFilterSql = classId
          ? Prisma.sql`AND s."classId" = ${classId}`
          : user.role === "TEACHER"
            ? Prisma.sql`AND s."classId" = ANY(${allowedClassIds.length ? allowedClassIds : ["__none__"]})`
            : Prisma.empty;

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
            AND da."date" <= ${dateRange.endDate}
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

        const classBreakdown = classes.map((cls) => {
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
          if (stat.status === "PRESENT") entry.present = stat._count;
          else if (stat.status === "LATE") entry.late = stat._count;
          else if (stat.status === "ABSENT") entry.absent = stat._count;
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

        const [notYetArrived, notYetArrivedCount] = await Promise.all([
          prisma.student.findMany({
            where: {
              schoolId,
              isActive: true,
              ...classScopeFilter,
              id: { notIn: arrivedIds.length > 0 ? arrivedIds : ["none"] },
            },
            take: 20,
            include: { class: { select: { name: true, startTime: true } } },
            orderBy: { name: "asc" },
          }),
          prisma.student.count({
            where: {
              schoolId,
              isActive: true,
              ...classScopeFilter,
              id: { notIn: arrivedIds.length > 0 ? arrivedIds : ["none"] },
            },
          }),
        ]);

        const nowMinutes = getNowMinutesInZone(now, tz);

        // Filter students by pending status using centralized utility
        const pendingNotArrived = notYetArrived.filter((s) => {
          const status = computeAttendanceStatus({
            dbStatus: null, // These students have no DailyAttendance record
            classStartTime: s.class?.startTime || null,
            absenceCutoffMinutes,
            nowMinutes,
          });
          return status === "PENDING";
        });

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
          absentToday,
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
              }))
            : [],
          notYetArrivedCount: isToday ? pendingNotArrived.length : 0,
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

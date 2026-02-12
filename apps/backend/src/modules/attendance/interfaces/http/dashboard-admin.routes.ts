import { FastifyInstance } from "fastify";
import { DashboardHttpDeps, DateRangeType } from "./dashboard.routes.deps";
import { buildAdminPerSchoolStats } from "./dashboard-admin-school-stats.service";

export function registerAdminDashboardRoutes(
  fastify: FastifyInstance,
  deps: DashboardHttpDeps,
) {
  const { attendanceRepo,
    addDaysUtc,
    getDateOnlyInZone,
    sendHttpError,
    calculateAttendancePercent,
  } = deps;

  fastify.get(
    "/admin/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
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

        const schools = await attendanceRepo.school.findMany({
          include: {
            _count: {
              select: { students: true, classes: true, devices: true },
            },
          },
        });

        const perSchool = await Promise.all(
          schools.map((school) =>
            buildAdminPerSchoolStats({
              deps,
              school,
              now,
              periodType,
              startDate,
              endDate,
              attendanceScope,
            }),
          ),
        );

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

        const schoolsWithStats = schools.map((school) => {
          const attendanceStats = statsMap.get(school.id) || {
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
          };
          const totalStudents = totalStudentsMap.get(school.id) || 0;
          const daysCount = daysCountMap.get(school.id) || 1;
          const noScan = noScanMap.get(school.id) || {
            pendingEarly: 0,
            pendingLate: 0,
            absent: 0,
          };
          const presentToday = attendanceStats.present;
          const lateToday = attendanceStats.late;
          const absentRaw = attendanceStats.absent + noScan.absent;
          const excusedToday = attendanceStats.excused || 0;
          const absentToday = deps.normalizeAbsentCount({
            totalStudents,
            present: presentToday,
            late: lateToday,
            excused: excusedToday,
            pendingEarly: noScan.pendingEarly,
            pendingLate: noScan.pendingLate,
            absentRaw,
          });

          return {
            ...school,
            totalStudents: school._count.students,
            totalClasses: school._count.classes,
            totalDevices: school._count.devices,
            presentToday,
            lateToday,
            absentToday,
            excusedToday,
            currentlyInSchool: currentlyInSchoolMap.get(school.id) || 0,
            attendancePercent: calculateAttendancePercent(
              presentToday,
              lateToday,
              totalStudents,
            ),
            daysCount,
            notYetArrivedCount: noScan.pendingEarly + noScan.pendingLate,
            pendingEarlyCount: noScan.pendingEarly,
            latePendingCount: noScan.pendingLate,
          };
        });

        const totals = schoolsWithStats.reduce(
          (acc, school) => ({
            schools: acc.schools + 1,
            students: acc.students + school.totalStudents,
            classes: acc.classes + school.totalClasses,
            devices: acc.devices + school.totalDevices,
            present: acc.present + school.presentToday,
            late: acc.late + school.lateToday,
            absent: acc.absent + school.absentToday,
            excused: acc.excused + (school.excusedToday || 0),
            currentlyInSchool: acc.currentlyInSchool + school.currentlyInSchool,
            pendingEarly: acc.pendingEarly + (school.pendingEarlyCount || 0),
            pendingLate: acc.pendingLate + (school.latePendingCount || 0),
          }),
          {
            schools: 0,
            students: 0,
            classes: 0,
            devices: 0,
            present: 0,
            late: 0,
            absent: 0,
            excused: 0,
            currentlyInSchool: 0,
            pendingEarly: 0,
            pendingLate: 0,
          },
        );

        const overallPercent = calculateAttendancePercent(
          totals.present,
          totals.late,
          totals.students,
        );

        const weekDates = Array.from(weeklyDateKeys)
          .map((k) => k)
          .sort()
          .slice(-7);
        const weeklyStats = weekDates.map((dateKey) => {
          const date = deps.dateKeyToUtcDate(dateKey);
          const stats = weeklyMap.get(dateKey) || { present: 0, late: 0, absent: 0 };
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
        const recentEvents = await attendanceRepo.attendanceEvent.findMany({
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


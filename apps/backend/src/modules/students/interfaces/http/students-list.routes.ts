import { FastifyInstance } from "fastify";
import { EffectiveStatus, StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsListRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, addDaysUtc, getDateOnlyInZone, getDateRangeInZone,
    requireRoles, requireSchoolScope, getTeacherClassFilter, sendHttpError,
    calculateAttendancePercent, computeAttendanceStatus, getNowMinutesInZone
  } = deps;

  fastify.get(
    "/schools/:schoolId/students",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const {
          page = 1,
          search = "",
          classId,
          period,
          startDate,
          endDate,
        } = request.query as any;
        const take = 50;
        const skip = (Number(page) - 1) * take;

        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        // Vaqt oralig'ini hisoblash
        const school = await studentsRepo.school.findUnique({
          where: { id: schoolId },
          select: { timezone: true, absenceCutoffMinutes: true },
        });
        const tz = school?.timezone || "Asia/Tashkent";
        const absenceCutoffMinutes = school?.absenceCutoffMinutes ?? 180;
        const dateRange = getDateRangeInZone(
          period || "today",
          tz,
          startDate,
          endDate,
        );
        const isSingleDay =
          dateRange.startDate.getTime() === dateRange.endDate.getTime();
        const today = getDateOnlyInZone(new Date(), tz);
        const isToday =
          isSingleDay && dateRange.startDate.getTime() === today.getTime();

        const where: any = {
          schoolId,
          isActive: true,
        };

        if (search) {
          where.name = { contains: search, mode: "insensitive" };
        }

        if (user.role === "TEACHER") {
          const { classFilter } = await getTeacherClassFilter({
            teacherId: user.sub,
            requestedClassId: classId,
          });
          where.classId = classFilter;
        } else {
          if (classId) {
            where.classId = classId;
          }
        }

        const [students, total] = await Promise.all([
          studentsRepo.student.findMany({
            where,
            skip,
            take,
            include: { class: true },
            orderBy: [
              { class: { gradeLevel: "asc" } },
              { class: { name: "asc" } },
              { lastName: "asc" },
              { firstName: "asc" },
            ],
          }),
          studentsRepo.student.count({ where }),
        ]);

        const studentIds = students.map((s) => s.id);

        // Vaqt oralig'iga qarab attendance olish
        const dateFilter = {
          date: {
            gte: dateRange.startDate,
            lt: addDaysUtc(dateRange.endDate, 1),
          },
        };

        const periodAttendance = await studentsRepo.dailyAttendance.findMany({
          where: {
            studentId: { in: studentIds },
            ...dateFilter,
          },
          select: {
            studentId: true,
            status: true,
            firstScanTime: true,
            date: true,
          },
        });

        // Har bir student uchun statistikani hisoblash
        const studentStatsMap = new Map<
          string,
          {
            presentCount: number;
            lateCount: number;
            absentCount: number;
            excusedCount: number;
            totalDays: number;
            lastStatus: string | null;
            lastFirstScan: Date | null;
          }
        >();

        // Studentlar uchun boshlang'ich qiymatlar
        studentIds.forEach((id) => {
          studentStatsMap.set(id, {
            presentCount: 0,
            lateCount: 0,
            absentCount: 0,
            excusedCount: 0,
            totalDays: 0,
            lastStatus: null,
            lastFirstScan: null,
          });
        });

        // Attendance ma'lumotlarini yig'ish
        periodAttendance.forEach((a) => {
          const stats = studentStatsMap.get(a.studentId);
          if (stats) {
            stats.totalDays++;
            if (a.status === "PRESENT") stats.presentCount++;
            else if (a.status === "LATE") stats.lateCount++;
            else if (a.status === "ABSENT") stats.absentCount++;
            else if (a.status === "EXCUSED") stats.excusedCount++;

            // Oxirgi sanani saqlash (bugun yoki oxirgi kun uchun)
            if (
              !stats.lastFirstScan ||
              (a.firstScanTime && a.date > (stats.lastFirstScan as any))
            ) {
              stats.lastStatus = a.status;
              stats.lastFirstScan = a.firstScanTime;
            }
          }
        });

        // Add attendance stats to each student
        const now = new Date();
        const nowMinutes = getNowMinutesInZone(now, tz);

        const studentsWithStatus = students.map((s) => {
          const stats = studentStatsMap.get(s.id);
          let todayEffectiveStatus: EffectiveStatus | null = null;

          if (isSingleDay) {
            if (isToday) {
              // Use centralized utility for consistent status calculation
              todayEffectiveStatus = computeAttendanceStatus({
                dbStatus: stats?.lastStatus || null,
                classStartTime: s.class?.startTime || null,
                absenceCutoffMinutes,
                nowMinutes,
              });
            } else {
              // Past date with no record => absent, future date => pending
              todayEffectiveStatus =
                (stats?.lastStatus as EffectiveStatus) ||
                (dateRange.startDate.getTime() < today.getTime()
                  ? "ABSENT"
                  : "PENDING_EARLY");
            }
          }
          return {
            ...s,
            // Bitta kun uchun - to'g'ridan-to'g'ri status
            todayStatus: isSingleDay ? stats?.lastStatus || null : null,
            todayFirstScan: isSingleDay ? stats?.lastFirstScan || null : null,
            todayEffectiveStatus: isSingleDay ? todayEffectiveStatus : null,
            // Ko'p kunlik statistika
            periodStats: !isSingleDay
              ? {
                  presentCount: stats?.presentCount || 0,
                  lateCount: stats?.lateCount || 0,
                  absentCount: stats?.absentCount || 0,
                  excusedCount: stats?.excusedCount || 0,
                  totalDays: stats?.totalDays || 0,
                  attendancePercent: stats
                    ? calculateAttendancePercent(
                        stats.presentCount,
                        stats.lateCount,
                        stats.totalDays,
                      )
                    : 0,
                }
              : null,
          };
        });

        // Umumiy statistika
        const overallStats = {
          total,
          present: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "PRESENT")
                .length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.presentCount || 0),
                0,
              ),
          late: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "LATE").length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.lateCount || 0),
                0,
              ),
          absent: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "ABSENT")
                .length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.absentCount || 0),
                0,
              ),
          excused: isSingleDay
            ? studentsWithStatus.filter((s) => s.todayStatus === "EXCUSED")
                .length
            : studentsWithStatus.reduce(
                (sum, s) => sum + (s.periodStats?.excusedCount || 0),
                0,
              ),
          pending: isSingleDay
            ? studentsWithStatus.filter(
                (s) =>
                  s.todayEffectiveStatus === "PENDING_EARLY" ||
                  s.todayEffectiveStatus === "PENDING_LATE",
              ).length
            : 0,
          pendingEarly: isSingleDay
            ? studentsWithStatus.filter(
                (s) => s.todayEffectiveStatus === "PENDING_EARLY",
              ).length
            : 0,
          pendingLate: isSingleDay
            ? studentsWithStatus.filter(
                (s) => s.todayEffectiveStatus === "PENDING_LATE",
              ).length
            : 0,
        };

        return {
          data: studentsWithStatus,
          total,
          page: Number(page),
          period: period || "today",
          periodLabel: dateRange.label,
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString(),
          isSingleDay,
          stats: overallStats,
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

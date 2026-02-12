import {
  ClassCountRow,
  DashboardHttpDeps,
  DateRangeType,
} from "./dashboard.routes.deps";
import { loadSchoolDashboardMetrics } from "./dashboard-school-metrics.service";
import { buildSchoolDashboardResponse } from "./dashboard-school.response";

export function createSchoolDashboardHandler(deps: DashboardHttpDeps) {
  const { attendanceRepo,
    addDaysUtc,
    getDateOnlyInZone,
    getDateRangeInZone,
    getTeacherAllowedClassIds,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    calculateAttendancePercent,
    getActiveClassIds,
    getNowMinutesInZone,
    getStartedClassIds,
    computeNoScanSplit,
    getClassBreakdown,
    getPendingNotArrivedList,
    normalizeAbsentCount,
  } = deps;

  return async (request: any, reply: any) => {
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
      const school = await attendanceRepo.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true, absenceCutoffMinutes: true },
      });
      const tz = school?.timezone || "Asia/Tashkent";
      const absenceCutoffMinutes = school?.absenceCutoffMinutes ?? 180;
      const today = getDateOnlyInZone(now, tz);
      const todayEnd = addDaysUtc(today, 1);
      const dateRange = getDateRangeInZone(period || "today", tz, startDate, endDate);
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

      const classes = await attendanceRepo.class.findMany({
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
        ? { schoolId, isActive: true, classId: { in: classIdFilterList } }
        : {
            schoolId,
            isActive: true,
            ...classScopeFilter,
          };

      const weekDates: Date[] = [];
      for (let i = 6; i >= 0; i--) {
        weekDates.push(addDaysUtc(dateRange.endDate, -i));
      }

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

      const {
        totalStudents,
        statusResult,
        currentlyInSchoolCount,
        weeklyStatusMap,
        arrivedStudentIds,
        classStudentCounts,
      } = await loadSchoolDashboardMetrics({
        deps,
        schoolId,
        isToday,
        today,
        todayEnd,
        studentFilter,
        attendanceStudentFilter,
        dateRange,
        weekDates,
        periodClassIds,
      });

      const daysCount = isSingleDay ? 1 : statusResult.daysCount;
      const presentCount = statusResult.counts.present;
      const lateCount = statusResult.counts.late;
      const absentCount = statusResult.counts.absent;
      const excusedCount = statusResult.counts.excused;
      const presentToday = isSingleDay
        ? presentCount
        : Math.round(presentCount / daysCount);
      const lateToday = isSingleDay ? lateCount : Math.round(lateCount / daysCount);
      const absentToday = isSingleDay
        ? absentCount
        : Math.round(absentCount / daysCount);
      const excusedToday = isSingleDay
        ? excusedCount
        : Math.round(excusedCount / daysCount);

      const classesForBreakdown = Array.isArray(periodClassIds)
        ? classes.filter((cls) => periodClassIds.includes(cls.id))
        : classes;

      const classBreakdown = await getClassBreakdown({
        schoolId,
        dateRange,
        classIds: periodClassIds,
        classes: classesForBreakdown,
      });

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

      return buildSchoolDashboardResponse({
        period,
        dateRange,
        daysCount,
        totalStudents,
        presentToday,
        lateToday,
        absentToday,
        excusedToday,
        currentlyInSchoolCount,
        timezone: tz,
        totalPresent: presentCount,
        totalLate: lateCount,
        totalAbsent: absentCount,
        totalExcused: excusedCount,
        classBreakdown,
        weekDates,
        weeklyStatusMap,
        pendingEarlyCount,
        latePendingCount,
        notYetArrived: pendingNotArrived,
        isToday,
        noScanAbsent: noScanSplit.absent,
        calculateAttendancePercent,
        normalizeAbsentCount,
      });
    } catch (err) {
      return sendHttpError(reply, err);
    }
  };
}


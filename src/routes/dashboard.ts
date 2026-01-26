import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import { getLocalDateKey, getLocalDateOnly } from "../utils/date";

// SuperAdmin uchun barcha maktablar statistikasi
export async function adminDashboardRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/admin/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      // Faqat SUPER_ADMIN uchun
      if (request.user.role !== "SUPER_ADMIN") {
        throw { statusCode: 403, message: "Forbidden" };
      }

      const now = new Date();

      // Barcha maktablar
      const schools = await prisma.school.findMany({
        include: {
          _count: { select: { students: true, classes: true, devices: true } },
        },
      });

      // Har bir maktab uchun bugungi statistika
      const schoolsWithStats = await Promise.all(
        schools.map(async (school) => {
          const today = getLocalDateOnly(now);
          const [totalStudents, presentToday, lateToday, absentToday, currentlyInSchool] = await Promise.all([
            prisma.student.count({ where: { schoolId: school.id, isActive: true } }),
            prisma.dailyAttendance.count({ where: { schoolId: school.id, date: today, status: "PRESENT" } }),
            prisma.dailyAttendance.count({ where: { schoolId: school.id, date: today, status: "LATE" } }),
            prisma.dailyAttendance.count({ where: { schoolId: school.id, date: today, status: "ABSENT" } }),
            prisma.dailyAttendance.count({ where: { schoolId: school.id, date: today, currentlyInSchool: true } }),
          ]);

          const totalPresent = presentToday + lateToday;
          const attendancePercent = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

          return {
            id: school.id,
            name: school.name,
            address: school.address,
            totalStudents,
            totalClasses: school._count.classes,
            totalDevices: school._count.devices,
            presentToday: totalPresent,
            lateToday,
            absentToday,
            currentlyInSchool,
            attendancePercent,
          };
        })
      );

      // Umumiy statistika
      const totals = schoolsWithStats.reduce(
        (acc, s) => ({
          totalSchools: acc.totalSchools + 1,
          totalStudents: acc.totalStudents + s.totalStudents,
          presentToday: acc.presentToday + s.presentToday,
          lateToday: acc.lateToday + s.lateToday,
          absentToday: acc.absentToday + s.absentToday,
          currentlyInSchool: acc.currentlyInSchool + s.currentlyInSchool,
        }),
        { totalSchools: 0, totalStudents: 0, presentToday: 0, lateToday: 0, absentToday: 0, currentlyInSchool: 0 }
      );

      const overallPercent = totals.totalStudents > 0 
        ? Math.round((totals.presentToday / totals.totalStudents) * 100) 
        : 0;

      // Oxirgi eventlar (barcha maktablardan)
      const recentEvents = await prisma.attendanceEvent.findMany({
        orderBy: { timestamp: "desc" },
        take: 15,
        include: {
          student: { include: { class: true } },
          device: true,
          school: true,
        },
      });

      // Haftalik trend (barcha maktablar)
      const weeklyStats = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStr = getLocalDateKey(date);
        const dayDate = getLocalDateOnly(date);

        const [present, late, absent] = await Promise.all([
          prisma.dailyAttendance.count({ where: { date: dayDate, status: "PRESENT" } }),
          prisma.dailyAttendance.count({ where: { date: dayDate, status: "LATE" } }),
          prisma.dailyAttendance.count({ where: { date: dayDate, status: "ABSENT" } }),
        ]);

        weeklyStats.push({
          date: dayStr,
          dayName: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][date.getDay()],
          present: present + late,
          late,
          absent,
        });
      }

      return {
        totals: { ...totals, attendancePercent: overallPercent },
        schools: schoolsWithStats,
        recentEvents,
        weeklyStats,
      };
    }
  );
}

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const { schoolId } = request.params;
      const { classId } = request.query as { classId?: string };
      
      const tz =
        (await prisma.school.findUnique({ where: { id: schoolId } }))
          ?.timezone || "UTC";
      
      // Sinf filter uchun student filter
      const studentFilter: any = { schoolId, isActive: true };
      const attendanceFilter: any = {};
      if (classId) {
        studentFilter.classId = classId;
        attendanceFilter.student = { classId };
      }
      
      // total students
      const totalStudents = await prisma.student.count({
        where: studentFilter,
      });
      const now = new Date();
      const today = getLocalDateOnly(now);
      const presentToday = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, status: "PRESENT", ...attendanceFilter },
      });
      const lateToday = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, status: "LATE", ...attendanceFilter },
      });
      const absentToday = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, status: "ABSENT", ...attendanceFilter },
      });
      const excusedToday = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, status: "EXCUSED", ...attendanceFilter },
      });

      // Hozir maktabda bo'lganlar soni
      const currentlyInSchool = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, currentlyInSchool: true, ...attendanceFilter },
      });

      // Class breakdown - get stats per class
      const classes = await prisma.class.findMany({
        where: { schoolId },
        include: {
          _count: { select: { students: true } },
        },
      });

      const classBreakdown = await Promise.all(
        classes.map(async (cls) => {
          const totalInClass = cls._count.students;
          const presentInClass = await prisma.dailyAttendance.count({
            where: {
              schoolId,
              date: today,
              status: { in: ["PRESENT", "LATE"] },
              student: { classId: cls.id },
            },
          });
          const lateInClass = await prisma.dailyAttendance.count({
            where: {
              schoolId,
              date: today,
              status: "LATE",
              student: { classId: cls.id },
            },
          });
          return {
            classId: cls.id,
            className: cls.name,
            total: totalInClass,
            present: presentInClass,
            late: lateInClass,
          };
        })
      );

      // Weekly stats (last 7 days)
      const weeklyStats = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dayStr = getLocalDateKey(d);
        const dayDate = getLocalDateOnly(d);
        
        const present = await prisma.dailyAttendance.count({
          where: { schoolId, date: dayDate, status: { in: ["PRESENT", "LATE"] } },
        });
        const late = await prisma.dailyAttendance.count({
          where: { schoolId, date: dayDate, status: "LATE" },
        });
        const absent = await prisma.dailyAttendance.count({
          where: { schoolId, date: dayDate, status: "ABSENT" },
        });
        
        weeklyStats.push({
          date: dayStr,
          dayName: ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"][d.getDay()],
          present,
          late,
          absent,
        });
      }

      // Not yet arrived students (students without attendance record today)
      const studentsWithAttendance = await prisma.dailyAttendance.findMany({
        where: { schoolId, date: today },
        select: { studentId: true },
      });
      const arrivedIds = studentsWithAttendance.map((a) => a.studentId);
      
      const notYetArrived = await prisma.student.findMany({
        where: {
          schoolId,
          isActive: true,
          id: { notIn: arrivedIds },
        },
        take: 20,
        include: { class: true },
        orderBy: { name: "asc" },
      });

      const notYetArrivedCount = await prisma.student.count({
        where: {
          schoolId,
          isActive: true,
          id: { notIn: arrivedIds },
        },
      });

      return {
        totalStudents,
        presentToday,
        lateToday,
        absentToday,
        excusedToday,
        currentlyInSchool,
        timezone: tz,
        presentPercentage:
          totalStudents > 0
            ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
            : 0,
        currentTime: new Date().toISOString(),
        classBreakdown,
        weeklyStats,
        notYetArrived: notYetArrived.map((s) => ({
          id: s.id,
          name: s.name,
          className: s.class?.name || "-",
        })),
        notYetArrivedCount,
      };
    },
  );

  fastify.get(
    "/schools/:schoolId/events",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const { schoolId } = request.params;
      const { limit = 10 } = request.query;

      // Fetch recent attendance events or daily attendance records
      const events = await prisma.attendanceEvent.findMany({
        where: { schoolId },
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
    },
  );
}

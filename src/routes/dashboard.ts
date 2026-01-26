import { FastifyInstance } from "fastify";
import prisma from "../prisma";

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
      const todayStr = new Date().toLocaleDateString("en-CA");
      const today = new Date(`${todayStr}T00:00:00Z`);
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
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = d.toLocaleDateString("en-CA");
        const dayDate = new Date(`${dayStr}T00:00:00Z`);
        
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

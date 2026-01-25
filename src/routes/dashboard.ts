import { FastifyInstance } from "fastify";
import prisma from "../prisma";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/dashboard",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const { schoolId } = request.params;
      const tz =
        (await prisma.school.findUnique({ where: { id: schoolId } }))
          ?.timezone || "UTC";
      // total students
      const totalStudents = await prisma.student.count({
        where: { schoolId, isActive: true },
      });
      const todayStr = new Date().toLocaleDateString("en-CA");
      const today = new Date(`${todayStr}T00:00:00Z`);
      const presentToday = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, status: "PRESENT" },
      });
      const lateToday = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, status: "LATE" },
      });
      const absentToday = await prisma.dailyAttendance.count({
        where: { schoolId, date: today, status: "ABSENT" },
      });

      return {
        totalStudents,
        presentToday,
        lateToday,
        absentToday,
        timezone: tz,
        presentPercentage:
          totalStudents > 0
            ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
            : 0,
        currentTime: new Date().toISOString(),
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

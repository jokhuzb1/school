import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export function createClassesPrismaRepository(prisma: PrismaLike) {
  return {
    findTeacherClassIds(teacherId: string) {
      return prisma.teacherClass.findMany({
        where: { teacherId },
        select: { classId: true },
      });
    },
    findSchoolTimezone(schoolId: string) {
      return prisma.school.findUnique({
        where: { id: schoolId },
        select: { timezone: true },
      });
    },
    findClasses(where: any) {
      return prisma.class.findMany({
        where,
        include: {
          _count: { select: { students: true } },
        },
        orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
      });
    },
    countDailyAttendanceByStatus(input: {
      classId: string;
      from: Date;
      to: Date;
      status: "PRESENT" | "LATE" | "ABSENT";
    }) {
      const { classId, from, to, status } = input;
      return prisma.dailyAttendance.count({
        where: {
          date: { gte: from, lt: to },
          status,
          student: { classId },
        },
      });
    },
    createClass(data: {
      name: string;
      gradeLevel: number;
      schoolId: string;
      startTime: string;
      endTime?: string | null;
    }) {
      return prisma.class.create({ data });
    },
    findClassById(id: string) {
      return prisma.class.findUnique({ where: { id } });
    },
    updateClass(id: string, data: any) {
      return prisma.class.update({ where: { id }, data });
    },
    deleteClass(id: string) {
      return prisma.class.delete({ where: { id } });
    },
  };
}

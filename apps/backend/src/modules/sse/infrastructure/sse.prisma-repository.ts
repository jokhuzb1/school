import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export function createSsePrismaRepository(prisma: PrismaLike) {
  return {
    findClassSchoolById(classId: string) {
      return prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
    },
    findTeacherClassAssignment(teacherId: string, classId: string) {
      return prisma.teacherClass.findUnique({
        where: { teacherId_classId: { teacherId, classId } } as any,
        select: { classId: true },
      });
    },
    findTeacherClassIds(teacherId: string) {
      return prisma.teacherClass.findMany({
        where: { teacherId },
        select: { classId: true },
      });
    },
  };
}

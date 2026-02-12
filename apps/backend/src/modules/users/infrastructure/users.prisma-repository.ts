import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export function createUsersPrismaRepository(prisma: PrismaLike) {
  return {
    findUsersBySchool(schoolId: string) {
      return prisma.user.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
        orderBy: { name: "asc" },
      });
    },
    findUserByEmail(email: string) {
      return prisma.user.findUnique({ where: { email } });
    },
    createUser(data: {
      name: string;
      email: string;
      password: string;
      role: any;
      schoolId: string;
    }) {
      return prisma.user.create({ data });
    },
    findUserSchoolById(id: string) {
      return prisma.user.findUnique({
        where: { id },
        select: { schoolId: true },
      });
    },
    deleteUser(id: string) {
      return prisma.user.delete({ where: { id } });
    },
    updateUser(id: string, data: any) {
      return prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true },
      });
    },
    findTeacherBase(teacherId: string) {
      return prisma.user.findUnique({
        where: { id: teacherId },
        select: { role: true, schoolId: true },
      });
    },
    findClassSchoolById(classId: string) {
      return prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
    },
    createTeacherClassAssignment(teacherId: string, classId: string) {
      return prisma.teacherClass.create({
        data: { teacherId, classId },
      });
    },
    deleteTeacherClassAssignment(teacherId: string, classId: string) {
      return prisma.teacherClass.deleteMany({
        where: { teacherId, classId },
      });
    },
    listTeacherClassAssignments(teacherId: string) {
      return prisma.teacherClass.findMany({
        where: { teacherId },
        include: { class: true },
      });
    },
  };
}

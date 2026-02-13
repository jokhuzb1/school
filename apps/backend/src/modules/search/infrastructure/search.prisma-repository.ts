import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export function createSearchPrismaRepository(prisma: PrismaLike) {
  return {
    findSchools(q: string, limit: number) {
      return prisma.school.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, address: true },
        take: limit,
      });
    },
    findClassSchoolById(classId: string) {
      return prisma.class.findFirst({
        where: { id: classId },
        select: { schoolId: true },
      });
    },
    findStudents(input: {
      q: string;
      limit: number;
      schoolFilter: any;
      teacherClassFilter: string[] | null;
    }) {
      const { q, limit, schoolFilter, teacherClassFilter } = input;
      return prisma.student.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          ...schoolFilter,
          ...(teacherClassFilter
            ? {
                classId: {
                  in: teacherClassFilter.length ? teacherClassFilter : ["__none__"],
                },
              }
            : {}),
        },
        include: {
          class: { select: { name: true } },
          school: { select: { name: true } },
        },
        take: limit,
      });
    },
    findClasses(input: {
      q: string;
      limit: number;
      schoolFilter: any;
      teacherClassFilter: string[] | null;
    }) {
      const { q, limit, schoolFilter, teacherClassFilter } = input;
      return prisma.class.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          ...schoolFilter,
          ...(teacherClassFilter
            ? { id: { in: teacherClassFilter.length ? teacherClassFilter : ["__none__"] } }
            : {}),
        },
        include: {
          school: { select: { name: true } },
        },
        take: limit,
      });
    },
    findUsers(input: { q: string; limit: number; schoolFilter: any }) {
      const { q, limit, schoolFilter } = input;
      return prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
          ...schoolFilter,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          schoolId: true,
          school: { select: { name: true } },
        },
        take: limit,
      });
    },
    findDevices(input: { q: string; limit: number; schoolFilter: any }) {
      const { q, limit, schoolFilter } = input;
      return prisma.device.findMany({
        where: {
          name: { contains: q, mode: "insensitive" },
          ...schoolFilter,
        },
        include: { school: { select: { name: true } } },
        take: limit,
      });
    },
  };
}

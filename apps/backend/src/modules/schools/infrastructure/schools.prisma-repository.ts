import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export function createSchoolsPrismaRepository(prisma: PrismaLike) {
  return {
    findAllSchoolsWithCounts() {
      return prisma.school.findMany({
        include: {
          _count: { select: { students: true, classes: true, devices: true } },
        },
        orderBy: { schoolNumber: "asc" },
      });
    },
    findClassesForSchoolStats(schoolId: string) {
      return prisma.class.findMany({
        where: { schoolId },
        select: { id: true, startTime: true, endTime: true },
      });
    },
    groupActiveStudentsByClass(schoolId: string, classIds: string[]) {
      return prisma.student.groupBy({
        by: ["classId"],
        where: {
          schoolId,
          isActive: true,
          classId: { in: classIds },
        },
        _count: true,
      });
    },
    findUserByEmail(email: string) {
      return prisma.user.findUnique({ where: { email } });
    },
    createSchoolWithOptionalAdmin(input: {
      school: {
        name: string;
        address?: string | null;
        phone?: string | null;
        email?: string | null;
        lateThresholdMinutes: number;
        absenceCutoffMinutes: number;
        webhookSecretIn: string;
        webhookSecretOut: string;
      };
      admin?: {
        name: string;
        email: string;
        password: string;
      };
    }) {
      return prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: input.school,
        });

        let admin: any = null;
        if (input.admin) {
          admin = await tx.user.create({
            data: {
              name: input.admin.name,
              email: input.admin.email,
              password: input.admin.password,
              role: "SCHOOL_ADMIN",
              schoolId: school.id,
            },
          });
        }

        return { school, admin };
      });
    },
    findSchoolById(id: string) {
      return prisma.school.findUnique({ where: { id } });
    },
    updateSchoolById(id: string, data: any) {
      return prisma.school.update({
        where: { id },
        data,
      });
    },
  };
}

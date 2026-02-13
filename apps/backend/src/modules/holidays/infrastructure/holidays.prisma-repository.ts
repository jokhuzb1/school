import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export type HolidaysPrismaRepository = {
  listBySchoolId(schoolId: string): Promise<
    Awaited<ReturnType<PrismaLike["holiday"]["findMany"]>>
  >;
  createBySchoolId(
    input: { schoolId: string; date: Date; name: string },
  ): Promise<Awaited<ReturnType<PrismaLike["holiday"]["create"]>>>;
  deleteById(id: string): Promise<void>;
};

export function createHolidaysPrismaRepository(
  prisma: PrismaLike,
): HolidaysPrismaRepository {
  return {
    listBySchoolId(schoolId: string) {
      return prisma.holiday.findMany({ where: { schoolId } });
    },
    createBySchoolId(input: { schoolId: string; date: Date; name: string }) {
      return prisma.holiday.create({ data: input });
    },
    async deleteById(id: string) {
      await prisma.holiday.delete({ where: { id } });
    },
  };
}

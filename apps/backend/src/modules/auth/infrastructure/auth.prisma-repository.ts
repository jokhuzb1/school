import prismaClient from "../../../prisma";

type PrismaLike = typeof prismaClient;

export type AuthPrismaRepository = {
  findByEmail(email: string): Promise<
    Awaited<ReturnType<PrismaLike["user"]["findUnique"]>>
  >;
  findById(id: string): Promise<Awaited<ReturnType<PrismaLike["user"]["findUnique"]>>>;
  findByIdWithSchool(id: string): Promise<
    Awaited<ReturnType<PrismaLike["user"]["findUnique"]>>
  >;
};

export function createAuthPrismaRepository(prisma: PrismaLike): AuthPrismaRepository {
  return {
    findByEmail(email: string) {
      return prisma.user.findUnique({ where: { email } });
    },
    findById(id: string) {
      return prisma.user.findUnique({ where: { id } });
    },
    findByIdWithSchool(id: string) {
      return prisma.user.findUnique({
        where: { id },
        include: { school: true },
      });
    },
  };
}

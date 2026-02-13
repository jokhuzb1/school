import { FastifyInstance } from "fastify";
import { searchGlobal } from "../../application/search.service";
import { createSearchPrismaRepository } from "../../infrastructure/search.prisma-repository";
import { createSearchHttpDeps } from "./search.routes.deps";

export default async function (fastify: FastifyInstance) {
  const { prisma, getTeacherClassFilter, isSuperAdmin } = createSearchHttpDeps();
  const repository = createSearchPrismaRepository(prisma);

  fastify.get(
    "/search",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const q = String(request.query?.q || "").trim();
      const limit = Math.min(Number(request.query?.limit || 6), 20);

      return searchGlobal({
        repository,
        getTeacherClassFilter,
        isSuperAdmin,
        user: request.user as any,
        q,
        limit,
      });
    },
  );
}

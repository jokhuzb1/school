import { FastifyInstance } from "fastify";
import { SseHttpDeps } from "./sse.routes.deps";

export function registerSseAdminStatsRoute(
  fastify: FastifyInstance,
  deps: SseHttpDeps,
) {
  const { getConnectionStats } = deps;

  fastify.get(
    "/admin/connection-stats",
    { preHandler: [(fastify as any).authenticate] },
    async (request: any, reply) => {
      if (request.user.role !== "SUPER_ADMIN") {
        return reply.status(403).send({ error: "Access denied" });
      }
      return getConnectionStats();
    },
  );
}

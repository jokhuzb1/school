import { FastifyInstance } from "fastify";
import { requireRoles, requireSchoolScope } from "../../../utils/authz";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/camera-areas",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const { schoolId } = request.params;
      const user = request.user;

      requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
      requireSchoolScope(user, schoolId);

      // TODO: replace with DB integration
      return [];
    },
  );

  fastify.get(
    "/schools/:schoolId/cameras",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any) => {
      const { schoolId } = request.params;
      const user = request.user;

      requireRoles(user, ["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]);
      requireSchoolScope(user, schoolId);

      // TODO: replace with DB integration
      return [];
    },
  );
}

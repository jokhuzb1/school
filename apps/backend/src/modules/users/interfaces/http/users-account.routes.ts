import { FastifyInstance } from "fastify";
import { createUsersService } from "../../application/users.service";
import { createUsersPrismaRepository } from "../../infrastructure/users.prisma-repository";
import { UsersHttpDeps } from "./users.routes.deps";

export function registerUserAccountRoutes(
  fastify: FastifyInstance,
  deps: UsersHttpDeps,
) {
  const { prisma, bcrypt, requireRoles, requireSchoolScope, sendHttpError } =
    deps;
  const service = createUsersService(createUsersPrismaRepository(prisma));

  fastify.get(
    "/schools/:schoolId/users",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        return service.listBySchool(schoolId);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/users",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;
        const { name, email, password, role } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const created = await service.createUser({
          schoolId,
          name,
          email,
          password,
          role,
          hashPassword: bcrypt.hash.bind(bcrypt),
        });
        if ("statusCode" in created) {
          return reply
            .status((created as any).statusCode)
            .send({ error: (created as any).error });
        }

        return created;
      } catch (err: any) {
        if (err.code === "P2002") {
          return reply
            .status(400)
            .send({ error: "Bu email allaqachon mavjud" });
        }
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/schools/:schoolId/users/:userId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, userId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const removed = await service.deleteUserInSchool(schoolId, userId);
        if ("statusCode" in removed) {
          return reply
            .status((removed as any).statusCode)
            .send({ error: (removed as any).error });
        }
        return removed;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/schools/:schoolId/users/:userId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, userId } = request.params;
        const user = request.user;
        const { name, password } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const updated = await service.updateUserInSchool({
          schoolId,
          userId,
          name,
          password,
          hashPassword: bcrypt.hash.bind(bcrypt),
        });
        if ("statusCode" in updated) {
          return reply
            .status((updated as any).statusCode)
            .send({ error: (updated as any).error });
        }

        return updated;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

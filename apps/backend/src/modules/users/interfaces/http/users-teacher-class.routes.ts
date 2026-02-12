import { FastifyInstance } from "fastify";
import { createUsersService } from "../../application/users.service";
import { createUsersPrismaRepository } from "../../infrastructure/users.prisma-repository";
import { UsersHttpDeps } from "./users.routes.deps";

export function registerTeacherClassAssignmentRoutes(
  fastify: FastifyInstance,
  deps: UsersHttpDeps,
) {
  const { prisma, requireRoles, requireSchoolScope, sendHttpError } = deps;
  const service = createUsersService(createUsersPrismaRepository(prisma));

  fastify.post(
    "/schools/:schoolId/teachers/:teacherId/classes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, teacherId } = request.params;
        const user = request.user;
        const { classId } = request.body as any;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const assignment = await service.assignTeacherClass({
          schoolId,
          teacherId,
          classId,
        });
        if ("statusCode" in assignment) {
          return reply
            .status((assignment as any).statusCode)
            .send({ error: (assignment as any).error });
        }

        return assignment;
      } catch (err: any) {
        if (err.code === "P2002") {
          return reply.status(400).send({ error: "Already assigned" });
        }
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/schools/:schoolId/teachers/:teacherId/classes/:classId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, teacherId, classId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const removed = await service.removeTeacherClass({
          schoolId,
          teacherId,
          classId,
        });
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

  fastify.get(
    "/schools/:schoolId/teachers/:teacherId/classes",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, teacherId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER"]);
        requireSchoolScope(user, schoolId);

        if (user.role === "TEACHER" && user.sub !== teacherId) {
          return reply.status(403).send({ error: "forbidden" });
        }

        const classes = await service.listTeacherClasses({
          schoolId,
          teacherId,
        });
        if ("statusCode" in classes) {
          return reply
            .status((classes as any).statusCode)
            .send({ error: (classes as any).error });
        }

        return classes;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

import { FastifyInstance } from "fastify";
import prisma from "../../../prisma";
import bcrypt from "bcryptjs";
import { requireRoles, requireSchoolScope } from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";

export default async function (fastify: FastifyInstance) {
  // List users in a school (SCHOOL_ADMIN, SUPER_ADMIN)
  fastify.get(
    "/schools/:schoolId/users",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const users = await prisma.user.findMany({
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

        return users;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Create user (teacher/guard) in a school
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

        // Only allow creating TEACHER/GUARD
        if (!["TEACHER", "GUARD"].includes(role)) {
          return reply.status(400).send({ error: "Invalid role" });
        }

        // Email validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
          return reply.status(400).send({ error: "Noto'g'ri email formati" });
        }

        // Check existing
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          return reply
            .status(400)
            .send({ error: "Bu email allaqachon ro'yxatdan o'tgan" });
        }

        if (!password || password.length < 6) {
          return reply
            .status(400)
            .send({
              error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            role,
            schoolId,
          },
        });

        return {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        };
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

  // Delete user
  fastify.delete(
    "/schools/:schoolId/users/:userId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, userId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { schoolId: true },
        });
        if (!targetUser || targetUser.schoolId !== schoolId) {
          return reply.status(404).send({ error: "not found" });
        }

        await prisma.user.delete({ where: { id: userId } });
        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Update user
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

        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { schoolId: true },
        });
        if (!targetUser || targetUser.schoolId !== schoolId) {
          return reply.status(404).send({ error: "not found" });
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (password) {
          if (password.length < 6) {
            return reply
              .status(400)
              .send({
                error: "Parol kamida 6 ta belgidan iborat bo'lishi kerak",
              });
          }
          updateData.password = await bcrypt.hash(password, 10);
        }

        const updated = await prisma.user.update({
          where: { id: userId },
          data: updateData,
          select: { id: true, name: true, email: true, role: true },
        });

        return updated;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Assign teacher to class
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

        // Verify teacher belongs to school
        const teacher = await prisma.user.findUnique({
          where: { id: teacherId },
          select: { role: true, schoolId: true },
        });
        if (
          !teacher ||
          teacher.schoolId !== schoolId ||
          teacher.role !== "TEACHER"
        ) {
          return reply.status(400).send({ error: "Invalid teacher" });
        }

        // Verify class belongs to school
        const cls = await prisma.class.findUnique({
          where: { id: classId },
          select: { schoolId: true },
        });
        if (!cls || cls.schoolId !== schoolId) {
          return reply.status(400).send({ error: "Invalid class" });
        }

        const assignment = await prisma.teacherClass.create({
          data: { teacherId, classId },
        });

        return assignment;
      } catch (err: any) {
        if (err.code === "P2002") {
          return reply.status(400).send({ error: "Already assigned" });
        }
        return sendHttpError(reply, err);
      }
    },
  );

  // Unassign teacher from class
  fastify.delete(
    "/schools/:schoolId/teachers/:teacherId/classes/:classId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, teacherId, classId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        // Verify teacher belongs to school
        const teacher = await prisma.user.findUnique({
          where: { id: teacherId },
          select: { role: true, schoolId: true },
        });
        if (!teacher || teacher.schoolId !== schoolId) {
          return reply.status(400).send({ error: "Invalid teacher" });
        }

        await prisma.teacherClass.deleteMany({
          where: { teacherId, classId },
        });

        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Get teacher's assigned classes
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

        const teacher = await prisma.user.findUnique({
          where: { id: teacherId },
          select: { role: true, schoolId: true },
        });
        if (
          !teacher ||
          teacher.schoolId !== schoolId ||
          teacher.role !== "TEACHER"
        ) {
          return reply.status(404).send({ error: "not found" });
        }

        const assignments = await prisma.teacherClass.findMany({
          where: { teacherId },
          include: { class: true },
        });

        return assignments.map((a) => a.class);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

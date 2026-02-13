import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsDetailRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, requireRoles, requireStudentSchoolScope, requireTeacherClassScope,
    sendHttpError, normalizeNamePart, buildFullName, normalizeGender,
    buildDuplicateStudentWhere, saveStudentFaceImage
  } = deps;

  fastify.get(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        const student = await requireStudentSchoolScope(user, id);

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        const fullStudent = await studentsRepo.student.findUnique({
          where: { id },
          include: { class: true },
        });
        if (!fullStudent) return reply.status(404).send({});
        return fullStudent;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/students/:id/attendance",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        const student = await requireStudentSchoolScope(user, id);

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        const attendance = await studentsRepo.dailyAttendance.findMany({
          where: { studentId: id },
          orderBy: { date: "desc" },
        });
        return attendance;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Kirdi-chiqdi eventlar tarixi
  fastify.get(
    "/students/:id/events",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const { date } = request.query as { date?: string };

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        const student = await requireStudentSchoolScope(user, id);

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        const where: any = { studentId: id };
        if (date) {
          const startOfDay = new Date(`${date}T00:00:00Z`);
          const endOfDay = new Date(`${date}T23:59:59Z`);
          where.timestamp = { gte: startOfDay, lte: endOfDay };
        }

        const events = await studentsRepo.attendanceEvent.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: 100,
          include: {
            device: true,
          },
        });
        return events;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;
        const data = request.body || {};

        requireRoles(user, ["SCHOOL_ADMIN"]);
        const studentScope = await requireStudentSchoolScope(user, id);

        // Allowlist fields and normalize empty strings to null
        const firstName = normalizeNamePart(data.firstName || "");
        const lastName = normalizeNamePart(data.lastName || "");
        const fatherName = normalizeNamePart(data.fatherName || "");
        const gender = normalizeGender(data.gender);
        const fullName =
          firstName || lastName
            ? buildFullName(lastName, firstName)
            : normalizeNamePart(data.name || "");

        const sanitized = {
          name: fullName,
          firstName,
          lastName,
          fatherName: fatherName || null,
          classId: data.classId,
          deviceStudentId:
            typeof data.deviceStudentId === "string" &&
            data.deviceStudentId.trim() === ""
              ? null
              : data.deviceStudentId,
          parentPhone:
            typeof data.parentPhone === "string" && data.parentPhone.trim() === ""
              ? null
              : data.parentPhone,
          gender: gender || undefined,
        };

        if (!firstName || !lastName) {
          return reply.status(400).send({ error: "Ism va familiya majburiy" });
        }

        if (!sanitized.classId) {
          return reply.status(400).send({ error: "Sinf tanlanishi shart" });
        }

        const classExists = await studentsRepo.class.findFirst({
          where: { id: sanitized.classId, schoolId: studentScope.schoolId },
        });
        if (!classExists) {
          return reply.status(400).send({ error: "Bunday sinf topilmadi" });
        }

        const duplicate = await studentsRepo.student.findFirst({
          where: buildDuplicateStudentWhere({
            schoolId: studentScope.schoolId,
            classId: sanitized.classId,
            firstName,
            lastName,
            fullName,
            excludeId: id,
          }),
          select: { id: true },
        });
        if (duplicate) {
          return reply
            .status(409)
            .send({ error: "Bu sinfda bunday o'quvchi mavjud" });
        }

        if (data.faceImageBase64) {
          const photoUrl = await saveStudentFaceImage({
            studentId: id,
            faceImageBase64: data.faceImageBase64,
          });
          if (photoUrl) {
            (sanitized as any).photoUrl = photoUrl;
          }
        }

        const student = await studentsRepo.student.update({
          where: { id },
          data: sanitized,
        });
        return student;
      } catch (err: any) {
        if (err?.code === "P2002") {
          return reply
            .status(400)
            .send({ error: "Qurilma ID takrorlangan" });
        }
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        await requireStudentSchoolScope(user, id);

        const student = await studentsRepo.student.update({
          where: { id },
          data: { isActive: false },
        });
        return student;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

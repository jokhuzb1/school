import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsDeviceCreateRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, requireRoles, requireSchoolScope, requireTeacherClassScope,
    getTeacherClassFilter, sendHttpError, normalizeNamePart, buildFullName,
    normalizeGender, buildDuplicateStudentWhere
  } = deps;

  fastify.get(
    "/schools/:schoolId/students/device-diagnostics",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { page = 1, search = "", classId } = request.query as any;
        const take = 50;
        const skip = (Number(page) - 1) * take;

        const user = request.user;
        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const where: any = {
          schoolId,
          isActive: true,
        };

        if (search) {
          where.name = { contains: search, mode: "insensitive" };
        }

        if (user.role === "TEACHER") {
          const { classFilter } = await getTeacherClassFilter({
            teacherId: user.sub,
            requestedClassId: classId,
          });
          where.classId = classFilter;
        } else if (classId) {
          where.classId = classId;
        }

        const [students, total, devices] = await Promise.all([
          studentsRepo.student.findMany({
            where,
            skip,
            take,
            include: {
              class: { select: { id: true, name: true, gradeLevel: true } },
            },
            orderBy: [
              { class: { gradeLevel: "asc" } },
              { class: { name: "asc" } },
              { lastName: "asc" },
              { firstName: "asc" },
            ],
          }),
          studentsRepo.student.count({ where }),
          studentsRepo.device.findMany({
            where: { schoolId, isActive: true },
            select: { id: true, name: true, deviceId: true, isActive: true },
            orderBy: { name: "asc" },
          }),
        ]);

        const studentIds = students.map((s) => s.id);
        const deviceIds = devices.map((d) => d.id);

        const links =
          studentIds.length === 0 || deviceIds.length === 0
            ? []
            : await studentsRepo.studentDeviceLink.findMany({
                where: {
                  studentId: { in: studentIds },
                  deviceId: { in: deviceIds },
                },
                select: {
                  studentId: true,
                  deviceId: true,
                  status: true,
                  lastError: true,
                  updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
              });

        // Keep latest link per student/device pair.
        const latestByPair = new Map<string, (typeof links)[number]>();
        for (const link of links) {
          const key = `${link.studentId}:${link.deviceId}`;
          if (!latestByPair.has(key)) {
            latestByPair.set(key, link);
          }
        }

        const data = students.map((student) => {
          const perDevice = devices.map((device) => {
            const key = `${student.id}:${device.id}`;
            const link = latestByPair.get(key);
            if (!link) {
              return {
                deviceId: device.id,
                deviceName: device.name,
                deviceExternalId: device.deviceId,
                status: "MISSING",
                lastError: null,
                updatedAt: null,
              };
            }

            return {
              deviceId: device.id,
              deviceName: device.name,
              deviceExternalId: device.deviceId,
              status: link.status,
              lastError: link.lastError,
              updatedAt: link.updatedAt?.toISOString() || null,
            };
          });

          return {
            studentId: student.id,
            studentName: student.name,
            firstName: student.firstName,
            lastName: student.lastName,
            fatherName: student.fatherName,
            classId: student.classId,
            className: student.class?.name || null,
            deviceStudentId: student.deviceStudentId,
            photoUrl: student.photoUrl,
            devices: perDevice,
          };
        });

        return {
          devices,
          data,
          total,
          page: Number(page),
        };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  // Fast lookup from Hikvision employeeNo/deviceStudentId -> DB student detail.
  fastify.get(
    "/schools/:schoolId/students/by-device-student-id/:deviceStudentId",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId, deviceStudentId } = request.params as {
          schoolId: string;
          deviceStudentId: string;
        };
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN", "TEACHER", "GUARD"]);
        requireSchoolScope(user, schoolId);

        const trimmedId = String(deviceStudentId || "").trim();
        if (!trimmedId) {
          return reply.status(400).send({ error: "deviceStudentId is required" });
        }

        const student = await studentsRepo.student.findFirst({
          where: {
            schoolId,
            deviceStudentId: trimmedId,
            isActive: true,
          },
          include: {
            class: { select: { id: true, name: true } },
          },
        });

        if (!student) {
          return reply.status(404).send({ error: "Student not found" });
        }

        if (user.role === "TEACHER" && student.classId) {
          await requireTeacherClassScope(user, student.classId);
        }

        return student;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    "/schools/:schoolId/students",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const body = request.body;
        const user = request.user;

        if (!user?.role || !["SCHOOL_ADMIN", "TEACHER"].includes(user.role)) {
          return reply.status(403).send({ error: "forbidden" });
        }
        requireSchoolScope(user, schoolId);

        // âœ… classId majburiy
        if (!body.classId) {
          return reply.status(400).send({ error: "Sinf tanlanishi shart" });
        }

        // Sinf mavjudligini tekshirish
        const classExists = await studentsRepo.class.findFirst({
          where: { id: body.classId, schoolId },
        });
        if (!classExists) {
          return reply.status(400).send({ error: "Bunday sinf topilmadi" });
        }
        if (user.role === "TEACHER") {
          await requireTeacherClassScope(user, body.classId);
        }

        const firstName = normalizeNamePart(body.firstName || "");
        const lastName = normalizeNamePart(body.lastName || "");
        const fatherName = normalizeNamePart(body.fatherName || "");
        const gender = normalizeGender(body.gender);
        const fullName =
          firstName || lastName
            ? buildFullName(lastName, firstName)
            : normalizeNamePart(body.name || "");

        if (!firstName || !lastName) {
          return reply
            .status(400)
            .send({ error: "Ism va familiya majburiy" });
        }
        if (!gender) {
          return reply.status(400).send({ error: "Jinsi noto'g'ri yoki bo'sh" });
        }

        const existing = await studentsRepo.student.findFirst({
          where: buildDuplicateStudentWhere({
            schoolId,
            classId: body.classId,
            firstName,
            lastName,
            fullName,
          }),
          select: { id: true },
        });
        if (existing) {
          return reply
            .status(409)
            .send({ error: "Bu sinfda bunday o'quvchi mavjud" });
        }

        const student = await studentsRepo.student.create({
          data: {
            ...body,
            schoolId,
            name: fullName,
            firstName,
            lastName,
            fatherName: fatherName || null,
            gender,
          },
        });
        return student;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

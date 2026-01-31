import { FastifyInstance } from 'fastify';
import prisma from "../../../prisma";
import { addDaysUtc, getDateKeyInZone, dateKeyToUtcDate } from "../../../utils/date";
import {
  requireRoles,
  requireSchoolScope,
  requireClassSchoolScope,
} from "../../../utils/authz";
import { sendHttpError } from "../../../utils/httpErrors";
import { logAudit } from "../../../utils/audit";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/schools/:schoolId/classes',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN', 'TEACHER', 'GUARD']);
        requireSchoolScope(user, schoolId);

        let where: any = { schoolId };
        if (user.role === 'TEACHER') {
          const rows = await prisma.teacherClass.findMany({
            where: { teacherId: user.sub },
            select: { classId: true },
          });
          const classIds = rows.map((r) => r.classId);
          where = { ...where, id: { in: classIds.length ? classIds : ['__none__'] } };
        }

        const [school, classes] = await Promise.all([
          prisma.school.findUnique({ where: { id: schoolId }, select: { timezone: true } }),
          prisma.class.findMany({
          where,
          include: {
            _count: { select: { students: true } },
          },
          }),
        ]);

        const tz = school?.timezone || 'Asia/Tashkent';
        const now = new Date();
        const todayKey = getDateKeyInZone(now, tz);
        const today = dateKeyToUtcDate(todayKey);
        const tomorrow = addDaysUtc(today, 1);
        
        const classesWithAttendance = await Promise.all(
          classes.map(async (cls) => {
            const [presentCount, lateCount, absentCount] = await Promise.all([
              prisma.dailyAttendance.count({
                where: { date: { gte: today, lt: tomorrow }, status: 'PRESENT', student: { classId: cls.id } },
              }),
              prisma.dailyAttendance.count({
                where: { date: { gte: today, lt: tomorrow }, status: 'LATE', student: { classId: cls.id } },
              }),
              prisma.dailyAttendance.count({
                where: { date: { gte: today, lt: tomorrow }, status: 'ABSENT', student: { classId: cls.id } },
              }),
            ]);
            return {
              ...cls,
              todayPresent: presentCount,
              todayLate: lateCount,
              todayAbsent: absentCount,
              totalStudents: cls._count.students,
            };
          }),
        );

        return classesWithAttendance;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.post(
    '/schools/:schoolId/classes',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const { name, gradeLevel, startTime, endTime } = request.body;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        requireSchoolScope(user, schoolId);

        const cls = await prisma.class.create({ data: { name, gradeLevel, schoolId, startTime, endTime } });
        return cls;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.put(
    '/classes/:id',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const data = request.body;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        await requireClassSchoolScope(user, id);

        const existing = await prisma.class.findUnique({ where: { id } });
        if (!existing) {
          return reply.status(404).send({ error: 'not found' });
        }

        const cls = await prisma.class.update({ where: { id }, data });
        logAudit(fastify, {
          action: 'class.update',
          level: 'info',
          message: 'Sinf vaqtini o‘zgartirish',
          userId: user.sub,
          userRole: user.role,
          requestId: request.id,
          schoolId: existing.schoolId,
          extra: {
            classId: id,
            oldStartTime: existing.startTime,
            newStartTime: cls.startTime,
            oldEndTime: existing.endTime,
            newEndTime: cls.endTime,
          },
        });
        return cls;
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.delete(
    '/classes/:id',
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { id } = request.params;
        const user = request.user;

        requireRoles(user, ['SCHOOL_ADMIN']);
        await requireClassSchoolScope(user, id);

        await prisma.class.delete({ where: { id } });
        return { ok: true };
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}


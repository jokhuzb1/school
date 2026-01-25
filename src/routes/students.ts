import { FastifyInstance } from 'fastify';
import prisma from '../prisma';

export default async function (fastify: FastifyInstance) {
  fastify.get('/schools/:schoolId/students', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { schoolId } = request.params;
    const page = Number(request.query.page || 1);
    const take = 50;
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) return reply.status(403).send({ error: 'forbidden' });
    const students = await prisma.student.findMany({ where: { schoolId }, skip: (page - 1) * take, take });
    return { data: students, page };
  });

  fastify.post('/schools/:schoolId/students', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { schoolId } = request.params;
    const body = request.body;
    const user = request.user;
    if (user.role !== 'SUPER_ADMIN' && user.schoolId !== schoolId) return reply.status(403).send({ error: 'forbidden' });
    const student = await prisma.student.create({ data: { ...body, schoolId } });
    return student;
  });

  fastify.get('/students/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { id } = request.params;
    const student = await prisma.student.findUnique({ where: { id }, include: { class: true } });
    if (!student) return reply.status(404).send({});
    return student;
  });

  fastify.get('/students/:id/attendance', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { id } = request.params;
    const { month } = request.query;
    // Simple fetch all or filter by month
    const where: any = { studentId: id };
    if (month) {
      // basic month filter if needed
    }
    const attendance = await prisma.dailyAttendance.findMany({
      where,
      orderBy: { date: 'desc' }
    });
    return attendance;
  });

  fastify.put('/students/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { id } = request.params;
    const data = request.body;
    const student = await prisma.student.update({ where: { id }, data });
    return student;
  });

  fastify.delete('/students/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { id } = request.params;
    const student = await prisma.student.update({ where: { id }, data: { isActive: false } });
    return student;
  });

  fastify.post('/schools/:schoolId/students/import', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    // stub: handle Excel import using exceljs in future
    return { ok: true };
  });
}

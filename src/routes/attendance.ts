import { FastifyInstance } from 'fastify';
import prisma from '../prisma';
import ExcelJS from 'exceljs';

export default async function (fastify: FastifyInstance) {
  fastify.get('/schools/:schoolId/attendance/today', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const { schoolId } = request.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const records = await prisma.dailyAttendance.findMany({
      where: { schoolId, date: today },
      include: {
        student: {
          include: {
            class: true
          }
        }
      }
    });
    return records;
  });

  fastify.post('/schools/:schoolId/attendance/export', { preHandler: [(fastify as any).authenticate] } as any, async (request: any, reply) => {
    const { schoolId } = request.params;
    const { from, to } = request.body;
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const records = await prisma.dailyAttendance.findMany({ where: { schoolId, date: { gte: fromDate, lte: toDate } }, include: { student: true } });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance');
    ws.columns = [
      { header: 'Student', key: 'student' },
      { header: 'Date', key: 'date' },
      { header: 'Status', key: 'status' }
    ];
    records.forEach(r => {
      ws.addRow({ student: r.student.name, date: r.date.toISOString().slice(0, 10), status: r.status });
    });

    reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    reply.header('Content-Disposition', 'attachment; filename="attendance.xlsx"');
    await wb.xlsx.write(reply.raw);
    reply.sent = true;
  });

  fastify.put('/attendance/:id', { preHandler: [(fastify as any).authenticate] } as any, async (request: any) => {
    const { id } = request.params;
    const data = request.body;
    return prisma.dailyAttendance.update({ where: { id }, data });
  });
}

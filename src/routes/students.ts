import { FastifyInstance } from "fastify";
import prisma from "../prisma";
import ExcelJS from "exceljs";
import { getLocalDateOnly } from "../utils/date";

export default async function (fastify: FastifyInstance) {
  fastify.get(
    "/schools/:schoolId/students",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { schoolId } = request.params;
      const { page = 1, search = "", classId } = request.query as any;
      const take = 50;
      const skip = (Number(page) - 1) * take;

      const user = request.user;
      if (user.role !== "SUPER_ADMIN" && user.schoolId !== schoolId)
        return reply.status(403).send({ error: "forbidden" });

      const where: any = {
        schoolId,
        isActive: true,
      };

      if (search) {
        where.name = { contains: search, mode: "insensitive" };
      }
      if (classId) {
        where.classId = classId;
      }

      const [students, total] = await Promise.all([
        prisma.student.findMany({
          where,
          skip,
          take,
          include: { class: true },
          orderBy: { name: "asc" },
        }),
        prisma.student.count({ where }),
      ]);

      // Get today's attendance for all students
      const today = getLocalDateOnly(new Date());
      const studentIds = students.map((s) => s.id);
      
      const todayAttendance = await prisma.dailyAttendance.findMany({
        where: {
          studentId: { in: studentIds },
          date: today,
        },
        select: {
          studentId: true,
          status: true,
          firstScanTime: true,
        },
      });

      const attendanceMap = new Map(
        todayAttendance.map((a) => [a.studentId, a])
      );

      // Add today's status to each student
      const studentsWithStatus = students.map((s) => ({
        ...s,
        todayStatus: attendanceMap.get(s.id)?.status || null,
        todayFirstScan: attendanceMap.get(s.id)?.firstScanTime || null,
      }));

      return { data: studentsWithStatus, total, page: Number(page) };
    },
  );

  fastify.post(
    "/schools/:schoolId/students",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { schoolId } = request.params;
      const body = request.body;
      const user = request.user;
      if (user.role !== "SUPER_ADMIN" && user.schoolId !== schoolId)
        return reply.status(403).send({ error: "forbidden" });
      const student = await prisma.student.create({
        data: { ...body, schoolId },
      });
      return student;
    },
  );

  fastify.get(
    "/schools/:schoolId/students/export",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { schoolId } = request.params;
      const user = request.user;
      if (user.role !== "SUPER_ADMIN" && user.schoolId !== schoolId)
        return reply.status(403).send({ error: "forbidden" });

      const students = await prisma.student.findMany({
        where: { schoolId, isActive: true },
        include: { class: true },
        orderBy: { name: "asc" },
      });

      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Students");
      ws.columns = [
        { header: "Name", key: "name", width: 30 },
        { header: "Device ID", key: "deviceStudentId", width: 15 },
        { header: "Class", key: "class", width: 15 },
        { header: "Parent Name", key: "parentName", width: 25 },
        { header: "Parent Phone", key: "parentPhone", width: 20 },
      ];

      students.forEach((s) => {
        ws.addRow({
          name: s.name,
          deviceStudentId: s.deviceStudentId,
          class: s.class?.name || "",
          parentName: s.parentName || "",
          parentPhone: s.parentPhone || "",
        });
      });

      reply.header(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      reply.header(
        "Content-Disposition",
        'attachment; filename="students.xlsx"',
      );

      const buffer = await wb.xlsx.writeBuffer();
      return reply.send(buffer);
    },
  );

  fastify.post(
    "/schools/:schoolId/students/import",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { schoolId } = request.params;
      const user = request.user;
      if (user.role !== "SUPER_ADMIN" && user.schoolId !== schoolId)
        return reply.status(403).send({ error: "forbidden" });

      const files = request.body.file;
      if (!files || files.length === 0) {
        return reply.status(400).send({ error: "No file uploaded" });
      }

      const file = files[0];
      const buffer = file.data;

      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buffer);
      const ws = wb.getWorksheet(1);
      if (!ws) return reply.status(400).send({ error: "Invalid sheet" });

      let importedCount = 0;
      for (let i = 2; i <= ws.rowCount; i++) {
        const row = ws.getRow(i);
        const name = row.getCell(1).text;
        const deviceStudentId = row.getCell(2).text;
        const className = row.getCell(3).text;
        const parentName = row.getCell(4).text;
        const parentPhone = row.getCell(5).text;

        if (!name || !deviceStudentId) continue;

        let classId = null;
        if (className) {
          let cls = await prisma.class.findFirst({
            where: { name: className, schoolId },
          });
          if (!cls) {
            cls = await prisma.class.create({
              data: {
                name: className,
                schoolId,
                gradeLevel: 1,
                startTime: "08:00",
              },
            });
          }
          classId = cls.id;
        }

        const existingStudent = await prisma.student.findFirst({
          where: { schoolId, deviceStudentId },
        });

        if (existingStudent) {
          await prisma.student.update({
            where: { id: existingStudent.id },
            data: {
              name,
              classId,
              parentName,
              parentPhone,
              isActive: true,
            },
          });
        } else {
          await prisma.student.create({
            data: {
              name,
              deviceStudentId,
              classId,
              parentName,
              parentPhone,
              schoolId,
            },
          });
        }
        importedCount++;
      }

      return { imported: importedCount };
    },
  );

  fastify.get(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { id } = request.params;
      const student = await prisma.student.findUnique({
        where: { id },
        include: { class: true },
      });
      if (!student) return reply.status(404).send({});
      return student;
    },
  );

  fastify.get(
    "/students/:id/attendance",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { id } = request.params;
      const where: any = { studentId: id };
      const attendance = await prisma.dailyAttendance.findMany({
        where,
        orderBy: { date: "desc" },
      });
      return attendance;
    },
  );

  // Kirdi-chiqdi eventlar tarixi
  fastify.get(
    "/students/:id/events",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { id } = request.params;
      const { date } = request.query as { date?: string };
      
      const where: any = { studentId: id };
      
      // Agar sana berilgan bo'lsa, faqat o'sha kunniki
      if (date) {
        const startOfDay = new Date(`${date}T00:00:00Z`);
        const endOfDay = new Date(`${date}T23:59:59Z`);
        where.timestamp = { gte: startOfDay, lte: endOfDay };
      }
      
      const events = await prisma.attendanceEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: 100,
        include: {
          device: true,
        },
      });
      return events;
    },
  );

  fastify.put(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { id } = request.params;
      const data = request.body;
      const student = await prisma.student.update({ where: { id }, data });
      return student;
    },
  );

  fastify.delete(
    "/students/:id",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      const { id } = request.params;
      const student = await prisma.student.update({
        where: { id },
        data: { isActive: false },
      });
      return student;
    },
  );
}

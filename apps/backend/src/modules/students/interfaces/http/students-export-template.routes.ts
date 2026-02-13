import { FastifyInstance } from "fastify";
import { StudentsHttpDeps } from "./students.routes.deps";

export function registerStudentsExportTemplateRoutes(fastify: FastifyInstance, deps: StudentsHttpDeps) {
  const { studentsRepo, ExcelJS, requireRoles, requireSchoolScope, sendHttpError } = deps;

  fastify.get(
    "/schools/:schoolId/students/export",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        const students = await studentsRepo.student.findMany({
          where: { schoolId, isActive: true },
          include: { class: true },
          orderBy: [
            { class: { gradeLevel: "asc" } },
            { class: { name: "asc" } },
            { lastName: "asc" },
            { firstName: "asc" },
          ],
        });

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Students");
        ws.columns = [
          { header: "Last Name", key: "lastName", width: 18 },
          { header: "First Name", key: "firstName", width: 18 },
          { header: "Father Name", key: "fatherName", width: 18 },
          { header: "Gender", key: "gender", width: 12 },
          { header: "Device ID", key: "deviceStudentId", width: 15 },
          { header: "Class", key: "class", width: 15 },
          { header: "Parent Phone", key: "parentPhone", width: 20 },
        ];

        students.forEach((s) => {
          ws.addRow({
            lastName: s.lastName || "",
            firstName: s.firstName || "",
            fatherName: s.fatherName || "",
            gender: s.gender === "FEMALE" ? "Female" : "Male",
            deviceStudentId: s.deviceStudentId,
            class: s.class?.name || "",
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
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );

  fastify.get(
    "/schools/:schoolId/students/template",
    { preHandler: [(fastify as any).authenticate] } as any,
    async (request: any, reply) => {
      try {
        const { schoolId } = request.params;
        const user = request.user;

        requireRoles(user, ["SCHOOL_ADMIN"]);
        requireSchoolScope(user, schoolId);

        // Match iVMS "Person Information Template.xlsx" layout exactly:
        // - A1..A8: rules
        // - Row 9: headers
        // - Add one extra column at the end: Photo
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Sheet1");

        const rules = [
          "\tRule:",
          "\t1.The items with asterisk are required.",
          "\t2.Gender 1:Male 2:Female",
          "\t3.Date Format:YYYY/MM/DD",
          "\t4.Seperate the card numbers with semicolon.",
          "\t5.If the card number is started with 0, add ' before 0. For example, '012345.",
          "\t6.Separate the organization hierarchies with /.",
          "\t7.Format of Room No.:Take room 1 as an example, the room No. should be 1 or 1-1-1-1 (Project-Building-Unit-Room No.).",
        ];
        rules.forEach((text, idx) => {
          ws.getCell(`A${idx + 1}`).value = text;
        });

        const headers = [
          "*Person ID",
          "*Organization",
          "*Person Name",
          "*Gender",
          "Contact",
          "Email",
          "Effective Time",
          "Expiry Time",
          "Card No.",
          "Room No.",
          "Floor No.",
          "Photo",
        ];
        headers.forEach((h, idx) => {
          ws.getRow(9).getCell(idx + 1).value = h;
        });

        ws.columns = [
          { width: 16 },
          { width: 20 },
          { width: 24 },
          { width: 12 },
          { width: 18 },
          { width: 22 },
          { width: 20 },
          { width: 20 },
          { width: 16 },
          { width: 14 },
          { width: 12 },
          { width: 12 },
        ];

        for (let row = 10; row <= 500; row++) {
          ws.getCell(`D${row}`).dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"Male,Female"'],
            showErrorMessage: true,
            errorStyle: "stop",
            errorTitle: "Invalid value",
            error: "Only Male or Female is allowed",
          };
          for (const col of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) {
            ws.getCell(`${col}${row}`).protection = { locked: false };
          }
        }

        await ws.protect("students-template-lock", {
          selectLockedCells: true,
          selectUnlockedCells: true,
          formatCells: false,
          formatColumns: false,
          formatRows: false,
          insertColumns: false,
          insertRows: false,
          insertHyperlinks: false,
          deleteColumns: false,
          deleteRows: false,
          sort: false,
          autoFilter: false,
          pivotTables: false,
        });

        reply.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        reply.header(
          "Content-Disposition",
          'attachment; filename="talabalar-shablon.xlsx"',
        );

        const buffer = await wb.xlsx.writeBuffer();
        return reply.send(buffer);
      } catch (err) {
        return sendHttpError(reply, err);
      }
    },
  );
}

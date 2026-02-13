import { StudentsHttpDeps } from "./students.routes.deps";
import { persistStudentsImportRows } from "./students-import-persist.service";

export async function handleStudentsImportRequest(
  request: any,
  reply: any,
  deps: StudentsHttpDeps,
) {
  const { studentsRepo,
    ExcelJS,
    requireRoles,
    requireSchoolScope,
    sendHttpError,
    normalizeHeader,
    splitFullName,
    normalizeNamePart,
    normalizeGender,
    buildFullName,
  } = deps;

  try {
    const { schoolId } = request.params;
    const user = request.user;
    const { createMissingClass } = request.query as any;
    const allowCreateMissingClass = String(createMissingClass) === "true";

    requireRoles(user, ["SCHOOL_ADMIN"]);
    requireSchoolScope(user, schoolId);

    const files = request.body?.file;
    const file = Array.isArray(files) ? files[0] : files;
    if (!file || !file.data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const filename = String(file.filename || "");
    const mimetype = String(file.mimetype || "").toLowerCase();
    if (!filename.toLowerCase().endsWith(".xlsx")) {
      return reply.status(400).send({ error: "Invalid file type" });
    }
    if (
      mimetype &&
      mimetype !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      return reply.status(400).send({ error: "Invalid file type" });
    }

    const buffer = file.data;
    if (buffer.length > 50 * 1024 * 1024) {
      return reply.status(400).send({ error: "File too large" });
    }

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.getWorksheet(1);
    if (!ws) return reply.status(400).send({ error: "Invalid sheet" });

    let headerRowNumber = 1;
    for (let r = 1; r <= 30; r++) {
      const row = ws.getRow(r);
      const texts = Array.from({ length: 20 }, (_, i) =>
        normalizeHeader(String(row.getCell(i + 1).text || "")),
      ).filter(Boolean);
      if (
        texts.includes("person id") &&
        (texts.includes("person name") ||
          texts.includes("name") ||
          texts.includes("ism") ||
          (texts.includes("first name") && texts.includes("last name")) ||
          (texts.includes("ism") && texts.includes("familiya")))
      ) {
        headerRowNumber = r;
        break;
      }
      if (
        texts.includes("device id") &&
        (texts.includes("name") ||
          texts.includes("ism") ||
          (texts.includes("first name") && texts.includes("last name")) ||
          (texts.includes("ism") && texts.includes("familiya")))
      ) {
        headerRowNumber = r;
        break;
      }
    }

    const headerRow = ws.getRow(headerRowNumber);
    const headerMap = new Map<string, number>();
    for (let c = 1; c <= 50; c++) {
      const raw = String(headerRow.getCell(c).text || "");
      const key = normalizeHeader(raw);
      if (!key) continue;
      if (!headerMap.has(key)) headerMap.set(key, c);
    }

    const isIvmsTemplate =
      headerMap.has("person id") &&
      headerMap.has("organization") &&
      headerMap.has("person name") &&
      headerMap.has("gender");

    const isLegacyInternal =
      headerMap.has("name") &&
      headerMap.has("device id") &&
      headerMap.has("gender") &&
      headerMap.has("class") &&
      headerMap.has("father name") &&
      headerMap.has("parent phone");

    const isNewInternal =
      (headerMap.has("name") ||
        headerMap.has("ism") ||
        (headerMap.has("first name") && headerMap.has("last name")) ||
        (headerMap.has("ism") && headerMap.has("familiya"))) &&
      headerMap.has("person id") &&
      (headerMap.has("class") || headerMap.has("sinf")) &&
      (headerMap.has("gender") || headerMap.has("jinsi")) &&
      (headerMap.has("father name") || headerMap.has("otasining ismi")) &&
      (headerMap.has("parent phone") || headerMap.has("ota-ona telefoni"));

    if (!isIvmsTemplate && !isLegacyInternal && !isNewInternal) {
      return reply.status(400).send({
        error: "Header mismatch. Please use the exported template.",
      });
    }

    const dataStartRow = headerRowNumber + 1;
    const colName =
      headerMap.get("person name") ?? headerMap.get("name") ?? headerMap.get("ism");
    const colFirstName = headerMap.get("first name") ?? headerMap.get("ism");
    const colLastName = headerMap.get("last name") ?? headerMap.get("familiya");
    const colPersonId = headerMap.get("person id") ?? headerMap.get("device id");
    const colClass =
      headerMap.get("organization") ?? headerMap.get("class") ?? headerMap.get("sinf");
    const colParentName = headerMap.get("father name") ?? headerMap.get("otasining ismi");
    const colGender = headerMap.get("gender") ?? headerMap.get("jinsi");
    const colParentPhone =
      headerMap.get("parent phone") ??
      headerMap.get("ota-ona telefoni") ??
      headerMap.get("contact");

    const classRows = await studentsRepo.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
    const classMap = new Map(classRows.map((c) => [c.name.trim().toLowerCase(), c]));

    const seenDeviceIds = new Set<string>();
    const seenNameKeys = new Set<string>();
    let skippedCount = 0;
    const errors: Array<{ row: number; message: string }> = [];

    const lastRow = ws.actualRowCount || ws.rowCount;
    const rows: Array<{
      row: number;
      name: string;
      firstName: string;
      lastName: string;
      fatherName: string;
      gender: "MALE" | "FEMALE";
      deviceStudentId: string;
      className: string;
      parentPhone: string;
    }> = [];
    const missingClassNames = new Set<string>();

    for (let i = dataStartRow; i <= lastRow; i++) {
      const row = ws.getRow(i);
      const name = colName ? row.getCell(colName).text.trim() : "";
      const firstNameRaw = colFirstName ? row.getCell(colFirstName).text.trim() : "";
      const lastNameRaw = colLastName ? row.getCell(colLastName).text.trim() : "";
      const nameParts =
        firstNameRaw || lastNameRaw
          ? { firstName: firstNameRaw, lastName: lastNameRaw }
          : splitFullName(name);
      const firstName = normalizeNamePart(nameParts.firstName);
      const lastName = normalizeNamePart(nameParts.lastName);
      const deviceStudentId = colPersonId ? row.getCell(colPersonId).text.trim() : "";
      const className = colClass ? row.getCell(colClass).text.trim() : "";
      const fatherName = colParentName ? row.getCell(colParentName).text.trim() : "";
      const gender = normalizeGender(colGender ? row.getCell(colGender).text.trim() : "");
      const parentPhone = colParentPhone ? row.getCell(colParentPhone).text.trim() : "";

      if ((!firstName || !lastName) || !deviceStudentId) {
        skippedCount++;
        errors.push({
          row: i,
          message: isIvmsTemplate
            ? "Person Name and Person ID are required"
            : "Ism, familiya va Person ID majburiy",
        });
        continue;
      }
      if (seenDeviceIds.has(deviceStudentId)) {
        skippedCount++;
        errors.push({ row: i, message: "Duplicate Device ID in file" });
        continue;
      }
      seenDeviceIds.add(deviceStudentId);

      const nameKey = `${className.toLowerCase()}|${lastName.toLowerCase()}|${firstName.toLowerCase()}`;
      if (seenNameKeys.has(nameKey)) {
        skippedCount++;
        errors.push({ row: i, message: "Duplicate name in class (file)" });
        continue;
      }
      seenNameKeys.add(nameKey);
      if (!gender) {
        skippedCount++;
        errors.push({
          row: i,
          message: "Gender noto'g'ri. Faqat Male/Female (yoki 1/2)",
        });
        continue;
      }

      if (className) {
        const key = className.toLowerCase();
        if (!classMap.has(key)) {
          if (!allowCreateMissingClass) {
            skippedCount++;
            errors.push({
              row: i,
              message: "Class not found (enable createMissingClass)",
            });
            continue;
          }
          missingClassNames.add(className);
        }
      }

      rows.push({
        row: i,
        name: buildFullName(lastName, firstName),
        firstName,
        lastName,
        fatherName,
        gender,
        deviceStudentId,
        className,
        parentPhone,
      });
    }

    const result = await persistStudentsImportRows({
      deps,
      schoolId,
      allowCreateMissingClass,
      missingClassNames,
      classMap,
      rows,
      skippedCount,
      errors,
    });

    return {
      imported: result.importedCount,
      skipped: result.skippedCount,
      errors: result.errors,
    };
  } catch (err) {
    return sendHttpError(reply, err);
  }
}


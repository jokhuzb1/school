import { StudentsHttpDeps } from "./students.routes.deps";

type ImportRow = {
  row: number;
  name: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  gender: "MALE" | "FEMALE";
  deviceStudentId: string;
  className: string;
  parentPhone: string;
};

export async function persistStudentsImportRows(params: {
  deps: StudentsHttpDeps;
  schoolId: string;
  allowCreateMissingClass: boolean;
  missingClassNames: Set<string>;
  classMap: Map<string, { id: string; name: string }>;
  rows: ImportRow[];
  skippedCount: number;
  errors: Array<{ row: number; message: string }>;
}) {
  const {
    deps,
    schoolId,
    allowCreateMissingClass,
    missingClassNames,
    classMap,
    rows,
    errors,
  } = params;
  const { studentsRepo } = deps;
  let skippedCount = params.skippedCount;
  let importedCount = 0;

  if (allowCreateMissingClass && missingClassNames.size > 0) {
    const createOps = Array.from(missingClassNames).map((name) =>
      studentsRepo.class.create({
        data: { name, schoolId, gradeLevel: 1, startTime: "08:00" },
      }),
    );
    const created = await studentsRepo.$transaction(createOps);
    created.forEach((cls) => {
      classMap.set(cls.name.trim().toLowerCase(), cls);
    });
  }

  const classIdsToCheck = Array.from(
    new Set(
      rows
        .map((r) => classMap.get(r.className.toLowerCase())?.id || null)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const existingStudents = classIdsToCheck.length
    ? await studentsRepo.student.findMany({
        where: {
          schoolId,
          classId: { in: classIdsToCheck },
          isActive: true,
        },
        select: { classId: true, firstName: true, lastName: true },
      })
    : [];
  const existingKeys = new Set(
    existingStudents.map(
      (s) =>
        `${s.classId}|${s.lastName?.toLowerCase() || ""}|${s.firstName?.toLowerCase() || ""}`,
    ),
  );

  const ops = rows.flatMap((r) => {
    const classId = r.className
      ? classMap.get(r.className.toLowerCase())?.id || null
      : null;
    if (classId) {
      const key = `${classId}|${r.lastName.toLowerCase()}|${r.firstName.toLowerCase()}`;
      if (existingKeys.has(key)) {
        skippedCount++;
        errors.push({ row: r.row, message: "Bu sinfda bunday o'quvchi mavjud" });
        return [];
      }
    }
    return [
      studentsRepo.student.upsert({
        where: {
          schoolId_deviceStudentId: {
            schoolId,
            deviceStudentId: r.deviceStudentId,
          },
        },
        update: {
          name: r.name,
          firstName: r.firstName,
          lastName: r.lastName,
          fatherName: r.fatherName || null,
          gender: r.gender,
          classId,
          parentPhone: r.parentPhone || null,
          isActive: true,
        },
        create: {
          name: r.name,
          firstName: r.firstName,
          lastName: r.lastName,
          fatherName: r.fatherName || null,
          gender: r.gender,
          deviceStudentId: r.deviceStudentId,
          classId,
          parentPhone: r.parentPhone || null,
          schoolId,
        },
      }),
    ];
  });

  const chunkSize = 200;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const chunk = ops.slice(i, i + chunkSize);
    await studentsRepo.$transaction(chunk);
    importedCount += chunk.length;
  }

  return {
    importedCount,
    skippedCount,
    errors,
  };
}


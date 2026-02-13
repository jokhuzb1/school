type NormalizeNamePart = (input: string) => string;
type NormalizeGender = (input: string) => "MALE" | "FEMALE" | null;

export type DeviceImportCommitRow = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  classId: string;
  parentPhone: string;
  gender: "MALE" | "FEMALE";
};

export function normalizeDeviceImportCommitRows(
  rawRows: any[],
  normalizeNamePart: NormalizeNamePart,
  normalizeGender: NormalizeGender,
): DeviceImportCommitRow[] {
  return rawRows.map((item: any) => ({
    employeeNo: String(item?.employeeNo || "").trim(),
    firstName: normalizeNamePart(item?.firstName || ""),
    lastName: normalizeNamePart(item?.lastName || ""),
    fatherName: normalizeNamePart(item?.fatherName || ""),
    classId: String(item?.classId || "").trim(),
    parentPhone: String(item?.parentPhone || "").trim(),
    gender: normalizeGender(item?.gender || "MALE") || "MALE",
  }));
}

export function collectImportCommitUniqueValues(rows: DeviceImportCommitRow[]) {
  const classIds = Array.from(
    new Set(rows.map((r) => r.classId).filter((v): v is string => Boolean(v))),
  );
  const employeeNos = Array.from(
    new Set(rows.map((r) => r.employeeNo).filter((v): v is string => Boolean(v))),
  );
  return { classIds, employeeNos };
}

export function getInvalidImportCommitRows(
  rows: DeviceImportCommitRow[],
  classSet: Set<string>,
) {
  const dupCounter = new Map<string, number>();
  rows.forEach((r) =>
    dupCounter.set(r.employeeNo, (dupCounter.get(r.employeeNo) || 0) + 1),
  );

  return rows.filter((row) => {
    if (!row.employeeNo || !row.firstName || !row.lastName || !row.classId) {
      return true;
    }
    if ((dupCounter.get(row.employeeNo) || 0) > 1) return true;
    if (!classSet.has(row.classId)) return true;
    return false;
  });
}


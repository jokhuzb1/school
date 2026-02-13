import type { ClassInfo, SchoolDeviceInfo } from '../../api';
import type { ImportRow } from './types';
import type { SyncMode } from './useDeviceImportWorkflow.types';

export function resolveImportTargetDeviceIds(params: {
  importSyncMode: SyncMode;
  schoolDevice: SchoolDeviceInfo | null;
  allSchoolDevices: SchoolDeviceInfo[];
  importSelectedDeviceIds: string[];
}): string[] {
  const { importSyncMode, schoolDevice, allSchoolDevices, importSelectedDeviceIds } = params;
  if (importSyncMode === 'none') return [];
  if (importSyncMode === 'current') return schoolDevice?.id ? [schoolDevice.id] : [];
  if (importSyncMode === 'all') return allSchoolDevices.map((item) => item.id);
  return importSelectedDeviceIds;
}

export function calcPreviewStats(importRows: ImportRow[]) {
  const total = importRows.length;
  const invalid = importRows.filter((row) => !row.employeeNo || !row.firstName || !row.lastName || !row.classId).length;
  const done = importRows.filter((row) => row.status === 'saved').length;
  const failed = importRows.filter((row) => row.status === 'error').length;
  const pending = total - done - failed;
  return { total, invalid, done, failed, pending };
}

export function validateImportRows(
  importRows: ImportRow[],
  availableClasses: ClassInfo[],
): { ok: boolean; rows: ImportRow[]; errors: number } {
  const seen = new Set<string>();
  const classSet = new Set(availableClasses.map((item) => item.id));
  let errors = 0;

  const rows = importRows.map((row) => {
    let error = '';
    const key = `${row.employeeNo}`.trim();
    if (!row.employeeNo || !row.firstName || !row.lastName || !row.classId) {
      error = "Majburiy maydonlar to'liq emas";
    } else if (seen.has(key)) {
      error = 'Duplicate employeeNo import ichida';
    } else if (!classSet.has(row.classId)) {
      error = 'Class topilmadi';
    }
    seen.add(key);
    if (error) errors += 1;
    return { ...row, error: error || row.error } as ImportRow;
  });

  return { ok: errors === 0, rows, errors };
}

export function mapRowsToCommitPayload(rows: ImportRow[], queue: number[]) {
  return queue
    .map((idx) => rows[idx])
    .filter(Boolean)
    .map((row) => ({
      employeeNo: row.employeeNo,
      firstName: row.firstName,
      lastName: row.lastName,
      fatherName: row.fatherName || undefined,
      classId: row.classId,
      parentPhone: row.parentPhone || undefined,
      gender: row.gender,
    }));
}

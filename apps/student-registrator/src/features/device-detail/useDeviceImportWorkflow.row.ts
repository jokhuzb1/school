import {
  fetchStudentByDeviceStudentId,
  getUserFace,
  syncStudentToDevices,
  updateStudentProfile,
} from '../../api';
import type { ImportRow } from './types';

export async function processImportQueueRow(params: {
  row: ImportRow;
  authSchoolId: string;
  targetDeviceIds: string[];
  importPullFace: boolean;
  localDeviceId?: string;
  studentId: string;
}): Promise<{
  row: ImportRow;
  ok: boolean;
  syncedInc: number;
  faceSuccessInc: number;
}> {
  const { row, authSchoolId, targetDeviceIds, importPullFace, localDeviceId, studentId } = params;

  let faceImageBase64: string | undefined;
  let faceError: string | undefined;
  if (importPullFace && row.hasFace && localDeviceId) {
    try {
      const face = await getUserFace(localDeviceId, row.employeeNo);
      faceImageBase64 = face.imageBase64;
    } catch (err) {
      faceError = err instanceof Error ? err.message : 'Face sync xato';
    }
  }
  if (faceError) {
    throw new Error(`Face sync xato: ${faceError}`);
  }

  let faceSuccessInc = 0;
  if (faceImageBase64) {
    await updateStudentProfile(studentId, {
      firstName: row.firstName,
      lastName: row.lastName,
      fatherName: row.fatherName || undefined,
      classId: row.classId,
      parentPhone: row.parentPhone || undefined,
      gender: row.gender,
      deviceStudentId: row.employeeNo,
      faceImageBase64,
    });
    faceSuccessInc = 1;
  }

  const confirmed = await fetchStudentByDeviceStudentId(authSchoolId, row.employeeNo).catch(() => null);
  const resolvedStudentId = confirmed?.id || studentId;

  let syncResults: ImportRow['syncResults'] = [];
  let syncedInc = 0;

  if (targetDeviceIds.length > 0) {
    const syncResult = await syncStudentToDevices(resolvedStudentId, targetDeviceIds);
    syncResults = syncResult.perDeviceResults.map((item) => ({
      backendDeviceId: item.backendDeviceId,
      deviceName: item.deviceName,
      status: item.status,
      lastError: item.lastError,
    }));

    const hasSyncFailure = !syncResult.ok || syncResults.some((item) => item.status.toUpperCase() !== 'SUCCESS');
    if (hasSyncFailure) {
      throw new Error(
        syncResults
          .filter((item) => item.status.toUpperCase() !== 'SUCCESS')
          .map((item) => `${item.deviceName || item.backendDeviceId}: ${item.lastError || item.status}`)
          .join('; ') || 'Qurilmaga sync xato',
      );
    }
    syncedInc = 1;
  }

  return {
    row: {
      ...row,
      studentId: resolvedStudentId,
      faceSynced: Boolean(faceImageBase64),
      syncResults,
      faceError: undefined,
      status: 'saved',
      error: undefined,
    },
    ok: true,
    syncedInc,
    faceSuccessInc,
  };
}

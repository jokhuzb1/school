import { isDeviceCredentialsExpired } from '../../utils/deviceResolver';
import { buildImportRunMetrics, formatImportRunMetrics, normalizeAndDedupeDeviceImportCandidates, type RawDeviceImportCandidate } from '../device-import/deviceImportShared';
import { getFaceWithRetry } from './useDeviceModeImport.helpers';
import type { DeviceConfig, StudentRow } from '../../types';

type ConfirmDeviceModeImportActionParams = {
  sourceImportDeviceIds: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setSourceImportDeviceId: (value: string) => void;
  setIsDeviceImporting: (value: boolean) => void;
  collectUsersFromSource: (backendId: string) => Promise<{ rows: RawDeviceImportCandidate[]; errors: string[] }>;
  importStudents: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => StudentRow[];
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  resolveLocalDevice: (backendId?: string | null) => {
    localDevice?: DeviceConfig | null;
  };
  setRefreshingFaceIds: (updater: (prev: string[]) => string[]) => void;
  setIsSourceImportModalOpen: (value: boolean) => void;
};

export async function confirmDeviceModeImportAction({
  sourceImportDeviceIds,
  addToast,
  setSourceImportDeviceId,
  setIsDeviceImporting,
  collectUsersFromSource,
  importStudents,
  updateStudent,
  resolveLocalDevice,
  setRefreshingFaceIds,
  setIsSourceImportModalOpen,
}: ConfirmDeviceModeImportActionParams) {
  if (sourceImportDeviceIds.length === 0) {
    addToast('Manba qurilmalarni tanlang', 'error');
    return;
  }

  setSourceImportDeviceId(sourceImportDeviceIds[0] || '');
  setIsDeviceImporting(true);

  try {
    const sourceErrors: string[] = [];
    const collectedRows: RawDeviceImportCandidate[] = [];
    for (const backendId of sourceImportDeviceIds) {
      const result = await collectUsersFromSource(backendId);
      sourceErrors.push(...result.errors);
      collectedRows.push(...result.rows);
    }

    if (collectedRows.length === 0) {
      if (sourceErrors.length > 0) {
        addToast(sourceErrors.join(' | '), 'error');
      } else {
        addToast('Tanlangan qurilmalarda user topilmadi', 'error');
      }
      return;
    }

    const deduped = normalizeAndDedupeDeviceImportCandidates(collectedRows);
    const rows = deduped.normalized.map((item) => {
      return {
        firstName: item.firstName,
        lastName: item.lastName,
        fatherName: undefined,
        gender: item.gender,
        classId: undefined,
        className: undefined,
        parentPhone: undefined,
        imageBase64: undefined as string | undefined,
        deviceStudentId: item.employeeNo,
        sourceDeviceBackendId: item.sourceBackendId,
      };
    });

    const importedRows = importStudents(rows);
    const candidates = importedRows.filter((row) =>
      Boolean(row.deviceStudentId) &&
      deduped.normalized.some((item) => item.employeeNo === row.deviceStudentId && item.hasFace),
    );

    if (candidates.length === 0) {
      const summary = formatImportRunMetrics(
        buildImportRunMetrics({
          total: deduped.totalRaw,
          duplicates: deduped.duplicateCount,
          success: rows.length,
          failed: 0,
          synced: 0,
          faceCandidates: 0,
          faceSuccess: 0,
          faceFailed: 0,
        }),
      );
      addToast(`Device import yakunlandi (${summary})`, 'success');
      setIsSourceImportModalOpen(false);
      return;
    }

    setRefreshingFaceIds((prev) => [...new Set([...prev, ...candidates.map((row) => row.id)])]);
    addToast(
      `Device import boshlandi (${formatImportRunMetrics(
        buildImportRunMetrics({
          total: deduped.totalRaw,
          duplicates: deduped.duplicateCount,
          success: rows.length,
          failed: 0,
          synced: 0,
          faceCandidates: candidates.length,
          faceSuccess: 0,
          faceFailed: 0,
        }),
      )})`,
      'success',
    );

    const concurrency = 4;
    let cursor = 0;
    let pulled = 0;

    const worker = async () => {
      while (cursor < candidates.length) {
        const currentIndex = cursor;
        cursor += 1;
        const row = candidates[currentIndex];
        const employeeNo = row.deviceStudentId || '';
        const localResolution = resolveLocalDevice(row.sourceDeviceBackendId || sourceImportDeviceIds[0]);
        if (!localResolution.localDevice?.id || isDeviceCredentialsExpired(localResolution.localDevice)) {
          setRefreshingFaceIds((prev) => prev.filter((id) => id !== row.id));
          continue;
        }

        const imageBase64 = await getFaceWithRetry(localResolution.localDevice.id, employeeNo, 3);
        if (imageBase64) {
          updateStudent(row.id, { imageBase64 });
          pulled += 1;
        }
        setRefreshingFaceIds((prev) => prev.filter((id) => id !== row.id));
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker()),
    );

    const faceFailed = candidates.length - pulled;
    const finalSummary = formatImportRunMetrics(
      buildImportRunMetrics({
        total: deduped.totalRaw,
        duplicates: deduped.duplicateCount,
        success: rows.length,
        failed: 0,
        synced: 0,
        faceCandidates: candidates.length,
        faceSuccess: pulled,
        faceFailed,
      }),
    );
    addToast(`Device import yakunlandi (${finalSummary})`, faceFailed > 0 ? 'error' : 'success');
    setIsSourceImportModalOpen(false);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Device mode importda xato';
    addToast(message, 'error');
  } finally {
    setIsDeviceImporting(false);
  }
}

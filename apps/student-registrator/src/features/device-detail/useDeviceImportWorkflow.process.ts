import {
  commitDeviceImport,
  getAuthUser,
  getImportJob,
  retryImportJob,
  type ClassInfo,
  type DeviceConfig,
  type SchoolDeviceInfo,
} from '../../api';
import { buildDeviceErrorMessage } from '../../utils/deviceErrorCodes';
import { isDeviceCredentialsExpired } from '../../utils/deviceResolver';
import { buildImportRunMetrics, formatImportRunMetrics } from '../device-import/deviceImportShared';
import type { ImportJob, ImportPreview, ImportRow } from './types';
import { mapRowsToCommitPayload, resolveImportTargetDeviceIds, validateImportRows } from './useDeviceImportWorkflow.helpers';
import { processImportQueueRow } from './useDeviceImportWorkflow.row';
import type { SyncMode } from './useDeviceImportWorkflow.types';
export async function processImportRowsAction(params: {
  targetIndexes?: number[];
  retryOnly?: boolean;
  importLoading: boolean;
  importRows: ImportRow[];
  importSyncMode: SyncMode;
  importSelectedDeviceIds: string[];
  importPullFace: boolean;
  localDevice: DeviceConfig | null;
  schoolDevice: SchoolDeviceInfo | null;
  allSchoolDevices: SchoolDeviceInfo[];
  availableClasses: ClassInfo[];
  importJob: ImportJob | null;
  importPreview: ImportPreview | null;
  setImportRows: (next: ImportRow[]) => void;
  setImportLoading: (next: boolean) => void;
  setImportJob: (next: ImportJob | null | ((prev: ImportJob | null) => ImportJob | null)) => void;
  pushImportAudit: (stage: string, message: string, payload?: Record<string, unknown>) => Promise<void>;
  refreshImportPreview: (rowsOverride?: ImportRow[]) => Promise<void>;
  loadImportMetrics: () => Promise<void>;
  loadUsers: (reset?: boolean) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  importIdempotencyRef: { current: string | null };
}): Promise<void> {
  const {
    targetIndexes,
    retryOnly = false,
    importLoading,
    importRows,
    importSyncMode,
    importSelectedDeviceIds,
    importPullFace,
    localDevice,
    schoolDevice,
    allSchoolDevices,
    availableClasses,
    importJob,
    importPreview,
    setImportRows,
    setImportLoading,
    setImportJob,
    pushImportAudit,
    refreshImportPreview,
    loadImportMetrics,
    loadUsers,
    addToast,
    importIdempotencyRef,
  } = params;
  const auth = getAuthUser();
  if (!auth?.schoolId) {
    addToast('Maktab topilmadi', 'error');
    return;
  }
  if (importLoading) {
    addToast('Import jarayoni allaqachon ishlayapti', 'error');
    return;
  }
  const invalidIndexes = importRows
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !row.employeeNo || !row.firstName || !row.lastName || !row.classId);
  if (invalidIndexes.length > 0) {
    addToast(`Majburiy maydonlar to'ldirilmagan qatorlar: ${invalidIndexes.length}`, 'error');
    return;
  }
  if (importSyncMode === 'selected' && importSelectedDeviceIds.length === 0) {
    addToast('Sync mode selected uchun kamida 1 ta qurilma tanlang', 'error');
    return;
  }
  if (importPullFace && importRows.some((row) => row.hasFace) && !localDevice?.id) {
    addToast(
      buildDeviceErrorMessage({
        code: 'LOCAL_CREDENTIALS_NOT_FOUND',
        deviceName: schoolDevice?.name,
        detail: 'Face sync uchun local credentials topilmadi',
      }),
      'error',
    );
    return;
  }
  if (localDevice?.id && isDeviceCredentialsExpired(localDevice)) {
    addToast(
      buildDeviceErrorMessage({
        code: 'CREDENTIALS_EXPIRED',
        deviceName: schoolDevice?.name,
      }),
      'error',
    );
    return;
  }
  const queue = targetIndexes && targetIndexes.length > 0 ? targetIndexes : importRows.map((_, idx) => idx);
  const validation = validateImportRows(importRows, availableClasses);
  setImportRows(validation.rows);
  const invalidInQueue = queue.some((idx) => Boolean(validation.rows[idx]?.error));
  if ((!retryOnly && !validation.ok) || invalidInQueue) {
    addToast(`Validation xatolari: ${validation.errors}`, 'error');
    return;
  }
  if (retryOnly && importJob?.id) {
    await retryImportJob(auth.schoolId, importJob.id).catch(() => undefined);
  }
  const commitRows = mapRowsToCommitPayload(validation.rows, queue);
  const faceCandidates = queue.filter((idx) => Boolean(validation.rows[idx]?.hasFace)).length;
  const duplicateCount = importPreview?.duplicateCount || 0;
  const targetDeviceIds = resolveImportTargetDeviceIds({
    importSyncMode,
    schoolDevice,
    allSchoolDevices,
    importSelectedDeviceIds,
  });
  const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  importIdempotencyRef.current = idempotencyKey;
  setImportLoading(true);
  const startedAt = new Date().toISOString();
  setImportJob({
    id: idempotencyKey,
    status: 'PROCESSING',
    retryCount: retryOnly ? (importJob?.retryCount || 0) + 1 : 0,
    startedAt,
    processed: 0,
    success: 0,
    failed: 0,
    synced: 0,
  });
  await pushImportAudit('DEVICE_IMPORT_START', 'Import started', {
    idempotencyKey,
    syncMode: importSyncMode,
    targetDeviceIds,
    pullFace: importPullFace,
    retryOnly,
    targetIndexes: targetIndexes || null,
    faceCandidates,
  });
  try {
    const commitResult = await commitDeviceImport(auth.schoolId, {
      rows: commitRows,
      idempotencyKey,
      sourceDeviceId: schoolDevice?.id,
      syncMode: importSyncMode,
      targetDeviceIds,
      retryMode: retryOnly,
    });
    if (commitResult.jobId) {
      const remoteJob = await getImportJob(auth.schoolId, commitResult.jobId).catch(() => null);
      if (remoteJob) {
        setImportJob({
          id: remoteJob.id,
          status: remoteJob.status,
          retryCount: remoteJob.retryCount,
          startedAt: remoteJob.startedAt,
          finishedAt: remoteJob.finishedAt || undefined,
          lastError: remoteJob.lastError || undefined,
          processed: remoteJob.processed,
          success: remoteJob.success,
          failed: remoteJob.failed,
          synced: remoteJob.synced,
        });
      }
    }
    const nextRows = [...validation.rows];
    const studentByEmployeeNo = new Map(
      commitResult.students.map((student) => [String(student.deviceStudentId || ''), student]),
    );
    let success = 0;
    let failed = 0;
    let synced = 0;
    let faceSuccess = 0;
    for (const i of queue) {
      const row = nextRows[i];
      if (!row) continue;
      try {
        const student = studentByEmployeeNo.get(row.employeeNo);
        if (!student?.id) {
          throw new Error('Commit natijasida student topilmadi');
        }
        const result = await processImportQueueRow({
          row,
          authSchoolId: auth.schoolId,
          targetDeviceIds,
          importPullFace,
          localDeviceId: localDevice?.id,
          studentId: student.id,
        });
        nextRows[i] = result.row;
        success += 1;
        synced += result.syncedInc;
        faceSuccess += result.faceSuccessInc;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Saqlashda xato';
        nextRows[i] = {
          ...row,
          status: 'error',
          error: msg,
        };
        failed += 1;
      }
      setImportJob((prev) =>
        prev
          ? {
              ...prev,
              processed: prev.processed + 1,
              success,
              failed,
              synced,
              lastError: prev.lastError,
            }
          : prev,
      );
    }
    setImportRows(nextRows);
    const finishedAt = new Date().toISOString();
    setImportJob((prev) =>
      prev
        ? {
            ...prev,
            status: failed > 0 ? 'FAILED' : 'SUCCESS',
            finishedAt,
            success,
            failed,
            synced,
          }
        : prev,
    );
    await pushImportAudit('DEVICE_IMPORT_FINISH', 'Import finished', {
      idempotencyKey,
      success,
      failed,
      synced,
      duplicates: duplicateCount,
      faceCandidates,
      faceSuccess,
      faceFailed: faceCandidates - faceSuccess,
    });
    const summary = formatImportRunMetrics(
      buildImportRunMetrics({
        total: queue.length,
        duplicates: duplicateCount,
        success,
        failed,
        synced,
        faceCandidates,
        faceSuccess,
        faceFailed: faceCandidates - faceSuccess,
      }),
    );
    addToast(`Import yakunlandi (${summary})`, failed > 0 ? 'error' : 'success');
    await Promise.all([refreshImportPreview(nextRows), loadImportMetrics()]);
    if (success > 0) {
      await loadUsers(true);
    }
    importIdempotencyRef.current = null;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Importda xato';
    setImportJob((prev) =>
      prev
        ? {
            ...prev,
            status: 'FAILED',
            finishedAt: new Date().toISOString(),
            lastError: message,
          }
        : prev,
    );
    await pushImportAudit('DEVICE_IMPORT_FAIL', message);
    addToast(message, 'error');
  } finally {
    setImportLoading(false);
  }
}


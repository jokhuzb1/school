import { useMemo, useRef, useState } from 'react';
import {
  commitDeviceImport,
  createImportAuditLog,
  fetchClasses,
  fetchStudentByDeviceStudentId,
  getAuthUser,
  getImportJob,
  getImportMetrics,
  getUserFace,
  previewDeviceImport,
  retryImportJob,
  syncStudentToDevices,
  updateStudentProfile,
  type ClassInfo,
  type DeviceConfig,
  type SchoolDeviceInfo,
  type UserInfoEntry,
} from '../../api';
import { buildDeviceErrorMessage } from '../../utils/deviceErrorCodes';
import { isDeviceCredentialsExpired } from '../../utils/deviceResolver';
import {
  buildImportRunMetrics,
  formatImportRunMetrics,
  normalizeAndDedupeDeviceImportCandidates,
} from '../device-import/deviceImportShared';
import type { ImportJob, ImportPreview, ImportRow } from './types';

type SyncMode = 'none' | 'current' | 'all' | 'selected';

type UseDeviceImportWorkflowParams = {
  users: UserInfoEntry[];
  schoolDevice: SchoolDeviceInfo | null;
  localDevice: DeviceConfig | null;
  allSchoolDevices: SchoolDeviceInfo[];
  allLocalDevices: DeviceConfig[];
  findLocalForBackend: (backend: SchoolDeviceInfo, localDevices: DeviceConfig[]) => DeviceConfig | null;
  loadUsers: (reset?: boolean) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

type UseDeviceImportWorkflowResult = {
  isImportOpen: boolean;
  setIsImportOpen: (next: boolean) => void;
  importRows: ImportRow[];
  importLoading: boolean;
  availableClasses: ClassInfo[];
  importSyncMode: SyncMode;
  setImportSyncMode: (mode: SyncMode) => void;
  importSelectedDeviceIds: string[];
  toggleImportSelectedDevice: (deviceId: string) => void;
  importPullFace: boolean;
  setImportPullFace: (next: boolean) => void;
  importJob: ImportJob | null;
  importAuditTrail: Array<{ at: string; stage: string; message: string }>;
  importPreview: ImportPreview | null;
  importMetrics: {
    totalRuns: number;
    totalSuccess: number;
    totalFailed: number;
    totalSynced: number;
    successRate: number;
    retryRate: number;
    meanLatencyMs: number;
  } | null;
  previewStats: {
    total: number;
    invalid: number;
    done: number;
    failed: number;
    pending: number;
  };
  openImportWizard: () => Promise<void>;
  updateImportRow: (index: number, patch: Partial<ImportRow>) => void;
  getImportDeviceStatus: (device: SchoolDeviceInfo) => 'online' | 'offline' | 'no_credentials';
  refreshImportPreview: (rowsOverride?: ImportRow[]) => Promise<void>;
  processImportRows: (targetIndexes?: number[], retryOnly?: boolean) => Promise<void>;
  saveImportRows: () => Promise<void>;
  retryFailedImportRows: () => Promise<void>;
};

export function useDeviceImportWorkflow({
  users,
  schoolDevice,
  localDevice,
  allSchoolDevices,
  allLocalDevices,
  findLocalForBackend,
  loadUsers,
  addToast,
}: UseDeviceImportWorkflowParams): UseDeviceImportWorkflowResult {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [importSyncMode, setImportSyncModeState] = useState<SyncMode>('none');
  const [importSelectedDeviceIds, setImportSelectedDeviceIds] = useState<string[]>([]);
  const [importPullFace, setImportPullFaceState] = useState(true);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [importAuditTrail, setImportAuditTrail] = useState<Array<{ at: string; stage: string; message: string }>>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMetrics, setImportMetrics] = useState<{
    totalRuns: number;
    totalSuccess: number;
    totalFailed: number;
    totalSynced: number;
    successRate: number;
    retryRate: number;
    meanLatencyMs: number;
  } | null>(null);
  const importIdempotencyRef = useRef<string | null>(null);

  const setImportSyncMode = (mode: SyncMode) => {
    setImportSyncModeState(mode);
  };

  const setImportPullFace = (next: boolean) => {
    setImportPullFaceState(next);
  };

  const toggleImportSelectedDevice = (deviceId: string) => {
    setImportSelectedDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId],
    );
  };

  const resolveImportTargetDeviceIds = (): string[] => {
    if (importSyncMode === 'none') return [];
    if (importSyncMode === 'current') return schoolDevice?.id ? [schoolDevice.id] : [];
    if (importSyncMode === 'all') return allSchoolDevices.map((item) => item.id);
    return importSelectedDeviceIds;
  };

  const getImportDeviceStatus = (device: SchoolDeviceInfo): 'online' | 'offline' | 'no_credentials' => {
    const local = findLocalForBackend(device, allLocalDevices);
    if (!local?.id) return 'no_credentials';
    if (!device.lastSeenAt) return 'offline';
    const lastSeen = new Date(device.lastSeenAt).getTime();
    if (Number.isNaN(lastSeen)) return 'offline';
    return Date.now() - lastSeen < 2 * 60 * 60 * 1000 ? 'online' : 'offline';
  };

  const previewStats = useMemo(() => {
    const total = importRows.length;
    const invalid = importRows.filter((row) => !row.employeeNo || !row.firstName || !row.lastName || !row.classId).length;
    const done = importRows.filter((row) => row.status === 'saved').length;
    const failed = importRows.filter((row) => row.status === 'error').length;
    const pending = total - done - failed;
    return { total, invalid, done, failed, pending };
  }, [importRows]);

  const updateImportRow = (index: number, patch: Partial<ImportRow>) => {
    setImportRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const pushImportAudit = async (
    stage: string,
    message: string,
    payload?: Record<string, unknown>,
  ) => {
    const auth = getAuthUser();
    const at = new Date().toISOString();
    setImportAuditTrail((prev) => [...prev, { at, stage, message }]);
    if (!auth?.schoolId) return;
    try {
      await createImportAuditLog(auth.schoolId, {
        stage,
        status: 'INFO',
        message,
        payload,
      });
    } catch {
      // best-effort audit
    }
  };

  const loadImportMetrics = async () => {
    const auth = getAuthUser();
    if (!auth?.schoolId) return;
    try {
      const metrics = await getImportMetrics(auth.schoolId);
      setImportMetrics(metrics);
    } catch {
      setImportMetrics(null);
    }
  };

  const refreshImportPreview = async (rowsOverride?: ImportRow[]) => {
    const auth = getAuthUser();
    if (!auth?.schoolId) return;
    const baseRows = rowsOverride || importRows;
    try {
      const preview = await previewDeviceImport(
        auth.schoolId,
        baseRows.map((row) => ({
          employeeNo: row.employeeNo,
          firstName: row.firstName,
          lastName: row.lastName,
          fatherName: row.fatherName || undefined,
          classId: row.classId,
          parentPhone: row.parentPhone || undefined,
          gender: row.gender,
        })),
      );
      setImportPreview({
        total: preview.total,
        createCount: preview.createCount,
        updateCount: preview.updateCount,
        skipCount: preview.skipCount,
        invalidCount: preview.invalidCount,
        duplicateCount: preview.duplicateCount,
        classErrorCount: preview.classErrorCount,
      });
    } catch {
      setImportPreview(null);
    }
  };

  const validateImportRows = (): { ok: boolean; rows: ImportRow[]; errors: number } => {
    const seen = new Set<string>();
    const classSet = new Set(availableClasses.map((item) => item.id));
    let errors = 0;
    const next = importRows.map((row) => {
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
      return { ...row, error: error || row.error };
    });
    return { ok: errors === 0, rows: next, errors };
  };

  const openImportWizard = async () => {
    const auth = getAuthUser();
    if (!auth?.schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }
    if (users.length === 0) {
      addToast('Import uchun avval qurilmadan userlarni yuklang', 'error');
      return;
    }

    try {
      const classes = await fetchClasses(auth.schoolId);
      setAvailableClasses(classes);
      const deduped = normalizeAndDedupeDeviceImportCandidates(
        users.map((user) => ({
          employeeNo: user.employeeNo || '',
          name: user.name || '',
          gender: user.gender,
          numOfFace: user.numOfFace,
          sourceBackendId: schoolDevice?.id,
        })),
      );
      const nextRows = deduped.normalized.map((item) => ({
        employeeNo: item.employeeNo,
        name: item.name,
        firstName: item.firstName,
        lastName: item.lastName,
        fatherName: '',
        gender: item.gender === 'female' ? 'FEMALE' : 'MALE',
        classId: '',
        parentPhone: '',
        hasFace: item.hasFace,
        status: 'pending',
      } as ImportRow));
      setImportRows(nextRows);
      setImportSyncModeState('none');
      setImportSelectedDeviceIds(schoolDevice?.id ? [schoolDevice.id] : []);
      setImportPullFaceState(Boolean(localDevice?.id));
      setImportJob(null);
      setImportAuditTrail([]);
      setImportPreview(null);
      setIsImportOpen(true);
      await Promise.all([refreshImportPreview(nextRows), loadImportMetrics()]);
      await pushImportAudit('DEVICE_IMPORT_WIZARD_OPEN', 'Import wizard opened', {
        users: users.length,
        dedupedUsers: deduped.uniqueCount,
        duplicateUsers: deduped.duplicateCount,
        sourceDeviceId: schoolDevice?.id || null,
      });
      const summary = formatImportRunMetrics(
        buildImportRunMetrics({
          total: deduped.totalRaw,
          duplicates: deduped.duplicateCount,
          success: deduped.uniqueCount,
          failed: 0,
          synced: 0,
          faceCandidates: deduped.normalized.filter((item) => item.hasFace).length,
          faceSuccess: 0,
          faceFailed: 0,
        }),
      );
      addToast(`Import preview tayyor (${summary})`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import wizard ochishda xato';
      addToast(message, 'error');
    }
  };

  const processImportRows = async (targetIndexes?: number[], retryOnly = false) => {
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

    const queue =
      targetIndexes && targetIndexes.length > 0
        ? targetIndexes
        : importRows.map((_, idx) => idx);
    const validation = validateImportRows();
    setImportRows(validation.rows);
    const invalidInQueue = queue.some((idx) => Boolean(validation.rows[idx]?.error));
    if ((!retryOnly && !validation.ok) || invalidInQueue) {
      addToast(`Validation xatolari: ${validation.errors}`, 'error');
      return;
    }

    if (retryOnly && importJob?.id) {
      await retryImportJob(auth.schoolId, importJob.id).catch(() => undefined);
    }

    const commitRows = queue
      .map((idx) => validation.rows[idx])
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
    const faceCandidates = queue.filter((idx) => Boolean(validation.rows[idx]?.hasFace)).length;
    const duplicateCount = importPreview?.duplicateCount || 0;
    const targetDeviceIds = resolveImportTargetDeviceIds();
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

          let faceImageBase64: string | undefined;
          let faceError: string | undefined;
          if (importPullFace && row.hasFace && localDevice?.id) {
            try {
              const face = await getUserFace(localDevice.id, row.employeeNo);
              faceImageBase64 = face.imageBase64;
            } catch (err) {
              faceError = err instanceof Error ? err.message : 'Face sync xato';
            }
          }
          if (faceError) {
            throw new Error(`Face sync xato: ${faceError}`);
          }
          if (faceImageBase64) {
            await updateStudentProfile(student.id, {
              firstName: row.firstName,
              lastName: row.lastName,
              fatherName: row.fatherName || undefined,
              classId: row.classId,
              parentPhone: row.parentPhone || undefined,
              gender: row.gender,
              deviceStudentId: row.employeeNo,
              faceImageBase64,
            });
            faceSuccess += 1;
          }

          const confirmed = await fetchStudentByDeviceStudentId(auth.schoolId, row.employeeNo).catch(() => null);
          const resolvedStudentId = confirmed?.id || student.id;

          let syncResults: ImportRow['syncResults'] = [];
          if (targetDeviceIds.length > 0) {
            const syncResult = await syncStudentToDevices(resolvedStudentId, targetDeviceIds);
            syncResults = syncResult.perDeviceResults.map((item) => ({
              backendDeviceId: item.backendDeviceId,
              deviceName: item.deviceName,
              status: item.status,
              lastError: item.lastError,
            }));
            const hasSyncFailure =
              !syncResult.ok ||
              syncResults.some((item) => item.status.toUpperCase() !== 'SUCCESS');
            if (hasSyncFailure) {
              throw new Error(
                syncResults
                  .filter((item) => item.status.toUpperCase() !== 'SUCCESS')
                  .map((item) => `${item.deviceName || item.backendDeviceId}: ${item.lastError || item.status}`)
                  .join('; ') || 'Qurilmaga sync xato',
              );
            }
            synced += 1;
          }

          nextRows[i] = {
            ...row,
            studentId: resolvedStudentId,
            faceSynced: Boolean(faceImageBase64),
            syncResults,
            faceError: undefined,
            status: 'saved',
            error: undefined,
          };
          success += 1;
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
  };

  const saveImportRows = async () => processImportRows();

  const retryFailedImportRows = async () => {
    const failedIndexes = importRows
      .map((row, idx) => ({ row, idx }))
      .filter(({ row }) => row.status === 'error')
      .map(({ idx }) => idx);
    if (failedIndexes.length === 0) {
      addToast("Retry uchun xato qatorlar yo'q", 'error');
      return;
    }
    await processImportRows(failedIndexes, true);
  };

  return {
    isImportOpen,
    setIsImportOpen,
    importRows,
    importLoading,
    availableClasses,
    importSyncMode,
    setImportSyncMode,
    importSelectedDeviceIds,
    toggleImportSelectedDevice,
    importPullFace,
    setImportPullFace,
    importJob,
    importAuditTrail,
    importPreview,
    importMetrics,
    previewStats,
    openImportWizard,
    updateImportRow,
    getImportDeviceStatus,
    refreshImportPreview,
    processImportRows,
    saveImportRows,
    retryFailedImportRows,
  };
}

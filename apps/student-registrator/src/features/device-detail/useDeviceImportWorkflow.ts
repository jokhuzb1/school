import { useMemo, useRef, useState } from 'react';
import {
  createImportAuditLog,
  getAuthUser,
  getImportMetrics,
  previewDeviceImport,
  type ClassInfo,
  type SchoolDeviceInfo,
} from '../../api';
import { deriveBackendPresenceStatus } from '../../utils/deviceStatus';
import type { ImportJob, ImportPreview, ImportRow } from './types';
import { calcPreviewStats } from './useDeviceImportWorkflow.helpers';
import { openImportWizardAction } from './useDeviceImportWorkflow.open';
import { processImportRowsAction } from './useDeviceImportWorkflow.process';
import type {
  ImportAuditItem,
  ImportMetrics,
  SyncMode,
  UseDeviceImportWorkflowParams,
  UseDeviceImportWorkflowResult,
} from './useDeviceImportWorkflow.types';

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
  const [importAuditTrail, setImportAuditTrail] = useState<ImportAuditItem[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMetrics, setImportMetrics] = useState<ImportMetrics | null>(null);
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

  const getImportDeviceStatus = (device: SchoolDeviceInfo): 'online' | 'offline' | 'no_credentials' => {
    const local = findLocalForBackend(device, allLocalDevices);
    const derived = deriveBackendPresenceStatus(device, local);
    return derived === 'unknown' ? 'offline' : derived;
  };

  const previewStats = useMemo(() => calcPreviewStats(importRows), [importRows]);

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
    } catch (error: unknown) {
      void error;
      // best-effort audit
    }
  };

  const loadImportMetrics = async () => {
    const auth = getAuthUser();
    if (!auth?.schoolId) return;
    try {
      const metrics = await getImportMetrics(auth.schoolId);
      setImportMetrics(metrics);
    } catch (error: unknown) {
      void error;
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
    } catch (error: unknown) {
      void error;
      setImportPreview(null);
    }
  };

  const openImportWizard = async () =>
    openImportWizardAction({
      users,
      schoolDevice,
      localDevice,
      setAvailableClasses,
      setImportRows,
      setImportSyncModeState,
      setImportSelectedDeviceIds,
      setImportPullFaceState,
      setImportJob,
      setImportAuditTrail,
      setImportPreview,
      setIsImportOpen,
      refreshImportPreview,
      loadImportMetrics,
      pushImportAudit,
      addToast,
    });

  const processImportRows = async (targetIndexes?: number[], retryOnly = false) =>
    processImportRowsAction({
      targetIndexes,
      retryOnly,
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
    });

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

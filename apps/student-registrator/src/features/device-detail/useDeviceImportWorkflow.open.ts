import { fetchClasses, getAuthUser, type DeviceConfig, type SchoolDeviceInfo, type UserInfoEntry } from '../../api';
import { buildImportRunMetrics, formatImportRunMetrics, normalizeAndDedupeDeviceImportCandidates } from '../device-import/deviceImportShared';
import type { ImportRow } from './types';

export async function openImportWizardAction(params: {
  users: UserInfoEntry[];
  schoolDevice: SchoolDeviceInfo | null;
  localDevice: DeviceConfig | null;
  setAvailableClasses: (classes: import('../../api').ClassInfo[]) => void;
  setImportRows: (rows: ImportRow[]) => void;
  setImportSyncModeState: (mode: import('./useDeviceImportWorkflow.types').SyncMode) => void;
  setImportSelectedDeviceIds: (ids: string[]) => void;
  setImportPullFaceState: (next: boolean) => void;
  setImportJob: (job: import('./types').ImportJob | null) => void;
  setImportAuditTrail: (rows: Array<{ at: string; stage: string; message: string }>) => void;
  setImportPreview: (preview: import('./types').ImportPreview | null) => void;
  setIsImportOpen: (next: boolean) => void;
  refreshImportPreview: (rowsOverride?: ImportRow[]) => Promise<void>;
  loadImportMetrics: () => Promise<void>;
  pushImportAudit: (stage: string, message: string, payload?: Record<string, unknown>) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}): Promise<void> {
  const {
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
  } = params;

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

    const nextRows = deduped.normalized.map(
      (item) =>
        ({
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
        }) as ImportRow,
    );

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
}

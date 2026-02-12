import type React from 'react';
import {
  createClass,
  fetchClasses,
  fetchDevices,
  fetchSchoolDevices,
  fetchSchools,
  getAuthUser,
  testDeviceConnection,
  type ClassInfo,
  type DeviceConfig,
  type SchoolDeviceInfo,
} from '../../api';
import { isDeviceCredentialsExpired, resolveLocalDeviceForBackend } from '../../utils/deviceResolver';
import { appLogger } from '../../utils/logger';
import { downloadStudentsTemplate } from '../../services/excel.service';
import type { DeviceSelectionStatus } from '../../utils/deviceStatus';
import type { StudentRow } from '../../types';

export async function refreshDeviceStatusesAction(params: {
  backendList: SchoolDeviceInfo[];
  localList?: DeviceConfig[];
  setDeviceStatus: (status: Record<string, DeviceSelectionStatus>) => void;
  setDeviceStatusLoading: (next: boolean) => void;
  setCredentials: (list: DeviceConfig[]) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}): Promise<void> {
  const { backendList, localList, setDeviceStatus, setDeviceStatusLoading, setCredentials, addToast } = params;
  if (backendList.length === 0) {
    setDeviceStatus({});
    return;
  }

  setDeviceStatusLoading(true);
  try {
    const local = localList ?? (await fetchDevices());
    if (!localList) setCredentials(local);

    const results = await Promise.all(
      backendList.map(async (device) => {
        const resolved = resolveLocalDeviceForBackend(device, local);
        const localDevice = resolved.localDevice;
        if (!localDevice || isDeviceCredentialsExpired(localDevice)) {
          return { backendId: device.id, status: 'no_credentials' as DeviceSelectionStatus };
        }
        try {
          const result = await testDeviceConnection(localDevice.id);
          return {
            backendId: device.id,
            status: (result.ok ? 'online' : 'offline') as DeviceSelectionStatus,
          };
        } catch (error: unknown) {
          void error;
          return { backendId: device.id, status: 'offline' as DeviceSelectionStatus };
        }
      }),
    );

    const nextStatus: Record<string, DeviceSelectionStatus> = {};
    results.forEach((item) => {
      nextStatus[item.backendId] = item.status;
    });
    setDeviceStatus(nextStatus);
  } catch (err: unknown) {
    appLogger.error('Failed to refresh device status', err);
    addToast('Qurilma holatini tekshirishda xato', 'error');
  } finally {
    setDeviceStatusLoading(false);
  }
}

export async function createClassAndAppendAction(params: {
  className: string;
  gradeLevel: number;
  schoolId: string;
  setAvailableClasses: (updater: (prev: ClassInfo[]) => ClassInfo[]) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}): Promise<ClassInfo | null> {
  const { className, gradeLevel, schoolId, setAvailableClasses, addToast } = params;

  const normalizedClassName = className.trim().toUpperCase();
  const normalizedGradeLevel = Number(gradeLevel);
  if (!normalizedClassName) {
    addToast('Sinf nomi majburiy', 'error');
    return null;
  }
  if (!Number.isFinite(normalizedGradeLevel) || normalizedGradeLevel < 1 || normalizedGradeLevel > 11) {
    addToast("Sinf darajasi 1 dan 11 gacha bo'lishi kerak", 'error');
    return null;
  }

  try {
    const created = await createClass(schoolId, normalizedClassName, normalizedGradeLevel);
    setAvailableClasses((prev) => {
      const next = [...prev, created];
      return next.sort((a, b) => {
        if (a.gradeLevel !== b.gradeLevel) return a.gradeLevel - b.gradeLevel;
        return a.name.localeCompare(b.name);
      });
    });
    addToast(`Sinf yaratildi: ${created.name}`, 'success');
    return created;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sinf yaratishda xato';
    addToast(message, 'error');
    return null;
  }
}

export async function handleTemplateDownloadAction(params: {
  classNames: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}): Promise<void> {
  const { classNames, addToast } = params;
  try {
    await downloadStudentsTemplate(classNames);
    addToast('Shablon yuklandi', 'success');
  } catch (err: unknown) {
    appLogger.error('Template download failed', err);
    addToast('Shablon yuklashda xato', 'error');
  }
}

export async function handleExcelImportAction(params: {
  availableClasses: ClassInfo[];
  parseExcel: (file: File, classes: ClassInfo[]) => Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]>;
  resizeImages: (
    rows: Omit<StudentRow, 'id' | 'source' | 'status'>[],
  ) => Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]>;
  importStudents: (
    rows: Omit<StudentRow, 'id' | 'source' | 'status'>[],
  ) => StudentRow[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setLoading: (next: boolean) => void;
  file: File;
}): Promise<void> {
  const { availableClasses, parseExcel, resizeImages, importStudents, addToast, setLoading, file } = params;
  appLogger.debug('[Excel Import] Starting with availableClasses:', availableClasses);
  if (availableClasses.length === 0) {
    addToast('Sinflar yuklanmagan! Sahifani yangilang.', 'error');
    return;
  }

  setLoading(true);
  try {
    const rows = await parseExcel(file, availableClasses);
    const resized = await resizeImages(rows);
    const withoutClass = resized.filter((r) => !r.classId);
    if (withoutClass.length > 0) {
      const missingNames = withoutClass.map((r) => `${r.lastName || ''} ${r.firstName || ''}`.trim());
      appLogger.warn('[Excel Import] Rows without classId:', missingNames);
      addToast(`${withoutClass.length} ta o'quvchining sinfi topilmadi!`, 'error');
    }
    importStudents(resized);
    addToast(`${resized.length} ta o'quvchi yuklandi`, 'success');
  } catch (err: unknown) {
    appLogger.error('Excel import failed', err);
    addToast('Excel yuklashda xato', 'error');
  } finally {
    setLoading(false);
  }
}

export async function handleSaveStudentAction(params: {
  id: string;
  selectedDeviceIds: string[];
  saveStudent: (id: string, targetDeviceIds?: string[]) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}): Promise<void> {
  const { id, selectedDeviceIds, saveStudent, addToast } = params;
  try {
    await saveStudent(id, selectedDeviceIds);
    addToast("O'quvchi saqlandi", 'success');
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Saqlashda xato';
    addToast(errorMsg, 'error');
  }
}

export async function handleConfirmSaveAllAction(params: {
  students: StudentRow[];
  saveAllPending: (targetDeviceIds?: string[]) => Promise<{
    successCount: number;
    errorCount: number;
    errorReasons: Record<string, number>;
  }>;
  selectedDeviceIds: string[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setIsTargetSaveModalOpen: (next: boolean) => void;
}): Promise<void> {
  const { students, saveAllPending, selectedDeviceIds, addToast, setIsTargetSaveModalOpen } = params;
  const pendingCount = students.filter((s) => s.status === 'pending').length;
  if (pendingCount === 0) {
    addToast("Saqlanishi kerak bo'lgan o'quvchilar yo'q", 'error');
    return;
  }

  try {
    const { successCount, errorCount, errorReasons } = await saveAllPending(selectedDeviceIds);
    if (errorCount > 0) {
      const firstReason = Object.entries(errorReasons).sort((a, b) => b[1] - a[1])[0]?.[0];
      addToast(
        firstReason
          ? `${errorCount} ta xato, ${successCount} ta saqlandi. Asosiy sabab: ${firstReason}`
          : `${errorCount} ta xato, ${successCount} ta saqlandi`,
        'error',
      );
      return;
    }
    addToast(`${successCount} ta o'quvchi saqlandi`, 'success');
    setIsTargetSaveModalOpen(false);
  } catch (error: unknown) {
    appLogger.warn('Failed to save all pending students', error);
    addToast("Ba'zi o'quvchilarni saqlashda xato", 'error');
  }
}

export async function loadAddStudentsDataAction(params: {
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setAvailableClasses: (classes: ClassInfo[]) => void;
  setBackendDevices: (devices: SchoolDeviceInfo[]) => void;
  setCredentials: (devices: DeviceConfig[]) => void;
  refreshDeviceStatuses: (backendList: SchoolDeviceInfo[], localList?: DeviceConfig[]) => Promise<void>;
}): Promise<void> {
  const { addToast, setAvailableClasses, setBackendDevices, setCredentials, refreshDeviceStatuses } = params;
  const user = getAuthUser();
  if (!user) return;

  try {
    let schoolId = user.schoolId;
    if (!schoolId) {
      const schools = await fetchSchools();
      schoolId = schools[0]?.id;
    }

    if (!schoolId) return;
    const [classes, devices, local] = await Promise.all([
      fetchClasses(schoolId),
      fetchSchoolDevices(schoolId),
      fetchDevices(),
    ]);
    appLogger.debug('[AddStudents] Loaded classes from backend:', classes);
    setAvailableClasses(classes);
    setBackendDevices(devices);
    setCredentials(local);
    await refreshDeviceStatuses(devices, local);
  } catch (err: unknown) {
    appLogger.error('Failed to load AddStudents data', err);
    const message = err instanceof Error ? err.message : "Ma'lumotlarni yuklashda xato";
    addToast(message, 'error');
  }
}

export async function handleCreateClassAction(params: {
  e: React.FormEvent;
  newClassName: string;
  newClassGrade: number;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setAvailableClasses: (updater: (prev: ClassInfo[]) => ClassInfo[]) => void;
  setIsClassModalOpen: (next: boolean) => void;
  setNewClassName: (next: string) => void;
  setNewClassGrade: (next: number) => void;
  setIsCreatingClass: (next: boolean) => void;
}): Promise<void> {
  const {
    e,
    newClassName,
    newClassGrade,
    addToast,
    setAvailableClasses,
    setIsClassModalOpen,
    setNewClassName,
    setNewClassGrade,
    setIsCreatingClass,
  } = params;

  e.preventDefault();
  setIsCreatingClass(true);
  try {
    const user = getAuthUser();
    const schoolId = user?.schoolId;
    if (!schoolId) {
      addToast('Maktab aniqlanmadi. Qayta login qiling.', 'error');
      return;
    }
    const created = await createClassAndAppendAction({
      className: newClassName,
      gradeLevel: newClassGrade,
      schoolId,
      setAvailableClasses,
      addToast,
    });
    if (!created) return;
    setIsClassModalOpen(false);
    setNewClassName('');
    setNewClassGrade(1);
  } finally {
    setIsCreatingClass(false);
  }
}

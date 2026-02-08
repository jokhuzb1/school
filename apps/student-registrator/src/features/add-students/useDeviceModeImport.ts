import { useCallback, useState } from 'react';
import { fetchUsers, getUserFace } from '../../api';
import type { DeviceConfig, SchoolDeviceInfo, StudentRow } from '../../types';
import {
  isDeviceCredentialsExpired,
  resolveLocalDeviceByBackendId,
} from '../../utils/deviceResolver';
import {
  buildDeviceErrorMessage,
  mapDeviceResolutionReasonToCode,
} from '../../utils/deviceErrorCodes';
import {
  buildImportRunMetrics,
  formatImportRunMetrics,
  normalizeAndDedupeDeviceImportCandidates,
  type RawDeviceImportCandidate,
} from '../device-import/deviceImportShared';

type UseDeviceModeImportParams = {
  backendDevices: SchoolDeviceInfo[];
  credentials: DeviceConfig[];
  selectedDeviceIds: string[];
  students: StudentRow[];
  importStudents: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => StudentRow[];
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

type UseDeviceModeImportReturn = {
  isDeviceImporting: boolean;
  isSourceImportModalOpen: boolean;
  sourceImportDeviceIds: string[];
  refreshingFaceIds: string[];
  openDeviceModeImportModal: () => void;
  closeSourceImportModal: () => void;
  toggleSourceImportDevice: (deviceId: string) => void;
  confirmDeviceModeImport: () => Promise<void>;
  refreshFaceForStudent: (studentId: string) => Promise<boolean>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useDeviceModeImport({
  backendDevices,
  credentials,
  selectedDeviceIds,
  students,
  importStudents,
  updateStudent,
  addToast,
}: UseDeviceModeImportParams): UseDeviceModeImportReturn {
  const [isDeviceImporting, setIsDeviceImporting] = useState(false);
  const [sourceImportDeviceId, setSourceImportDeviceId] = useState('');
  const [sourceImportDeviceIds, setSourceImportDeviceIds] = useState<string[]>([]);
  const [isSourceImportModalOpen, setIsSourceImportModalOpen] = useState(false);
  const [refreshingFaceIds, setRefreshingFaceIds] = useState<string[]>([]);

  const getFaceWithRetry = useCallback(
    async (localDeviceId: string, employeeNo: string, attempts = 3): Promise<string | undefined> => {
      for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
          const face = await getUserFace(localDeviceId, employeeNo);
          return face.imageBase64 || undefined;
        } catch {
          if (attempt < attempts) {
            await sleep(250 * attempt);
          }
        }
      }
      return undefined;
    },
    [],
  );

  const resolveLocalDevice = useCallback(
    (backendId?: string | null) =>
      resolveLocalDeviceByBackendId(backendId, backendDevices, credentials),
    [backendDevices, credentials],
  );

  const refreshFaceForStudent = useCallback(
    async (studentId: string): Promise<boolean> => {
      const row = students.find((item) => item.id === studentId);
      if (!row?.deviceStudentId) {
        addToast('Bu qator uchun device student ID topilmadi', 'error');
        return false;
      }

      const resolved = resolveLocalDevice(
        row.sourceDeviceBackendId || sourceImportDeviceId || selectedDeviceIds[0],
      );
      if (!resolved.localDevice?.id) {
        addToast(
          buildDeviceErrorMessage({
            code: mapDeviceResolutionReasonToCode(resolved.reason),
            deviceName: resolved.backendDevice?.name,
          }),
          'error',
        );
        return false;
      }

      if (isDeviceCredentialsExpired(resolved.localDevice)) {
        addToast(
          buildDeviceErrorMessage({
            code: 'CREDENTIALS_EXPIRED',
            deviceName: resolved.backendDevice?.name,
          }),
          'error',
        );
        return false;
      }

      setRefreshingFaceIds((prev) => (prev.includes(studentId) ? prev : [...prev, studentId]));
      try {
        const imageBase64 = await getFaceWithRetry(resolved.localDevice.id, row.deviceStudentId, 3);
        if (!imageBase64) throw new Error("Qurilmadan rasmni olib bo'lmadi");
        updateStudent(studentId, { imageBase64 });
        addToast('Rasm yangilandi', 'success');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Rasmni yangilashda xato';
        addToast(message, 'error');
        return false;
      } finally {
        setRefreshingFaceIds((prev) => prev.filter((id) => id !== studentId));
      }
    },
    [
      addToast,
      getFaceWithRetry,
      resolveLocalDevice,
      selectedDeviceIds,
      sourceImportDeviceId,
      students,
      updateStudent,
    ],
  );

  const openDeviceModeImportModal = useCallback(() => {
    if (backendDevices.length === 0) {
      addToast('Device mode import uchun qurilma tanlanmagan', 'error');
      return;
    }

    const defaults =
      sourceImportDeviceIds.length > 0
        ? sourceImportDeviceIds
        : selectedDeviceIds.length > 0
          ? selectedDeviceIds
          : [backendDevices[0].id];

    setSourceImportDeviceIds(defaults);
    setIsSourceImportModalOpen(true);
  }, [addToast, backendDevices, selectedDeviceIds, sourceImportDeviceIds]);

  const closeSourceImportModal = useCallback(() => {
    if (!isDeviceImporting) {
      setIsSourceImportModalOpen(false);
    }
  }, [isDeviceImporting]);

  const toggleSourceImportDevice = useCallback((deviceId: string) => {
    setSourceImportDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId],
    );
  }, []);

  const collectUsersFromSource = useCallback(
    async (backendId: string): Promise<{ rows: RawDeviceImportCandidate[]; errors: string[] }> => {
      const resolved = resolveLocalDevice(backendId);
      const errors: string[] = [];
      if (!resolved.localDevice?.id) {
        errors.push(
          buildDeviceErrorMessage({
            code: mapDeviceResolutionReasonToCode(resolved.reason),
            deviceName: resolved.backendDevice?.name || backendId,
          }),
        );
        return { rows: [], errors };
      }
      if (isDeviceCredentialsExpired(resolved.localDevice)) {
        errors.push(
          buildDeviceErrorMessage({
            code: 'CREDENTIALS_EXPIRED',
            deviceName: resolved.backendDevice?.name || backendId,
          }),
        );
        return { rows: [], errors };
      }

      const collected: RawDeviceImportCandidate[] = [];
      let offset = 0;
      const limit = 100;
      for (;;) {
        const result = await fetchUsers(resolved.localDevice.id, { offset, limit });
        const list = result.UserInfoSearch?.UserInfo || [];
        const total = result.UserInfoSearch?.totalMatches || 0;
        if (list.length === 0) break;

        collected.push(
          ...list.map((item) => ({
            employeeNo: item.employeeNo || '',
            name: item.name || '',
            gender: item.gender,
            numOfFace: item.numOfFace,
            sourceBackendId: backendId,
          })),
        );

        offset += list.length;
        if (offset >= total) break;
      }

      return { rows: collected, errors };
    },
    [resolveLocalDevice],
  );

  const confirmDeviceModeImport = useCallback(async () => {
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
  }, [
    addToast,
    collectUsersFromSource,
    getFaceWithRetry,
    importStudents,
    resolveLocalDevice,
    sourceImportDeviceIds,
    updateStudent,
  ]);

  return {
    isDeviceImporting,
    isSourceImportModalOpen,
    sourceImportDeviceIds,
    refreshingFaceIds,
    openDeviceModeImportModal,
    closeSourceImportModal,
    toggleSourceImportDevice,
    confirmDeviceModeImport,
    refreshFaceForStudent,
  };
}

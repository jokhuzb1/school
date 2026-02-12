import { useCallback, useState } from 'react';
import { fetchUsers } from '../../api';
import { isDeviceCredentialsExpired, resolveLocalDeviceByBackendId } from '../../utils/deviceResolver';
import { buildDeviceErrorMessage, mapDeviceResolutionReasonToCode } from '../../utils/deviceErrorCodes';
import {
  type RawDeviceImportCandidate,
} from '../device-import/deviceImportShared';
import { confirmDeviceModeImportAction } from './useDeviceModeImport.confirm';
import { getFaceWithRetry } from './useDeviceModeImport.helpers';
import type { UseDeviceModeImportParams, UseDeviceModeImportReturn } from './useDeviceModeImport.types';
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

  const confirmDeviceModeImport = useCallback(
    async () =>
      confirmDeviceModeImportAction({
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
      }),
    [addToast, collectUsersFromSource, importStudents, resolveLocalDevice, sourceImportDeviceIds, updateStudent],
  );

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

import { useState } from 'react';
import {
  cloneDeviceToDevice,
  cloneStudentsToDevice,
  deleteUser,
  recreateUser,
  testDeviceConnection,
  updateDeviceConfiguration,
  type DeviceConfig,
  type SchoolDeviceInfo,
  type UserInfoEntry,
} from '../../api';

type UseDeviceDetailActionsParams = {
  localDevice: DeviceConfig | null;
  schoolDevice: SchoolDeviceInfo | null;
  allSchoolDevices: SchoolDeviceInfo[];
  allLocalDevices: DeviceConfig[];
  findLocalForBackend: (backend: SchoolDeviceInfo, localDevices: DeviceConfig[]) => DeviceConfig | null;
  loadUsers: (reset?: boolean) => Promise<void>;
  loadDetail: () => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

export function useDeviceDetailActions({
  localDevice,
  schoolDevice,
  allSchoolDevices,
  allLocalDevices,
  findLocalForBackend,
  loadUsers,
  loadDetail,
  addToast,
}: UseDeviceDetailActionsParams) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pendingDeleteEmployeeNo, setPendingDeleteEmployeeNo] = useState<string | null>(null);
  const [sourceCloneId, setSourceCloneId] = useState<string>('');

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestConnection = async () => {
    if (!localDevice?.id) {
      addToast('Local ulanish sozlamasi topilmadi', 'error');
      return;
    }
    await withBusy('test-connection', async () => {
      const result = await testDeviceConnection(localDevice.id);
      if (result.ok) {
        addToast('Ulanish muvaffaqiyatli', 'success');
        await loadDetail();
      } else {
        addToast(result.message || 'Ulanish muvaffaqiyatsiz', 'error');
      }
    });
  };

  const handleDeleteUser = async (employeeNo: string) => {
    setPendingDeleteEmployeeNo(employeeNo);
  };

  const confirmDeleteUser = async () => {
    if (!localDevice?.id || !pendingDeleteEmployeeNo) return;
    const employeeNo = pendingDeleteEmployeeNo;
    setPendingDeleteEmployeeNo(null);
    await withBusy(`delete-${employeeNo}`, async () => {
      try {
        await deleteUser(localDevice.id, employeeNo);
        addToast("Foydalanuvchi o'chirildi", 'success');
        await loadUsers(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Delete failed';
        const lower = raw.toLowerCase();
        if (lower.includes('not found')) {
          addToast('Foydalanuvchi topilmadi', 'error');
        } else {
          addToast(raw || "Foydalanuvchini o'chirishda xato", 'error');
        }
      }
    });
  };

  const handleRecreateUser = async (user: UserInfoEntry) => {
    if (!localDevice?.id) return;
    await withBusy(`recreate-${user.employeeNo}`, async () => {
      try {
        const result = await recreateUser(
          localDevice.id,
          user.employeeNo,
          user.name,
          (user.gender || 'male').toLowerCase(),
          false,
          true,
        );
        if (result.faceUpload?.ok) {
          addToast(`User recreate qilindi: ${result.employeeNo}`, 'success');
        } else {
          const lower = (result.faceUpload?.errorMsg || '').toLowerCase();
          if (lower.includes('duplicate') || lower.includes('exist')) {
            addToast('Foydalanuvchi allaqachon mavjud', 'error');
          } else {
            addToast(result.faceUpload?.errorMsg || 'Recreate qisman bajarildi', 'error');
          }
        }
        await loadUsers(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Recreate failed';
        const lower = raw.toLowerCase();
        if (lower.includes('not found')) {
          addToast('Foydalanuvchi topilmadi', 'error');
        } else if (lower.includes('upload')) {
          addToast('Face uploadda xato', 'error');
        } else {
          addToast(raw || 'Recreate jarayonida xato', 'error');
        }
      }
    });
  };

  const saveConfig = async (key: 'time' | 'ntpServers' | 'networkInterfaces', text: string) => {
    if (!localDevice?.id) return;
    await withBusy(`save-config-${key}`, async () => {
      try {
        const payload = JSON.parse(text);
        await updateDeviceConfiguration({
          deviceId: localDevice.id,
          configType: key,
          payload,
        });
        addToast(`${key} sozlamasi saqlandi`, 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Config save xato';
        addToast(message, 'error');
      }
    });
  };

  const handleCloneDbToDevice = async () => {
    if (!schoolDevice?.id) return;
    await withBusy('clone-db-device', async () => {
      const result = await cloneStudentsToDevice({ backendDeviceId: schoolDevice.id });
      addToast(
        `Clone yakunlandi: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`,
        result.failed > 0 ? 'error' : 'success',
      );
    });
  };

  const handleCloneDeviceToDevice = async () => {
    if (!sourceCloneId || !localDevice?.id) {
      addToast('Manba qurilmani tanlang', 'error');
      return;
    }
    const sourceBackend = allSchoolDevices.find((d) => d.id === sourceCloneId);
    if (!sourceBackend) {
      addToast('Manba qurilma topilmadi', 'error');
      return;
    }
    const sourceLocal = findLocalForBackend(sourceBackend, allLocalDevices);
    if (!sourceLocal?.id) {
      addToast('Manba qurilmaning local ulanish sozlamasi topilmadi', 'error');
      return;
    }
    await withBusy('clone-device-device', async () => {
      const result = await cloneDeviceToDevice({
        sourceDeviceId: sourceLocal.id,
        targetDeviceId: localDevice.id,
      });
      addToast(
        `Clone yakunlandi: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`,
        result.failed > 0 ? 'error' : 'success',
      );
    });
  };

  return {
    busyAction,
    pendingDeleteEmployeeNo,
    setPendingDeleteEmployeeNo,
    sourceCloneId,
    setSourceCloneId,
    withBusy,
    handleTestConnection,
    handleDeleteUser,
    confirmDeleteUser,
    handleRecreateUser,
    saveConfig,
    handleCloneDbToDevice,
    handleCloneDeviceToDevice,
  };
}

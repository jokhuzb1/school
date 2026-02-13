import {
  cloneDeviceToDevice,
  cloneStudentsToDevice,
  deleteDevice,
  deleteSchoolDevice,
  testDeviceConnection,
  updateSchoolDevice,
} from '../../api';
import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import { appLogger } from '../../utils/logger';
import type { AddToast, CloneStatus, DeviceCloneStatus } from './types';

type TestConnectionParams = {
  device: SchoolDeviceInfo;
  getCredentialsForBackend: (device: SchoolDeviceInfo) => DeviceConfig | undefined;
  isCredentialsExpired: (device?: DeviceConfig | null) => boolean;
  addToast: AddToast;
  setTestingId: (value: string | null) => void;
  setTestStatus: (updater: (prev: Record<string, 'ok' | 'fail'>) => Record<string, 'ok' | 'fail'>) => void;
  loadBackendDevices: () => Promise<void>;
  loadCredentials: () => Promise<void>;
};

export async function handleTestConnectionAction({
  device,
  getCredentialsForBackend,
  isCredentialsExpired,
  addToast,
  setTestingId,
  setTestStatus,
  loadBackendDevices,
  loadCredentials,
}: TestConnectionParams) {
  const local = getCredentialsForBackend(device);
  if (!local) {
    addToast('Ulanish sozlamalari topilmadi', 'error');
    return;
  }
  if (isCredentialsExpired(local)) {
    addToast('Ulanish sozlamalari muddati tugagan. Qayta kiriting.', 'error');
    return;
  }
  setTestingId(device.id);
  try {
    const result = await testDeviceConnection(local.id);
    const ok = result.ok;
    setTestStatus((prev) => ({ ...prev, [device.id]: ok ? 'ok' : 'fail' }));
    addToast(ok ? 'Ulanish muvaffaqiyatli' : 'Ulanish muvaffaqiyatsiz', ok ? 'success' : 'error');

    if (ok) {
      const updates: Partial<Pick<SchoolDeviceInfo, 'deviceId' | 'isActive' | 'lastSeenAt'>> = {
        isActive: true,
        lastSeenAt: new Date().toISOString(),
      };
      if (result.deviceId && result.deviceId !== device.deviceId) {
        updates.deviceId = result.deviceId;
      }
      try {
        await updateSchoolDevice(device.id, updates);
        await loadBackendDevices();
        await loadCredentials();
      } catch (err: unknown) {
        appLogger.warn('Backend sync after test failed', err);
      }
    }
  } catch (err) {
    setTestStatus((prev) => ({ ...prev, [device.id]: 'fail' }));
    const message = err instanceof Error ? err.message : String(err);
    addToast(message || 'Ulanishni tekshirishda xato', 'error');
  } finally {
    setTestingId(null);
  }
}

type DeleteDeviceParams = {
  pendingDelete: SchoolDeviceInfo | null;
  getCredentialsForBackend: (device: SchoolDeviceInfo) => DeviceConfig | undefined;
  loadBackendDevices: () => Promise<void>;
  loadCredentials: () => Promise<void>;
  addToast: AddToast;
  setLoading: (value: boolean) => void;
  setPendingDelete: (value: SchoolDeviceInfo | null) => void;
};

export async function handleDeleteDeviceAction({
  pendingDelete,
  getCredentialsForBackend,
  loadBackendDevices,
  loadCredentials,
  addToast,
  setLoading,
  setPendingDelete,
}: DeleteDeviceParams) {
  if (!pendingDelete) return;
  setLoading(true);
  try {
    const local = getCredentialsForBackend(pendingDelete);
    if (local) {
      await deleteDevice(local.id);
    }
    await deleteSchoolDevice(pendingDelete.id);
    await Promise.all([loadBackendDevices(), loadCredentials()]);
    addToast("Qurilma o'chirildi", 'success');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Qurilmani o\'chirishda xato';
    addToast(message, 'error');
  } finally {
    setLoading(false);
    setPendingDelete(null);
  }
}

type StartCloneParams = {
  pendingClone: SchoolDeviceInfo | null;
  setCloneStatus: (value: CloneStatus | null | ((prev: CloneStatus | null) => CloneStatus | null)) => void;
  addToast: AddToast;
};

export async function handleStartCloneAction({
  pendingClone,
  setCloneStatus,
  addToast,
}: StartCloneParams) {
  if (!pendingClone) return;
  setCloneStatus({ running: true, processed: 0, success: 0, failed: 0, skipped: 0, errors: [] });
  try {
    const result = await cloneStudentsToDevice({
      backendDeviceId: pendingClone.id,
    });
    setCloneStatus({
      running: false,
      processed: result.processed,
      success: result.success,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors || [],
    });
    addToast(
      `Clone yakunlandi: ${result.success} muvaffaqiyatli, ${result.failed} xato, ${result.skipped} o'tkazildi.`,
      result.failed > 0 ? 'error' : 'success',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clone jarayonida xato';
    setCloneStatus((prev) => (prev ? { ...prev, running: false } : null));
    addToast(message, 'error');
  }
}

type StartDeviceCloneParams = {
  pendingDeviceClone: SchoolDeviceInfo | null;
  sourceCloneId: string;
  backendDevices: SchoolDeviceInfo[];
  getCredentialsForBackend: (device: SchoolDeviceInfo) => DeviceConfig | undefined;
  setDeviceCloneStatus: (value: DeviceCloneStatus | null | ((prev: DeviceCloneStatus | null) => DeviceCloneStatus | null)) => void;
  addToast: AddToast;
};

export async function handleStartDeviceCloneAction({
  pendingDeviceClone,
  sourceCloneId,
  backendDevices,
  getCredentialsForBackend,
  setDeviceCloneStatus,
  addToast,
}: StartDeviceCloneParams) {
  if (!pendingDeviceClone || !sourceCloneId) return;
  const source = getCredentialsForBackend(
    backendDevices.find((d) => d.id === sourceCloneId) || ({} as SchoolDeviceInfo),
  );
  const target = getCredentialsForBackend(pendingDeviceClone);
  if (!source || !target) {
    addToast("Manba yoki maqsad qurilmaning local sozlamalari topilmadi", 'error');
    return;
  }
  setDeviceCloneStatus({ running: true, processed: 0, success: 0, failed: 0, skipped: 0, errors: [] });
  try {
    const result = await cloneDeviceToDevice({
      sourceDeviceId: source.id,
      targetDeviceId: target.id,
    });
    setDeviceCloneStatus({
      running: false,
      processed: result.processed,
      success: result.success,
      failed: result.failed,
      skipped: result.skipped,
      errors: result.errors || [],
    });
    addToast(
      `Clone yakunlandi: ${result.success} muvaffaqiyatli, ${result.failed} xato, ${result.skipped} o'tkazildi.`,
      result.failed > 0 ? 'error' : 'success',
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Clone jarayonida xato';
    setDeviceCloneStatus((prev) => (prev ? { ...prev, running: false } : null));
    addToast(message, 'error');
  }
}

import {
  fetchDevices,
  fetchSchoolDevices,
  getAuthUser,
  getWebhookInfo,
  updateDevice,
} from '../../api';
import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import type { WebhookInfo } from '../../api';
import { normalizeDeviceId } from '../../utils/deviceResolver';
import { appLogger } from '../../utils/logger';
import type { AddToast } from './types';

type LoadCredentialsParams = {
  setCredentials: (value: DeviceConfig[]) => void;
  addToast: AddToast;
};

export async function loadCredentialsAction({
  setCredentials,
  addToast,
}: LoadCredentialsParams) {
  try {
    const data = await fetchDevices();
    setCredentials(data);
  } catch (err: unknown) {
    appLogger.error('Failed to load local device credentials', err);
    addToast('Ulanish sozlamalarini yuklashda xato', 'error');
  }
}

type LoadWebhookInfoParams = {
  setWebhookLoading: (value: boolean) => void;
  setWebhookInfo: (value: WebhookInfo | null) => void;
  addToast: AddToast;
};

export async function loadWebhookInfoAction({
  setWebhookLoading,
  setWebhookInfo,
  addToast,
}: LoadWebhookInfoParams) {
  const user = getAuthUser();
  const schoolId = user?.schoolId;
  if (!schoolId) return;
  setWebhookLoading(true);
  try {
    const info = await getWebhookInfo(schoolId);
    setWebhookInfo(info);
  } catch (err: unknown) {
    appLogger.error('Failed to load webhook info', err);
    const message = err instanceof Error ? err.message : 'Webhook ma\'lumotlarini yuklashda xato';
    addToast(message, 'error');
  } finally {
    setWebhookLoading(false);
  }
}

type LoadBackendDevicesParams = {
  credentials: DeviceConfig[];
  setBackendLoading: (value: boolean) => void;
  setBackendDevices: (value: SchoolDeviceInfo[]) => void;
  loadCredentials: () => Promise<void>;
  addToast: AddToast;
};

export async function loadBackendDevicesAction({
  credentials,
  setBackendLoading,
  setBackendDevices,
  loadCredentials,
  addToast,
}: LoadBackendDevicesParams) {
  const user = getAuthUser();
  const schoolId = user?.schoolId;
  if (!schoolId) return;
  setBackendLoading(true);
  try {
    const localCredentials =
      credentials.length > 0 ? credentials : await fetchDevices().catch(() => []);
    const data = await fetchSchoolDevices(schoolId);
    setBackendDevices(data);
    if (localCredentials.length > 0) {
      const byDeviceId = new Map<string, DeviceConfig>();
      localCredentials.forEach((device) => {
        if (device.deviceId) {
          byDeviceId.set(normalizeDeviceId(device.deviceId), device);
        }
      });
      const toUpdate = data
        .map((backend) => {
          if (!backend.deviceId) return null;
          const match = byDeviceId.get(normalizeDeviceId(backend.deviceId));
          if (!match || match.backendId === backend.id) return null;
          return { backend, match };
        })
        .filter(Boolean) as Array<{ backend: SchoolDeviceInfo; match: DeviceConfig }>;

      if (toUpdate.length > 0) {
        await Promise.all(
          toUpdate.map(({ backend, match }) =>
            updateDevice(match.id, {
              backendId: backend.id,
              host: match.host,
              port: match.port,
              username: match.username,
              password: match.password,
              deviceId: match.deviceId,
            }),
          ),
        );
        await loadCredentials();
      }
    }
  } catch (err: unknown) {
    appLogger.error('Failed to load backend devices', err);
    const message = err instanceof Error ? err.message : 'Qurilmalarni yuklashda xato';
    addToast(message, 'error');
  } finally {
    setBackendLoading(false);
  }
}

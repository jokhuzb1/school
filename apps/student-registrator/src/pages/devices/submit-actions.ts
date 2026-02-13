import type React from 'react';
import {
  createDevice,
  createSchoolDevice,
  getAuthUser,
  probeDeviceConnection,
  testDeviceConnection,
  updateDevice,
  updateSchoolDevice,
} from '../../api';
import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import { appLogger } from '../../utils/logger';
import { DEFAULT_DEVICE_FORM_DATA, DEVICE_CREDENTIALS_LIMIT } from './constants';
import type { AddToast, DeviceFormData } from './types';

type SubmitDeviceFormParams = {
  event: React.FormEvent;
  isCredentialsModalOpen: boolean;
  isModalOpen: boolean;
  formData: DeviceFormData;
  editingBackendId: string | null;
  editingLocalId: string | null;
  backendDevices: SchoolDeviceInfo[];
  credentials: DeviceConfig[];
  getCredentialsForBackend: (device: SchoolDeviceInfo) => DeviceConfig | undefined;
  loadBackendDevices: () => Promise<void>;
  loadCredentials: () => Promise<void>;
  setFormData: (value: DeviceFormData) => void;
  setEditingBackendId: (value: string | null) => void;
  setEditingLocalId: (value: string | null) => void;
  setIsModalOpen: (value: boolean) => void;
  setIsCredentialsModalOpen: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  addToast: AddToast;
};

export async function submitDeviceFormAction({
  event,
  isCredentialsModalOpen,
  isModalOpen,
  formData,
  editingBackendId,
  editingLocalId,
  backendDevices,
  credentials,
  getCredentialsForBackend,
  loadBackendDevices,
  loadCredentials,
  setFormData,
  setEditingBackendId,
  setEditingLocalId,
  setIsModalOpen,
  setIsCredentialsModalOpen,
  setLoading,
  addToast,
}: SubmitDeviceFormParams) {
  event.preventDefault();
  setLoading(true);

  try {
    const isCredentialsOnlyMode = isCredentialsModalOpen && !isModalOpen;
    const trimmedName = formData.name.trim();
    const trimmedDeviceId = formData.deviceId.trim();
    const hostTrimmed = formData.host.trim();
    const usernameTrimmed = formData.username.trim();
    const passwordTrimmed = formData.password.trim();
    const credentialsProvided =
      hostTrimmed.length > 0 &&
      usernameTrimmed.length > 0 &&
      passwordTrimmed.length > 0;
    const anyCredentialField =
      hostTrimmed.length > 0 ||
      usernameTrimmed.length > 0 ||
      passwordTrimmed.length > 0;

    if (anyCredentialField && !credentialsProvided) {
      addToast('Ulanish uchun host, username va parolni to\'liq kiriting', 'error');
      return;
    }
    if (anyCredentialField && (!Number.isFinite(formData.port) || formData.port <= 0 || formData.port > 65535)) {
      addToast('Port 1-65535 oralig\'ida bo\'lishi kerak', 'error');
      return;
    }
    if (!isCredentialsOnlyMode && !trimmedName) {
      addToast('Qurilma nomi majburiy', 'error');
      return;
    }

    const user = getAuthUser();
    const schoolId = user?.schoolId;
    if (!schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }

    let backendDevice: SchoolDeviceInfo | null = null;
    if (isCredentialsOnlyMode) {
      backendDevice = backendDevices.find((item) => item.id === editingBackendId) || null;
      if (!backendDevice) {
        addToast('Qurilma topilmadi', 'error');
        return;
      }
    } else {
      if (editingBackendId) {
        backendDevice = await updateSchoolDevice(editingBackendId, {
          name: trimmedName,
          deviceId: trimmedDeviceId || undefined,
          type: formData.deviceType,
          location: formData.location.trim() || undefined,
        });
        addToast('Qurilma yangilandi', 'success');
      } else {
        let resolvedDeviceId = trimmedDeviceId;
        if (!resolvedDeviceId && credentialsProvided) {
          const probe = await probeDeviceConnection({
            host: hostTrimmed,
            port: formData.port,
            username: usernameTrimmed,
            password: passwordTrimmed,
          });
          if (!probe.ok) {
            addToast(probe.message || 'Qurilmaga ulanib bo\'lmadi', 'error');
            return;
          }
          if (!probe.deviceId) {
            addToast('Qurilmadan deviceId olinmadi, qo\'lda kiriting', 'error');
            return;
          }
          resolvedDeviceId = probe.deviceId.trim();
        }
        if (!resolvedDeviceId) {
          addToast('Device ID yoki ulanish ma\'lumotlarini kiriting', 'error');
          return;
        }
        backendDevice = await createSchoolDevice(schoolId, {
          name: trimmedName,
          deviceId: resolvedDeviceId,
          type: formData.deviceType,
          location: formData.location.trim() || undefined,
        });
        addToast('Qurilma qo\'shildi', 'success');
      }
      await loadBackendDevices();
    }
    const hostKey = hostTrimmed.toLowerCase();
    const usernameKey = usernameTrimmed.toLowerCase();

    const existingLocal =
      (editingLocalId ? credentials.find((item) => item.id === editingLocalId) : null) ||
      (backendDevice ? getCredentialsForBackend(backendDevice) : undefined) ||
      credentials.find((item) => {
        const sameBackend = backendDevice ? item.backendId === backendDevice.id : false;
        const unlinked = !item.backendId;
        const endpointMatch =
          hostKey.length > 0 &&
          usernameKey.length > 0 &&
          item.host.trim().toLowerCase() === hostKey &&
          item.port === formData.port &&
          item.username.trim().toLowerCase() === usernameKey;
        return (sameBackend || unlinked) && endpointMatch;
      });

    if (credentialsProvided && backendDevice) {
      let savedLocal: DeviceConfig | null = null;
      if (!existingLocal && credentials.length >= DEVICE_CREDENTIALS_LIMIT) {
        addToast(`Ulanish sozlamalari limiti (${DEVICE_CREDENTIALS_LIMIT} ta) to'ldi`, 'error');
      } else {
        const payload: Omit<DeviceConfig, 'id'> = {
          backendId: backendDevice.id,
          host: hostTrimmed,
          port: formData.port,
          username: usernameTrimmed,
          password: passwordTrimmed,
          deviceId: backendDevice.deviceId || trimmedDeviceId || undefined,
        };

        if (existingLocal) {
          savedLocal = await updateDevice(existingLocal.id, payload);
        } else {
          savedLocal = await createDevice(payload);
        }
        await loadCredentials();
        addToast('Ulanish sozlamalari saqlandi', 'success');

        if (savedLocal) {
          try {
            const test = await testDeviceConnection(savedLocal.id);
            appLogger.debug('[Device Test] auto test result', {
              localId: savedLocal.id,
              backendId: backendDevice.id,
              deviceIdFromTest: test.deviceId,
              ok: test.ok,
            });
            if (test.ok && test.deviceId) {
              if (!backendDevice.deviceId || backendDevice.deviceId !== test.deviceId) {
                await updateSchoolDevice(backendDevice.id, { deviceId: test.deviceId });
              }
              if (savedLocal.deviceId !== test.deviceId || savedLocal.backendId !== backendDevice.id) {
                await updateDevice(savedLocal.id, {
                  backendId: backendDevice.id,
                  host: savedLocal.host,
                  port: savedLocal.port,
                  username: savedLocal.username,
                  password: savedLocal.password,
                  deviceId: test.deviceId,
                });
              }
              await Promise.all([loadBackendDevices(), loadCredentials()]);
            } else {
              appLogger.warn('[Device Test] deviceId missing after test', {
                ok: test.ok,
                deviceId: test.deviceId,
              });
            }
          } catch (err: unknown) {
            appLogger.warn('Auto test/sync failed', err);
          }
        }
      }
    }

    setFormData(DEFAULT_DEVICE_FORM_DATA);
    setEditingBackendId(null);
    setEditingLocalId(null);
    setIsModalOpen(false);
    setIsCredentialsModalOpen(false);
  } catch (error: unknown) {
    appLogger.error('Device submit failed', error);
    addToast('Xatolik yuz berdi', 'error');
  } finally {
    setLoading(false);
  }
}

import type { DeviceConfig, SchoolDeviceInfo } from '../types';

export type DeviceResolutionReason =
  | 'backend_id_match'
  | 'external_device_id_match'
  | 'backend_device_not_found'
  | 'local_credentials_not_found';

export type DeviceResolutionResult = {
  localDevice: DeviceConfig | null;
  backendDevice: SchoolDeviceInfo | null;
  reason: DeviceResolutionReason;
};

export function normalizeDeviceId(value?: string | null): string {
  return (value || '').trim().toLowerCase();
}

export function isDeviceCredentialsExpired(device?: DeviceConfig | null): boolean {
  if (!device?.credentialsExpiresAt) return false;
  const expires = new Date(device.credentialsExpiresAt).getTime();
  if (Number.isNaN(expires)) return false;
  return Date.now() > expires;
}

export function resolveLocalDeviceForBackend(
  backendDevice: SchoolDeviceInfo | null | undefined,
  localDevices: DeviceConfig[],
): DeviceResolutionResult {
  if (!backendDevice) {
    return {
      localDevice: null,
      backendDevice: null,
      reason: 'backend_device_not_found',
    };
  }

  const byBackendId = localDevices.find((item) => item.backendId === backendDevice.id);
  if (byBackendId) {
    return {
      localDevice: byBackendId,
      backendDevice,
      reason: 'backend_id_match',
    };
  }

  const backendExternalId = normalizeDeviceId(backendDevice.deviceId);
  if (backendExternalId) {
    const byExternalId = localDevices.find(
      (item) => normalizeDeviceId(item.deviceId) === backendExternalId,
    );
    if (byExternalId) {
      return {
        localDevice: byExternalId,
        backendDevice,
        reason: 'external_device_id_match',
      };
    }
  }

  return {
    localDevice: null,
    backendDevice,
    reason: 'local_credentials_not_found',
  };
}

export function resolveLocalDeviceByBackendId(
  backendId: string | null | undefined,
  backendDevices: SchoolDeviceInfo[],
  localDevices: DeviceConfig[],
): DeviceResolutionResult {
  if (!backendId) {
    return {
      localDevice: null,
      backendDevice: null,
      reason: 'backend_device_not_found',
    };
  }

  const backendDevice = backendDevices.find((item) => item.id === backendId) || null;
  return resolveLocalDeviceForBackend(backendDevice, localDevices);
}

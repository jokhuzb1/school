import type { DeviceConfig, SchoolDeviceInfo } from '../types';

export type DeviceSelectionStatus = 'online' | 'offline' | 'unknown' | 'no_credentials';

const DEFAULT_ONLINE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export function getDeviceSelectionStatusLabel(status: DeviceSelectionStatus): string {
  if (status === 'online') return 'Online';
  if (status === 'offline') return 'Offline';
  if (status === 'no_credentials') return "Sozlanmagan";
  return "Noma'lum";
}

export function deriveBackendPresenceStatus(
  backendDevice: SchoolDeviceInfo,
  localDevice?: DeviceConfig | null,
  thresholdMs = DEFAULT_ONLINE_THRESHOLD_MS,
): DeviceSelectionStatus {
  if (!localDevice?.id) return 'no_credentials';
  if (!backendDevice.lastSeenAt) return 'offline';
  const lastSeen = new Date(backendDevice.lastSeenAt).getTime();
  if (Number.isNaN(lastSeen)) return 'offline';
  return Date.now() - lastSeen < thresholdMs ? 'online' : 'offline';
}

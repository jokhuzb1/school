import type { DeviceResolutionReason } from './deviceResolver';

export type DeviceErrorCode =
  | 'DEVICE_NOT_FOUND'
  | 'LOCAL_CREDENTIALS_NOT_FOUND'
  | 'CREDENTIALS_EXPIRED'
  | 'UNKNOWN_DEVICE_ERROR';

export function mapDeviceResolutionReasonToCode(reason: DeviceResolutionReason): DeviceErrorCode {
  if (reason === 'backend_device_not_found') return 'DEVICE_NOT_FOUND';
  if (reason === 'local_credentials_not_found') return 'LOCAL_CREDENTIALS_NOT_FOUND';
  return 'UNKNOWN_DEVICE_ERROR';
}

export function buildDeviceErrorMessage(params: {
  code: DeviceErrorCode;
  deviceName?: string;
  detail?: string;
}): string {
  const label = params.deviceName ? ` (${params.deviceName})` : '';
  if (params.code === 'DEVICE_NOT_FOUND') {
    return `[DEVICE_NOT_FOUND] Qurilma topilmadi${label}.`;
  }
  if (params.code === 'LOCAL_CREDENTIALS_NOT_FOUND') {
    return `[LOCAL_CREDENTIALS_NOT_FOUND] Local credentials topilmadi${label}.`;
  }
  if (params.code === 'CREDENTIALS_EXPIRED') {
    return `[CREDENTIALS_EXPIRED] Local credentials muddati tugagan${label}.`;
  }
  if (params.detail) {
    return `[UNKNOWN_DEVICE_ERROR] ${params.detail}${label}`;
  }
  return `[UNKNOWN_DEVICE_ERROR] Qurilma bilan ishlashda noma'lum xato${label}.`;
}

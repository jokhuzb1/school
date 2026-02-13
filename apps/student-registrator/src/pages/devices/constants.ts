import type { DeviceFormData } from './types';

const DEFAULT_DEVICE_CREDENTIALS_LIMIT = 10;
const parsedDeviceLimit = Number(import.meta.env.VITE_DEVICE_CREDENTIALS_LIMIT);

export const DEVICE_CREDENTIALS_LIMIT =
  Number.isFinite(parsedDeviceLimit) && parsedDeviceLimit > 0
    ? Math.floor(parsedDeviceLimit)
    : DEFAULT_DEVICE_CREDENTIALS_LIMIT;

export const DEFAULT_DEVICE_FORM_DATA: DeviceFormData = {
  name: '',
  host: '',
  location: '',
  port: 80,
  username: '',
  password: '',
  deviceType: 'ENTRANCE',
  deviceId: '',
};

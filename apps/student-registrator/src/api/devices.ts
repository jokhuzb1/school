export type { DeviceConfig, DeviceConnectionResult, SchoolDeviceInfo, WebhookInfo } from '../api';
export {
  fetchDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  testDeviceConnection,
  probeDeviceConnection,
  fetchSchoolDevices,
  createSchoolDevice,
  updateSchoolDevice,
  deleteSchoolDevice,
  getDeviceCapabilities,
  getDeviceConfiguration,
  updateDeviceConfiguration,
  getDeviceWebhookConfig,
  syncDeviceWebhookConfig,
  getWebhookInfo,
} from '../api';

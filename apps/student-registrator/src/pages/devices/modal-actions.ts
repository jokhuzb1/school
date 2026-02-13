import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import type { DeviceFormData } from './types';
import { DEFAULT_DEVICE_FORM_DATA } from './constants';

type OpenDeviceModalParams = {
  device: SchoolDeviceInfo;
  getCredentialsForBackend: (device: SchoolDeviceInfo) => DeviceConfig | undefined;
  setEditingBackendId: (value: string | null) => void;
  setEditingLocalId: (value: string | null) => void;
  setFormData: (value: DeviceFormData) => void;
  setIsModalOpen: (value: boolean) => void;
};

export function openEditModalAction({
  device,
  getCredentialsForBackend,
  setEditingBackendId,
  setEditingLocalId,
  setFormData,
  setIsModalOpen,
}: OpenDeviceModalParams) {
  const local = getCredentialsForBackend(device);
  setEditingBackendId(device.id);
  setEditingLocalId(local?.id || null);
  setIsModalOpen(true);
  setFormData({
    name: device.name,
    host: local?.host || '',
    location: device.location || '',
    port: local?.port || 80,
    username: local?.username || '',
    password: local?.password || '',
    deviceType: device.type || 'ENTRANCE',
    deviceId: device.deviceId || local?.deviceId || '',
  });
}

type OpenCredentialsModalParams = {
  device: SchoolDeviceInfo;
  getCredentialsForBackend: (device: SchoolDeviceInfo) => DeviceConfig | undefined;
  setEditingBackendId: (value: string | null) => void;
  setEditingLocalId: (value: string | null) => void;
  setFormData: (value: DeviceFormData) => void;
  setIsCredentialsModalOpen: (value: boolean) => void;
};

export function openCredentialsModalAction({
  device,
  getCredentialsForBackend,
  setEditingBackendId,
  setEditingLocalId,
  setFormData,
  setIsCredentialsModalOpen,
}: OpenCredentialsModalParams) {
  const local = getCredentialsForBackend(device);
  setEditingBackendId(device.id);
  setEditingLocalId(local?.id || null);
  setIsCredentialsModalOpen(true);
  setFormData({
    name: device.name,
    host: local?.host || '',
    location: device.location || '',
    port: local?.port || 80,
    username: local?.username || '',
    password: local?.password || '',
    deviceType: device.type || 'ENTRANCE',
    deviceId: device.deviceId || local?.deviceId || '',
  });
}

type OpenCreateModalParams = {
  setEditingBackendId: (value: string | null) => void;
  setEditingLocalId: (value: string | null) => void;
  setFormData: (value: DeviceFormData) => void;
  setIsModalOpen: (value: boolean) => void;
};

export function openCreateModalAction({
  setEditingBackendId,
  setEditingLocalId,
  setFormData,
  setIsModalOpen,
}: OpenCreateModalParams) {
  setEditingBackendId(null);
  setEditingLocalId(null);
  setFormData(DEFAULT_DEVICE_FORM_DATA);
  setIsModalOpen(true);
}

import { invoke } from './client';
import { DeviceConfig, DeviceConnectionResult, StudentDeviceLiveCheckResult } from './types';

export async function fetchDevices(): Promise<DeviceConfig[]> {
  return invoke<DeviceConfig[]>('get_devices');
}

export async function createDevice(device: Omit<DeviceConfig, 'id'>): Promise<DeviceConfig> {
  return invoke<DeviceConfig>('create_device', {
    backendId: device.backendId ?? null,
    host: device.host,
    port: device.port,
    username: device.username,
    password: device.password,
    deviceId: device.deviceId,
  });
}

export async function updateDevice(id: string, device: Omit<DeviceConfig, 'id'>): Promise<DeviceConfig> {
  return invoke<DeviceConfig>('update_device', {
    id,
    backendId: device.backendId ?? null,
    host: device.host,
    port: device.port,
    username: device.username,
    password: device.password,
    deviceId: device.deviceId,
  });
}

export async function deleteDevice(id: string): Promise<boolean> {
  return invoke<boolean>('delete_device', { id });
}

export async function testDeviceConnection(deviceId: string): Promise<DeviceConnectionResult> {
  return invoke<DeviceConnectionResult>('test_device_connection', { deviceId });
}

export async function probeDeviceConnection(params: {
  host: string;
  port: number;
  username: string;
  password: string;
}): Promise<DeviceConnectionResult> {
  return invoke<DeviceConnectionResult>('probe_device_connection', {
    host: params.host,
    port: params.port,
    username: params.username,
    password: params.password,
  });
}

export async function getDeviceCapabilities(deviceId: string): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>('get_device_capabilities', { deviceId });
}

export async function getTauriContractVersion(): Promise<string> {
  return invoke<string>('get_contract_version');
}

export async function getDeviceConfiguration(deviceId: string): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>('get_device_configuration', { deviceId });
}

export async function updateDeviceConfiguration(params: {
  deviceId: string;
  configType: 'time' | 'ntpServers' | 'networkInterfaces';
  payload: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
  return invoke<Record<string, unknown>>('update_device_configuration', {
    deviceId: params.deviceId,
    configType: params.configType,
    payload: params.payload,
  });
}

export interface DeviceWebhookConfig {
  ok: boolean;
  direction: 'in' | 'out';
  path: string;
  primaryUrl?: string | null;
  urls: string[];
  raw: Record<string, unknown>;
}

export async function getDeviceWebhookConfig(
  deviceId: string,
  direction: 'in' | 'out',
): Promise<DeviceWebhookConfig> {
  return invoke<DeviceWebhookConfig>('get_device_webhook_config', {
    deviceId,
    direction,
  });
}

export async function syncDeviceWebhookConfig(params: {
  deviceId: string;
  direction: 'in' | 'out';
  targetUrl: string;
}): Promise<{
  ok: boolean;
  direction: 'in' | 'out';
  path: string;
  replacedFields: number;
  beforeUrls: string[];
  afterUrls: string[];
  raw: Record<string, unknown>;
}> {
  return invoke('sync_device_webhook_config', {
    deviceId: params.deviceId,
    direction: params.direction,
    targetUrl: params.targetUrl,
  });
}

export async function checkStudentOnDevice(
  deviceId: string,
  employeeNo: string,
): Promise<StudentDeviceLiveCheckResult> {
  return invoke<StudentDeviceLiveCheckResult>('check_student_on_device', {
    deviceId,
    employeeNo,
  });
}

import type React from 'react';
import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import type { WebhookInfo } from '../../api';

export type DeviceFormData = {
  name: string;
  host: string;
  location: string;
  port: number;
  username: string;
  password: string;
  deviceType: string;
  deviceId: string;
};

export type CloneStatus = {
  running: boolean;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ studentId?: string; name?: string; reason?: string }>;
};

export type DeviceCloneStatus = {
  running: boolean;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ employeeNo?: string; name?: string; reason?: string }>;
};

export type AddToast = (message: string, type?: 'success' | 'error' | 'info') => void;

export type ModalDialogRef = React.RefObject<HTMLDivElement | null>;

export type ModalKeyDown = React.KeyboardEventHandler<HTMLDivElement>;

export type DevicesPageCommon = {
  credentials: DeviceConfig[];
  backendDevices: SchoolDeviceInfo[];
  webhookInfo: WebhookInfo | null;
};

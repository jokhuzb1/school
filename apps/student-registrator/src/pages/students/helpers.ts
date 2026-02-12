import type { StudentDiagnosticsRow } from '../../types';

export type LiveStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'OFFLINE'
  | 'EXPIRED'
  | 'NO_CREDENTIALS'
  | 'ERROR'
  | 'PENDING'
  | 'UNSENT';

export type LiveDeviceResult = {
  status: LiveStatus;
  message?: string | null;
  checkedAt?: string;
};

export type StudentLiveState = {
  running: boolean;
  checkedAt?: string;
  byDeviceId: Record<string, LiveDeviceResult>;
};

export type DeviceOnlyMeta = {
  localDeviceId: string;
  hasFace: boolean;
  faceUrl?: string;
};

export type DeviceFaceFetchState = 'loading' | 'success' | 'failed';

export const PAGE_SIZE = 25;

export function statusBadgeClass(status: LiveStatus): string {
  if (status === 'PRESENT') return 'badge badge-success';
  if (status === 'PENDING' || status === 'UNSENT') return 'badge badge-warning';
  if (status === 'ABSENT') return 'badge';
  return 'badge badge-danger';
}

export function statusLabel(status: LiveStatus): string {
  if (status === 'PRESENT') return 'Bor';
  if (status === 'ABSENT') return "Yo'q";
  if (status === 'OFFLINE') return 'Offline';
  if (status === 'EXPIRED') return 'Muddati tugagan';
  if (status === 'NO_CREDENTIALS') return "Credentials yo'q";
  if (status === 'ERROR') return 'Xato';
  if (status === 'PENDING') return 'Kutilmoqda';
  return 'Yuborilmagan';
}

export function statusReason(status: LiveStatus, message?: string | null): string {
  if (message && message.trim()) return message;
  if (status === 'PRESENT') return "O'quvchi qurilmada topildi";
  if (status === 'ABSENT') return "O'quvchi qurilmada topilmadi";
  if (status === 'OFFLINE') return "Qurilmaga ulanish bo'lmadi";
  if (status === 'EXPIRED') return 'Local credentials muddati tugagan';
  if (status === 'NO_CREDENTIALS') return "Bu kompyuterda qurilma credentials yo'q";
  if (status === 'PENDING') return 'Jarayon davom etmoqda';
  if (status === 'UNSENT') return "Provisioning hali yuborilmagan";
  return "Noma'lum xato";
}

export function formatDateTime(value?: string): string {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('uz-UZ');
}

export function mapBackendStatus(row: StudentDiagnosticsRow): Record<string, LiveDeviceResult> {
  const result: Record<string, LiveDeviceResult> = {};
  row.devices.forEach((device) => {
    if (device.status === 'SUCCESS') {
      result[device.deviceId] = {
        status: 'PRESENT',
        message: "Server log bo'yicha yozilgan",
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    if (device.status === 'FAILED') {
      result[device.deviceId] = {
        status: 'ERROR',
        message: device.lastError || 'Provisioning xatosi',
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    if (device.status === 'PENDING') {
      result[device.deviceId] = {
        status: 'PENDING',
        message: 'Provisioning yakunlanmagan',
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    result[device.deviceId] = {
      status: 'UNSENT',
      message: "Provisioning yozuvi yo'q",
      checkedAt: device.updatedAt || undefined,
    };
  });
  return result;
}

export function summarizeStatuses(statuses: LiveDeviceResult[], running: boolean): string {
  if (running) return 'Tekshirilmoqda...';
  if (statuses.length === 0) return "Qurilma yo'q";
  const ok = statuses.filter((item) => item.status === 'PRESENT').length;
  const issues = statuses.filter((item) =>
    ['ABSENT', 'OFFLINE', 'EXPIRED', 'NO_CREDENTIALS', 'ERROR'].includes(item.status),
  ).length;
  if (issues === 0 && ok === statuses.length) return `OK ${ok}/${statuses.length}`;
  if (issues === 0) return `Jarayonda ${ok}/${statuses.length}`;
  return `Muammo ${issues}`;
}

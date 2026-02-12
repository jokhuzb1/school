import type { ProvisioningLogEntry } from '../../api';

export const PAGE_SIZE = 50;

export function formatStudentName(log: ProvisioningLogEntry): string {
  if (log.student?.lastName || log.student?.firstName) {
    return [log.student?.lastName, log.student?.firstName].filter(Boolean).join(' ');
  }
  return log.student?.name || '-';
}

export function levelTone(level: string): 'info' | 'warn' | 'error' {
  const value = String(level || '').toUpperCase();
  if (value === 'WARN') return 'warn';
  if (value === 'ERROR') return 'error';
  return 'info';
}

export function statusTone(status?: string | null): 'success' | 'warn' | 'error' | 'info' {
  const value = String(status || '').toUpperCase();
  if (value === 'SUCCESS' || value === 'CONFIRMED') return 'success';
  if (value === 'FAILED') return 'error';
  if (value === 'PROCESSING' || value === 'PENDING' || value === 'PARTIAL') return 'warn';
  return 'info';
}

export type RetryTarget = {
  provisioningId: string;
  deviceIds: string[];
};

export function getRetryTargetByLogType(log: ProvisioningLogEntry): RetryTarget | null {
  if (!log.provisioningId) return null;
  const stage = String(log.stage || '').toUpperCase();
  const status = String(log.status || '').toUpperCase();
  if (stage === 'DEVICE_RESULT' && status === 'FAILED') {
    return { provisioningId: log.provisioningId, deviceIds: log.deviceId ? [log.deviceId] : [] };
  }
  if (stage === 'PROVISIONING_START' && (status === 'FAILED' || status === 'PARTIAL')) {
    return { provisioningId: log.provisioningId, deviceIds: [] };
  }
  return null;
}

export function downloadCsv(rows: ProvisioningLogEntry[]) {
  const header = [
    'createdAt',
    'level',
    'eventType',
    'stage',
    'status',
    'actorId',
    'actorName',
    'actorRole',
    'student',
    'device',
    'message',
    'provisioningId',
  ];
  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const body = rows.map((log) => {
    const student = formatStudentName(log);
    const device = log.device?.name || log.deviceId || '-';
    return [
      log.createdAt,
      log.level,
      log.eventType || '',
      log.stage || '',
      log.status || '',
      log.actorId || '',
      log.actorName || '',
      log.actorRole || '',
      student,
      device,
      log.message || '',
      log.provisioningId || '',
    ]
      .map(escape)
      .join(',');
  });
  const csv = [header.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import { BACKEND_URL } from './constants';
import { buildHttpApiError, fetchWithAuth } from './client';

export interface ProvisioningDeviceLink {
  id: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  deviceId: string;
  employeeNoOnDevice?: string | null;
  lastError?: string | null;
  device?: {
    id: string;
    deviceId: string;
    name: string;
    location?: string | null;
    isActive?: boolean;
  };
}

export interface ProvisioningDetails {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'PARTIAL' | 'CONFIRMED' | 'FAILED';
  studentId: string;
  schoolId: string;
  lastError?: string | null;
  devices?: ProvisioningDeviceLink[];
}

export interface ProvisioningLogEntry {
  id: string;
  schoolId: string;
  studentId?: string | null;
  provisioningId?: string | null;
  deviceId?: string | null;
  level: 'INFO' | 'WARN' | 'ERROR';
  eventType?: string | null;
  stage: string;
  status?: string | null;
  message?: string | null;
  payload?: Record<string, unknown> | null;
  actorId?: string | null;
  actorRole?: string | null;
  actorName?: string | null;
  actorIp?: string | null;
  userAgent?: string | null;
  source?: string | null;
  createdAt: string;
  student?: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    deviceStudentId?: string | null;
  } | null;
  device?: {
    id: string;
    name: string;
    deviceId?: string | null;
    location?: string | null;
  } | null;
}

export interface ProvisioningAuditQuery {
  page?: number;
  limit?: number;
  q?: string;
  level?: 'INFO' | 'WARN' | 'ERROR' | '';
  eventType?: string;
  stage?: string;
  status?: string;
  provisioningId?: string;
  studentId?: string;
  deviceId?: string;
  actorId?: string;
  from?: string;
  to?: string;
}

export interface ProvisioningAuditResponse {
  data: ProvisioningLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export type DeviceImportRowPayload = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  fatherName?: string;
  classId: string;
  parentPhone?: string;
  gender?: 'MALE' | 'FEMALE' | 'male' | 'female';
};

export async function getProvisioningLogs(provisioningId: string): Promise<ProvisioningLogEntry[]> {
  const res = await fetchWithAuth(`${BACKEND_URL}/provisioning/${provisioningId}/logs`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch provisioning logs');
  return res.json();
}

export async function getSchoolProvisioningLogs(
  schoolId: string,
  query: ProvisioningAuditQuery = {},
): Promise<ProvisioningAuditResponse> {
  const params = new URLSearchParams();
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.q) params.set('q', query.q);
  if (query.level) params.set('level', query.level);
  if (query.eventType) params.set('eventType', query.eventType);
  if (query.stage) params.set('stage', query.stage);
  if (query.status) params.set('status', query.status);
  if (query.provisioningId) params.set('provisioningId', query.provisioningId);
  if (query.studentId) params.set('studentId', query.studentId);
  if (query.deviceId) params.set('deviceId', query.deviceId);
  if (query.actorId) params.set('actorId', query.actorId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';

  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/provisioning-logs${suffix}`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch audit logs');
  return res.json();
}

export async function createImportAuditLog(
  schoolId: string,
  payload: {
    stage: string;
    status: string;
    message?: string;
    payload?: Record<string, unknown>;
  },
): Promise<{ ok: boolean; id: string; createdAt: string }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/import-audit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to create import audit log', 'POST');
  return res.json();
}

export async function previewDeviceImport(
  schoolId: string,
  rows: DeviceImportRowPayload[],
): Promise<{
  total: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  invalidCount: number;
  duplicateCount: number;
  classErrorCount: number;
  rows: Array<{
    employeeNo: string;
    firstName: string;
    lastName: string;
    classId: string;
    action: 'CREATE' | 'UPDATE' | 'INVALID';
    reasons: string[];
    existingStudentId?: string | null;
  }>;
}> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/device-import/preview`, {
    method: 'POST',
    body: JSON.stringify({ rows }),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to preview import', 'POST');
  return res.json();
}

export async function commitDeviceImport(
  schoolId: string,
  payload: {
    rows: DeviceImportRowPayload[];
    idempotencyKey?: string;
    sourceDeviceId?: string;
    syncMode?: 'none' | 'current' | 'all' | 'selected';
    targetDeviceIds?: string[];
    retryMode?: boolean;
  },
): Promise<{
  ok: boolean;
  idempotent: boolean;
  jobId: string;
  createdCount: number;
  updatedCount: number;
  created: Array<{ id: string; deviceStudentId: string | null }>;
  updated: Array<{ id: string; deviceStudentId: string | null }>;
  students: Array<{
    id: string;
    deviceStudentId: string | null;
    firstName: string;
    lastName: string;
  }>;
}> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/device-import/commit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to commit import', 'POST');
  return res.json();
}

export async function getImportJob(
  schoolId: string,
  jobId: string,
): Promise<{
  id: string;
  schoolId: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  retryCount: number;
  lastError?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  totalRows: number;
  processed: number;
  success: number;
  failed: number;
  synced: number;
}> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/import-jobs/${jobId}`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch import job');
  return res.json();
}

export async function retryImportJob(schoolId: string, jobId: string): Promise<{ ok: boolean }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/import-jobs/${jobId}/retry`, {
    method: 'POST',
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to retry import job', 'POST');
  return res.json();
}

export async function getImportMetrics(
  schoolId: string,
): Promise<{
  totalRuns: number;
  totalSuccess: number;
  totalFailed: number;
  totalSynced: number;
  successRate: number;
  retryRate: number;
  meanLatencyMs: number;
}> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/import-metrics`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch import metrics');
  return res.json();
}

// API Client using Tauri invoke

import { invoke } from '@tauri-apps/api';

export interface DeviceConfig {
  id: string;
  backendId?: string | null;
  // Legacy UI compatibility. Metadata source-of-truth is backend.
  name?: string;
  host: string;
  // Legacy UI compatibility. Metadata source-of-truth is backend.
  location?: string;
  port: number;
  username: string;
  password: string;
  // Legacy UI compatibility. Metadata source-of-truth is backend.
  deviceType?: string;
  deviceId?: string | null;
  credentialsUpdatedAt?: string | null;
  credentialsExpiresAt?: string | null;
}

export interface DeviceConnectionResult {
  ok: boolean;
  message?: string;
  deviceId?: string;
}


export type LiveStatus = 'PRESENT' | 'ABSENT' | 'OFFLINE' | 'EXPIRED' | 'UNSENT' | 'PENDING' | 'ERROR' | 'NO_CREDENTIALS';

export interface LiveDeviceResult {
  status: LiveStatus;
  message?: string | null;
  checkedAt?: string;
}

export interface StudentDeviceLiveCheckResult {
  deviceId: string;
  deviceExternalId?: string | null;
  status: 'PRESENT' | 'ABSENT' | 'OFFLINE' | 'EXPIRED';
  present: boolean;
  message?: string | null;
  checkedAt: string;
}

export interface RegisterResult {
  employeeNo: string;
  provisioningId?: string;
  results: Array<{
    deviceId: string;
    deviceName: string;
    connection: { ok: boolean; message?: string; deviceId?: string };
    userCreate?: { ok: boolean; statusString?: string; errorMsg?: string };
    faceUpload?: { ok: boolean; statusString?: string; errorMsg?: string };
  }>;
}

export interface ProvisioningDeviceLink {
  id: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
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
  status: "PENDING" | "PROCESSING" | "PARTIAL" | "CONFIRMED" | "FAILED";
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
  level: "INFO" | "WARN" | "ERROR";
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

export interface UserInfoEntry {
  employeeNo: string;
  name: string;
  gender?: string;
  numOfFace?: number;
  faceURL?: string;
  userType?: string;
  doorRight?: string;
  RightPlan?: Array<{ doorNo: number; planTemplateNo: string }>;
  Valid?: {
    enable?: boolean;
    beginTime?: string;
    endTime?: string;
    timeType?: string;
  };
}

export interface UserInfoSearchResponse {
  UserInfoSearch?: {
    UserInfo?: UserInfoEntry[];
    numOfMatches?: number;
    totalMatches?: number;
  };
}

// Backend URL - can be configured via environment
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const API_DEBUG_STORAGE_KEY = 'registrator_api_debug_entries';
const API_DEBUG_LIMIT = 150;
const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
const parsedFetchTimeout = Number(import.meta.env.VITE_FETCH_TIMEOUT_MS || DEFAULT_FETCH_TIMEOUT_MS);
const FETCH_TIMEOUT_MS = Number.isFinite(parsedFetchTimeout) && parsedFetchTimeout > 0
  ? parsedFetchTimeout
  : DEFAULT_FETCH_TIMEOUT_MS;
const VERBOSE_NETWORK_DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_NETWORK_DEBUG === 'true';

type ApiDebugLevel = 'info' | 'warn' | 'error';
type ApiRequestContext = 'auth' | 'api';
export type ApiErrorCode = 'NETWORK_ERROR' | 'REQUEST_TIMEOUT' | 'HTTP_ERROR' | 'INVALID_RESPONSE';

export interface ApiDebugEntry {
  id: string;
  at: string;
  level: ApiDebugLevel;
  context: ApiRequestContext;
  method: string;
  url: string;
  message: string;
  backendUrl: string;
  clientOrigin: string | null;
  status?: number;
  durationMs?: number;
  online: boolean | null;
}

export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly method: string;
  readonly url: string;
  readonly debugId: string;
  readonly status?: number;

  constructor(params: {
    message: string;
    code: ApiErrorCode;
    method: string;
    url: string;
    debugId: string;
    status?: number;
  }) {
    super(params.message);
    this.name = 'ApiRequestError';
    this.code = params.code;
    this.method = params.method;
    this.url = params.url;
    this.debugId = params.debugId;
    this.status = params.status;
  }
}

function normalizeHeaders(input?: HeadersInit): Record<string, string> {
  if (!input) return {};
  if (input instanceof Headers) {
    const fromHeaders: Record<string, string> = {};
    input.forEach((value, key) => {
      fromHeaders[key] = value;
    });
    return fromHeaders;
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  return { ...input };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Unknown error';
}

function getOnlineState(): boolean | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.onLine;
}

function getClientOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.location.origin || null;
  } catch {
    return null;
  }
}

function createDebugId(): string {
  return `dbg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readStoredApiDebugEntries(): ApiDebugEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(API_DEBUG_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ApiDebugEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStoredApiDebugEntries(entries: ApiDebugEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(API_DEBUG_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures on locked-down environments.
  }
}

function pushApiDebugEntry(input: Omit<ApiDebugEntry, 'id' | 'at' | 'backendUrl' | 'online' | 'clientOrigin'>): string {
  const entry: ApiDebugEntry = {
    ...input,
    id: createDebugId(),
    at: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    clientOrigin: getClientOrigin(),
    online: getOnlineState(),
  };
  const current = readStoredApiDebugEntries();
  const next = [...current, entry].slice(-API_DEBUG_LIMIT);
  writeStoredApiDebugEntries(next);
  return entry.id;
}

export function getApiDebugEntries(limit = 40): ApiDebugEntry[] {
  const entries = readStoredApiDebugEntries();
  if (limit <= 0) return [];
  return entries.slice(-limit);
}

export function getApiDebugReport(limit = 40): string {
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      backendUrl: BACKEND_URL,
      timeoutMs: FETCH_TIMEOUT_MS,
      entries: getApiDebugEntries(limit),
    },
    null,
    2,
  );
}

export function clearApiDebugEntries(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(API_DEBUG_STORAGE_KEY);
}

export function formatApiErrorMessage(error: unknown, fallback = 'Xatolik yuz berdi'): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

// ============ Auth Management ============

const AUTH_TOKEN_KEY = 'registrator_auth_token';
const AUTH_USER_KEY = 'registrator_auth_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const data = localStorage.getItem(AUTH_USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

function setAuth(token: string, user: AuthUser): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const url = `${BACKEND_URL}/auth/login`;
  console.debug('[Auth] login attempt', { email, backendUrl: BACKEND_URL });
  const res = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }, 'auth', false);

  if (!res.ok) {
    throw await buildHttpApiError(res, 'Login failed', 'POST', 'auth');
  }

  const data = await res.json().catch((error: unknown) => {
    const debugId = pushApiDebugEntry({
      level: 'error',
      context: 'auth',
      method: 'POST',
      url,
      status: res.status,
      message: `Invalid login response JSON: ${toErrorMessage(error)}`,
    });
    throw new ApiRequestError({
      message: `Serverdan noto'g'ri login javobi keldi. [debug:${debugId}]`,
      code: 'INVALID_RESPONSE',
      method: 'POST',
      url,
      status: res.status,
      debugId,
    });
  });
  setAuth(data.token, data.user);
  return data;
}

// ============ Backend API with Auth ============

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return request(url, options, 'api', true);
}

async function request(
  url: string,
  options: RequestInit,
  context: ApiRequestContext,
  withAuth: boolean,
): Promise<Response> {
  const token = getAuthToken();
  const headers = normalizeHeaders(options.headers);
  if (options.body && !(options.body instanceof FormData) && !hasHeader(headers, 'Content-Type')) {
    headers['Content-Type'] = 'application/json';
  }
  if (withAuth && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const method = (options.method || 'GET').toUpperCase();
  const startedAt = Date.now();
  const controller = options.signal ? null : new AbortController();
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    : null;

  console.debug('[API] request', { method, url, context });
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller?.signal,
    });
    const durationMs = Date.now() - startedAt;
    console.debug('[API] response', { method, url, status: res.status, ok: res.ok, durationMs });

    if (!res.ok || VERBOSE_NETWORK_DEBUG) {
      pushApiDebugEntry({
        level: res.ok ? 'info' : 'warn',
        context,
        method,
        url,
        status: res.status,
        durationMs,
        message: res.ok ? 'Request OK' : `HTTP ${res.status}`,
      });
    }
    return res;
  } catch (error: unknown) {
    const durationMs = Date.now() - startedAt;
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    const debugId = pushApiDebugEntry({
      level: 'error',
      context,
      method,
      url,
      durationMs,
      message: `${timedOut ? 'Timeout' : 'Network error'}: ${toErrorMessage(error)}`,
    });
    throw new ApiRequestError({
      message: timedOut
        ? `Server javobi kechikdi (${FETCH_TIMEOUT_MS}ms). [debug:${debugId}]`
        : `Server bilan bog'lanib bo'lmadi. URL va internetni tekshiring. [debug:${debugId}]`,
      code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      method,
      url,
      debugId,
    });
  } finally {
    if (timeoutId !== null) window.clearTimeout(timeoutId);
  }
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.message)) {
      const arrMessage = parsed.message.filter((item: unknown) => typeof item === 'string').join(', ').trim();
      if (arrMessage) return arrMessage;
    }
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
  } catch {
    // keep raw text
  }
  return text;
}

async function buildHttpApiError(
  res: Response,
  fallback: string,
  method = 'GET',
  context: ApiRequestContext = 'api',
): Promise<ApiRequestError> {
  const message = await readErrorMessage(res, fallback);
  const debugId = pushApiDebugEntry({
    level: 'warn',
    context,
    method,
    url: res.url || `${BACKEND_URL}/unknown`,
    status: res.status,
    message,
  });
  return new ApiRequestError({
    message: `${message} (status ${res.status}) [debug:${debugId}]`,
    code: 'HTTP_ERROR',
    method,
    url: res.url || `${BACKEND_URL}/unknown`,
    status: res.status,
    debugId,
  });
}

async function assertSchoolScopedResponse(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 404) {
    logout();
    const debugId = pushApiDebugEntry({
      level: 'warn',
      context: 'api',
      method: 'GET',
      url: res.url || `${BACKEND_URL}/unknown`,
      status: res.status,
      message: 'School not found for current session',
    });
    throw new ApiRequestError({
      message: `Sessiya eskirgan: maktab topilmadi. Qayta login qiling. [debug:${debugId}]`,
      code: 'HTTP_ERROR',
      method: 'GET',
      url: res.url || `${BACKEND_URL}/unknown`,
      status: 404,
      debugId,
    });
  }
  throw await buildHttpApiError(res, fallback);
}

export interface SchoolInfo {
  id: string;
  name: string;
  address?: string;
}

export interface ClassInfo {
  id: string;
  name: string;
  gradeLevel: number;
  schoolId: string;
  totalStudents?: number;
}

export interface SchoolStudent {
  id: string;
  name: string;
  gender?: 'MALE' | 'FEMALE';
  firstName?: string;
  lastName?: string;
  fatherName?: string | null;
  classId?: string | null;
  class?: {
    id: string;
    name: string;
  } | null;
  deviceStudentId?: string | null;
  deviceSyncStatus?: 'PENDING' | 'PROCESSING' | 'PARTIAL' | 'CONFIRMED' | 'FAILED' | null;
  photoUrl?: string | null;
}

export interface StudentProfileDetail extends SchoolStudent {
  parentPhone?: string | null;
}

export interface SchoolStudentsResponse {
  data: SchoolStudent[];
  total: number;
  page: number;
}

export interface StudentDeviceDiagnostic {
  deviceId: string;
  deviceName: string;
  deviceExternalId?: string | null;
  status: 'SUCCESS' | 'FAILED' | 'PENDING' | 'MISSING';
  lastError?: string | null;
  updatedAt?: string | null;
}

export interface StudentDiagnosticsRow {
  studentId: string;
  studentName: string;
  firstName?: string;
  lastName?: string;
  fatherName?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  classId?: string | null;
  className?: string | null;
  deviceStudentId?: string | null;
  photoUrl?: string | null;
  devices: StudentDeviceDiagnostic[];
}

export interface StudentDiagnosticsResponse {
  devices: Array<{
    id: string;
    name: string;
    deviceId?: string | null;
    isActive?: boolean | null;
  }>;
  data: StudentDiagnosticsRow[];
}

export interface SchoolDeviceInfo {
  id: string;
  name: string;
  deviceId?: string | null;
  type?: string | null;
  location?: string | null;
  isActive?: boolean | null;
  lastSeenAt?: string | null;
}

export interface WebhookInfo {
  enforceSecret: boolean;
  secretHeaderName: string;
  inUrl: string;
  outUrl: string;
  inUrlWithSecret: string;
  outUrlWithSecret: string;
  inSecret: string;
  outSecret: string;
}

export async function fetchSchools(): Promise<SchoolInfo[]> {
  const user = getAuthUser();
  if (!user) throw new Error('Not authenticated');
  
  // If user has schoolId, return just their school
  if (user.schoolId) {
    const res = await fetchWithAuth(`${BACKEND_URL}/schools/${user.schoolId}`);
    await assertSchoolScopedResponse(res, 'Failed to fetch school');
    const school = await res.json();
    return [school];
  }
  
  // SUPER_ADMIN can see all schools
  const res = await fetchWithAuth(`${BACKEND_URL}/schools`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch schools');
  return res.json();
}

export async function fetchClasses(schoolId: string): Promise<ClassInfo[]> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/classes`);
  await assertSchoolScopedResponse(res, 'Failed to fetch classes');
  return res.json();
}

export async function fetchSchoolStudents(
  schoolId: string,
  params: { classId?: string; search?: string; page?: number } = {},
): Promise<SchoolStudentsResponse> {
  const query = new URLSearchParams();
  if (params.classId) query.set('classId', params.classId);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/students${suffix}`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch students');
  return res.json();
}

export async function createSchoolStudent(
  schoolId: string,
  payload: {
    firstName: string;
    lastName: string;
    fatherName?: string;
    gender: 'male' | 'female' | 'MALE' | 'FEMALE';
    classId: string;
    parentPhone?: string;
    deviceStudentId?: string;
  },
): Promise<SchoolStudent> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/students`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to create student', 'POST');
  return res.json();
}

export async function fetchStudentByDeviceStudentId(
  schoolId: string,
  deviceStudentId: string,
): Promise<StudentProfileDetail> {
  const res = await fetchWithAuth(
    `${BACKEND_URL}/schools/${schoolId}/students/by-device-student-id/${encodeURIComponent(deviceStudentId)}`,
  );
  await assertSchoolScopedResponse(res, 'Failed to fetch student by device student id');
  return res.json();
}

export async function fetchStudentDiagnostics(
  schoolId: string,
  params: { classId?: string; search?: string; page?: number } = {},
): Promise<StudentDiagnosticsResponse> {
  const query = new URLSearchParams();
  if (params.classId) query.set('classId', params.classId);
  if (params.search) query.set('search', params.search);
  if (params.page) query.set('page', String(params.page));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/students/device-diagnostics${suffix}`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch student diagnostics');
  return res.json();
}

export async function updateStudentProfile(
  studentId: string,
  payload: {
    firstName?: string;
    lastName?: string;
    fatherName?: string;
    gender?: 'male' | 'female' | 'MALE' | 'FEMALE';
    classId?: string;
    parentPhone?: string;
    deviceStudentId?: string;
    faceImageBase64?: string;
  },
): Promise<SchoolStudent> {
  const res = await fetchWithAuth(`${BACKEND_URL}/students/${studentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to update student', 'PUT');
  return res.json();
}

export async function fetchSchoolDevices(schoolId: string): Promise<SchoolDeviceInfo[]> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/devices`);
  await assertSchoolScopedResponse(res, 'Failed to fetch devices');
  return res.json();
}

export async function getWebhookInfo(schoolId: string): Promise<WebhookInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/webhook-info`);
  await assertSchoolScopedResponse(res, 'Failed to fetch webhook info');
  return res.json();
}

export async function rotateWebhookSecret(
  schoolId: string,
  direction: 'in' | 'out',
): Promise<{ ok: boolean; info: WebhookInfo }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/webhook/rotate`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
  await assertSchoolScopedResponse(res, 'Failed to rotate webhook secret');
  return res.json();
}

export async function testWebhookEndpoint(
  schoolId: string,
  direction: 'in' | 'out',
): Promise<{ ok: boolean; direction: 'in' | 'out'; method: string; path: string; testedAt: string }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/webhook/test`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
  await assertSchoolScopedResponse(res, 'Failed to test webhook endpoint');
  return res.json();
}

export async function createSchoolDevice(
  schoolId: string,
  payload: { name: string; deviceId: string; type?: string; location?: string },
): Promise<SchoolDeviceInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/devices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to create backend device', 'POST');
  return res.json();
}

export async function updateSchoolDevice(
  id: string,
  payload: Partial<Pick<SchoolDeviceInfo, 'name' | 'deviceId' | 'type' | 'location' | 'isActive' | 'lastSeenAt'>>,
): Promise<SchoolDeviceInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to update backend device', 'PUT');
  return res.json();
}

export async function getDeviceWebhookHealth(
  id: string,
): Promise<{ ok: boolean; deviceId: string; lastWebhookEventAt: string | null; lastSeenAt: string | null }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/devices/${id}/webhook-health`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch webhook health');
  return res.json();
}

export async function cloneStudentsToDevice(params: {
  backendDeviceId: string;
  pageSize?: number;
  maxStudents?: number;
}): Promise<{
  ok: boolean;
  device: string;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ studentId?: string; name?: string; reason?: string }>;
}> {
  const token = getAuthToken();
  const user = getAuthUser();
  return invoke('clone_students_to_device', {
    backendDeviceId: params.backendDeviceId,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
    schoolId: user?.schoolId || '',
    pageSize: params.pageSize,
    maxStudents: params.maxStudents,
  });
}

export async function cloneDeviceToDevice(params: {
  sourceDeviceId: string;
  targetDeviceId: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  source: string;
  target: string;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ employeeNo?: string; name?: string; reason?: string }>;
}> {
  return invoke('clone_device_to_device', {
    sourceDeviceId: params.sourceDeviceId,
    targetDeviceId: params.targetDeviceId,
    limit: params.limit,
  });
}

export async function deleteSchoolDevice(id: string): Promise<boolean> {
  const res = await fetchWithAuth(`${BACKEND_URL}/devices/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to delete backend device', 'DELETE');
  return true;
}

export async function createClass(schoolId: string, name: string, gradeLevel: number): Promise<ClassInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gradeLevel }),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to create class', 'POST');
  return res.json();
}

// ============ Device Management ============

export async function fetchDevices(): Promise<DeviceConfig[]> {
  return invoke<DeviceConfig[]>('get_devices');
}

export async function createDevice(
  device: Omit<DeviceConfig, 'id'>,
): Promise<DeviceConfig> {
  return invoke<DeviceConfig>('create_device', {
    backendId: device.backendId ?? null,
    host: device.host,
    port: device.port,
    username: device.username,
    password: device.password,
    deviceId: device.deviceId,
  });
}

export async function updateDevice(
  id: string,
  device: Omit<DeviceConfig, 'id'>,
): Promise<DeviceConfig> {
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

// ============ Student Registration ============

export async function registerStudent(
  name: string,
  gender: string,
  faceImageBase64: string,
  options?: {
    firstName?: string;
    lastName?: string;
    fatherName?: string;
    parentPhone?: string;
    classId?: string;
    targetDeviceIds?: string[];
  },
): Promise<RegisterResult> {
  const token = getAuthToken();
  const user = getAuthUser();
  console.debug('[Register] register_student', {
    backendUrl: BACKEND_URL,
    hasToken: Boolean(token),
    schoolId: user?.schoolId || '',
    targetDeviceIds: options?.targetDeviceIds?.length || 0,
  });
  
  return invoke<RegisterResult>('register_student', {
    name,
    gender,
    faceImageBase64,
    firstName: options?.firstName,
    lastName: options?.lastName,
    fatherName: options?.fatherName,
    parentPhone: options?.parentPhone,
    classId: options?.classId,
    targetDeviceIds: options?.targetDeviceIds,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
    schoolId: user?.schoolId || '',
  });
}

// ============ User Management ============

export async function fetchUsers(
  deviceId: string,
  options?: { offset?: number; limit?: number },
): Promise<UserInfoSearchResponse> {
  return invoke<UserInfoSearchResponse>('fetch_users', { 
    deviceId,
    offset: options?.offset ?? 0,
    limit: options?.limit ?? 30,
  });
}

export async function deleteUser(
  deviceId: string,
  employeeNo: string,
): Promise<boolean> {
  return invoke<boolean>('delete_user', { deviceId, employeeNo });
}

export async function getUserFace(
  deviceId: string,
  employeeNo: string,
): Promise<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }> {
  return invoke<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }>('get_user_face', {
    deviceId,
    employeeNo,
  });
}

export async function getUserFaceByUrl(
  deviceId: string,
  employeeNo: string,
  faceUrl: string,
): Promise<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }> {
  return invoke<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }>('get_user_face_by_url', {
    deviceId,
    employeeNo,
    faceUrl,
  });
}

export interface RecreateUserResult {
  employeeNo: string;
  deleteResult: { ok: boolean; statusString?: string; errorMsg?: string };
  createResult: { ok: boolean; statusString?: string; errorMsg?: string };
  faceUpload: { ok: boolean; statusString?: string; errorMsg?: string };
}

export async function recreateUser(
  deviceId: string,
  employeeNo: string,
  name: string,
  gender: string,
  newEmployeeNo: boolean,
  reuseExistingFace: boolean,
  faceImageBase64?: string,
): Promise<RecreateUserResult> {
  return invoke<RecreateUserResult>('recreate_user', {
    deviceId,
    employeeNo,
    name,
    gender,
    newEmployeeNo,
    reuseExistingFace,
    faceImageBase64,
  });
}

// ============ Helper Functions ============

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/xxx;base64, prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============ Provisioning ============

export async function getProvisioning(
  provisioningId: string,
): Promise<ProvisioningDetails> {
  const token = getAuthToken();
  return invoke<ProvisioningDetails>('get_provisioning', {
    provisioningId,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
  });
}

export async function getProvisioningLogs(
  provisioningId: string,
): Promise<ProvisioningLogEntry[]> {
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

export type DeviceImportRowPayload = {
  employeeNo: string;
  firstName: string;
  lastName: string;
  fatherName?: string;
  classId: string;
  parentPhone?: string;
  gender?: 'MALE' | 'FEMALE' | 'male' | 'female';
};

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

export async function retryImportJob(
  schoolId: string,
  jobId: string,
): Promise<{ ok: boolean }> {
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

export async function retryProvisioning(
  provisioningId: string,
  deviceIds: string[] = [],
): Promise<{
  ok: boolean;
  updated?: number;
  targetDeviceIds?: string[];
  perDeviceResults?: Array<{
    backendDeviceId: string;
    deviceExternalId?: string | null;
    deviceName?: string;
    status: string;
    lastError?: string | null;
    updatedAt?: string | null;
  }>;
  connectionCheck?: {
    checked: number;
    failed: number;
    missingCredentials: number;
  };
}> {
  const token = getAuthToken();
  return invoke<{
    ok: boolean;
    updated?: number;
    targetDeviceIds?: string[];
    perDeviceResults?: Array<{
      backendDeviceId: string;
      deviceExternalId?: string | null;
      deviceName?: string;
      status: string;
      lastError?: string | null;
      updatedAt?: string | null;
    }>;
    connectionCheck?: {
      checked: number;
      failed: number;
      missingCredentials: number;
    };
  }>('retry_provisioning', {
    provisioningId,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
    deviceIds,
  });
}

/**
 * Syncs a student to devices by finding their last provisioning ID and retrying it.
 * This is used when a student's profile is updated and needs to be pushed to devices.
 */
export async function syncStudentToDevices(
  studentId: string,
  deviceIds: string[] = [],
): Promise<{
  ok: boolean;
  reason?: string;
  perDeviceResults: Array<{
    backendDeviceId: string;
    deviceExternalId?: string | null;
    deviceName?: string;
    status: string;
    lastError?: string | null;
    updatedAt?: string | null;
  }>;
}> {
  const user = getAuthUser();
  if (!user?.schoolId) {
    return { ok: false, reason: 'No school', perDeviceResults: [] };
  }

  try {
    console.debug('[Sync] start', { studentId, schoolId: user.schoolId, backendUrl: BACKEND_URL });
    // 1. Find the last provisioning ID for this student from audit logs
    const response = await getSchoolProvisioningLogs(user.schoolId, {
      studentId,
      limit: 1,
      level: 'INFO',
      stage: 'PROVISIONING_START',
    });

    const lastLog = response.data[0];
    if (!lastLog || !lastLog.provisioningId) {
      console.warn(`[Sync] No provisioning found for student ${studentId}`);
      return { ok: false, reason: 'No provisioning', perDeviceResults: [] };
    }

    // 2. Retry the provisioning
    console.debug('[Sync] retry provisioning', { provisioningId: lastLog.provisioningId });
    const result = await retryProvisioning(lastLog.provisioningId, deviceIds);
    console.debug('[Sync] retry result', result);
    return {
      ok: Boolean(result.ok),
      perDeviceResults: result.perDeviceResults || [],
    };
  } catch (err) {
    console.error(`[Sync] Failed to sync student ${studentId}:`, err);
    return { ok: false, reason: 'Sync failed', perDeviceResults: [] };
  }
}

type FaceEncodeOptions = {
  maxBytes: number;
  maxDimension: number;
};

const DEFAULT_FACE_ENCODE: FaceEncodeOptions = {
  maxBytes: 200 * 1024,
  maxDimension: 640,
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0);
  return await createImageBitmap(canvas);
}

async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Failed to encode image"));
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Encodes a face image as base64 JPEG and tries to keep it under 200KB.
 * This helps Hikvision devices that enforce small face image size limits.
 */
export async function fileToFaceBase64(
  file: File,
  options: Partial<FaceEncodeOptions> = {},
): Promise<string> {
  const { maxBytes, maxDimension } = { ...DEFAULT_FACE_ENCODE, ...options };
  const allowedTypes = new Set(['image/jpeg', 'image/png']);
  if (!allowedTypes.has(file.type)) {
    throw new Error('Faqat JPG yoki PNG formatidagi rasm qabul qilinadi.');
  }
  if (file.size < 10 * 1024) {
    throw new Error('Rasm hajmi 10KB dan kichik bo‘lmasligi kerak.');
  }

  // Fast path: already small enough (roughly) → send original.
  if (file.size <= maxBytes) {
    return fileToBase64(file);
  }

  const bmp = await fileToImageBitmap(file);
  const scale = Math.min(
    1,
    maxDimension / Math.max(bmp.width || 1, bmp.height || 1),
  );
  const targetW = Math.max(1, Math.round(bmp.width * scale));
  const targetH = Math.max(1, Math.round(bmp.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bmp, 0, 0, targetW, targetH);

  // Try decreasing quality first. If still too big, downscale and retry.
  let quality = 0.9;
  for (let attempt = 0; attempt < 8; attempt++) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      return blobToBase64(blob);
    }
    quality -= 0.1;
    if (quality < 0.4) break;
  }

  // Downscale loop.
  let downscale = 0.85;
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.max(1, Math.round(canvas.width * downscale));
    const h = Math.max(1, Math.round(canvas.height * downscale));
    const next = document.createElement("canvas");
    next.width = w;
    next.height = h;
    const nctx = next.getContext("2d");
    if (!nctx) throw new Error("Canvas not supported");
    nctx.drawImage(canvas, 0, 0, w, h);

    const blob = await canvasToJpegBlob(next, 0.75);
    if (blob.size <= maxBytes) {
      return blobToBase64(blob);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(next, 0, 0);
    downscale *= 0.9;
  }

  throw new Error(
    `Face image is too large. Please use a smaller/cropped image (max ${Math.round(
      maxBytes / 1024,
    )}KB).`,
  );
}

/**
 * Resizes a base64 image to fit under maxBytes (default 200KB).
 * Used for Excel import where images come as base64.
 */
export async function base64ToResizedBase64(
  base64: string,
  options: Partial<FaceEncodeOptions> = {},
): Promise<string> {
  const { maxBytes, maxDimension } = { ...DEFAULT_FACE_ENCODE, ...options };

  // Decode base64 to check size
  const binaryString = atob(base64);
  const currentBytes = binaryString.length;
  
  // If already small enough, return as-is
  if (currentBytes <= maxBytes) {
    return base64;
  }

  console.log(`[Resize] Image too large: ${Math.round(currentBytes / 1024)}KB, resizing to max ${Math.round(maxBytes / 1024)}KB`);

  // Create image from base64
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = `data:image/jpeg;base64,${base64}`;
  });

  // Calculate scale
  const scale = Math.min(
    1,
    maxDimension / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
  );
  const targetW = Math.max(1, Math.round(img.naturalWidth * scale));
  const targetH = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Try decreasing quality first
  let quality = 0.92;
  for (let attempt = 0; attempt < 8; attempt++) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      console.log(`[Resize] Success at quality ${quality.toFixed(2)}: ${Math.round(blob.size / 1024)}KB`);
      return blobToBase64(blob);
    }
    quality -= 0.08;
    if (quality < 0.4) break;
  }

  // Downscale loop
  let downscale = 0.85;
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.max(1, Math.round(canvas.width * downscale));
    const h = Math.max(1, Math.round(canvas.height * downscale));
    const next = document.createElement("canvas");
    next.width = w;
    next.height = h;
    const nctx = next.getContext("2d");
    if (!nctx) throw new Error("Canvas not supported");
    nctx.drawImage(canvas, 0, 0, w, h);

    const blob = await canvasToJpegBlob(next, 0.8);
    if (blob.size <= maxBytes) {
      console.log(`[Resize] Success after downscale: ${Math.round(blob.size / 1024)}KB`);
      return blobToBase64(blob);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(next, 0, 0);
    downscale *= 0.9;
  }

  throw new Error(`Image could not be resized to under ${Math.round(maxBytes / 1024)}KB`);
}


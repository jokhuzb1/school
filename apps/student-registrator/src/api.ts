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
  stage: string;
  status?: string | null;
  message?: string | null;
  payload?: Record<string, any> | null;
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
  stage?: string;
  status?: string;
  provisioningId?: string;
  studentId?: string;
  deviceId?: string;
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
  console.debug('[Auth] login attempt', { email, backendUrl: BACKEND_URL });
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    console.warn('[Auth] login failed', { status: res.status, error: err.error || 'Login failed' });
    throw new Error(err.error || 'Login failed');
  }
  
  const data = await res.json();
  setAuth(data.token, data.user);
  return data;
}

// ============ Backend API with Auth ============

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const method = options.method || 'GET';
  console.debug('[API] fetchWithAuth', { method, url });
  const res = await fetch(url, { ...options, headers });
  console.debug('[API] response', { method, url, status: res.status, ok: res.ok });
  return res;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return fallback;
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed?.error === "string" && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed?.message === "string" && parsed.message.trim()) return parsed.message.trim();
  } catch {
    // keep raw text
  }
  return text;
}

async function assertSchoolScopedResponse(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  if (res.status === 404) {
    logout();
    throw new Error("Sessiya eskirgan: maktab topilmadi. Qayta login qiling.");
  }
  throw new Error(await readErrorMessage(res, fallback));
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
  classId?: string | null;
  className?: string | null;
  deviceStudentId?: string | null;
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
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to fetch schools'));
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
  if (!res.ok) throw new Error('Failed to fetch students');
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
  if (!res.ok) throw new Error('Failed to fetch student diagnostics');
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
  },
): Promise<SchoolStudent> {
  const res = await fetchWithAuth(`${BACKEND_URL}/students/${studentId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to update student');
  }
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

export async function createSchoolDevice(
  schoolId: string,
  payload: { name: string; deviceId: string; type?: string; location?: string },
): Promise<SchoolDeviceInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/devices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to create backend device');
  }
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
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to update backend device');
  }
  return res.json();
}

export async function deleteSchoolDevice(id: string): Promise<boolean> {
  const res = await fetchWithAuth(`${BACKEND_URL}/devices/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to delete backend device');
  }
  return true;
}

export async function createClass(schoolId: string, name: string, gradeLevel: number): Promise<ClassInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, gradeLevel }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let message = 'Failed to create class';
    try {
      const err = text ? JSON.parse(text) : {};
      message = err.message || err.error || message;
    } catch {
      if (text) message = text;
    }
    throw new Error(`${message} (status ${res.status})`);
  }
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

export async function fetchUsers(deviceId: string): Promise<UserInfoSearchResponse> {
  return invoke<UserInfoSearchResponse>('fetch_users', { 
    deviceId,
    offset: 0,
    limit: 30,
  });
}

export async function deleteUser(
  deviceId: string,
  employeeNo: string,
): Promise<boolean> {
  return invoke<boolean>('delete_user', { deviceId, employeeNo });
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
  if (!res.ok) throw new Error('Failed to fetch provisioning logs');
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
  if (query.stage) params.set('stage', query.stage);
  if (query.status) params.set('status', query.status);
  if (query.provisioningId) params.set('provisioningId', query.provisioningId);
  if (query.studentId) params.set('studentId', query.studentId);
  if (query.deviceId) params.set('deviceId', query.deviceId);
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
  const suffix = params.toString() ? `?${params.toString()}` : '';
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/provisioning-logs${suffix}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Failed to fetch audit logs');
  }
  return res.json();
}

export async function retryProvisioning(
  provisioningId: string,
  deviceIds: string[] = [],
): Promise<{
  ok: boolean;
  updated?: number;
  targetDeviceIds?: string[];
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
export async function syncStudentToDevices(studentId: string): Promise<boolean> {
  const user = getAuthUser();
  if (!user?.schoolId) return false;

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
      return false;
    }

    // 2. Retry the provisioning
    console.debug('[Sync] retry provisioning', { provisioningId: lastLog.provisioningId });
    const result = await retryProvisioning(lastLog.provisioningId);
    console.debug('[Sync] retry result', result);
    return result.ok;
  } catch (err) {
    console.error(`[Sync] Failed to sync student ${studentId}:`, err);
    return false;
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
  let targetW = Math.max(1, Math.round(img.naturalWidth * scale));
  let targetH = Math.max(1, Math.round(img.naturalHeight * scale));

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


export interface DeviceConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface RegisterResult {
  employeeNo: string;
  results: Array<{
    deviceId: string;
    deviceName: string;
    connection: { ok: boolean; message?: string };
    userCreate?: { ok: boolean; statusString?: string; errorMsg?: string };
    faceUpload?: { ok: boolean; statusString?: string; errorMsg?: string };
  }>;
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

const API_BASE = "http://localhost:5050";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export async function fetchDevices(): Promise<DeviceConfig[]> {
  const res = await fetch(`${API_BASE}/devices`);
  const data = await handleResponse<{ devices: DeviceConfig[] }>(res);
  return data.devices;
}

export async function createDevice(
  device: Omit<DeviceConfig, "id">,
): Promise<DeviceConfig> {
  const res = await fetch(`${API_BASE}/devices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(device),
  });
  const data = await handleResponse<{ device: DeviceConfig }>(res);
  return data.device;
}

export async function updateDevice(
  id: string,
  device: Omit<DeviceConfig, "id">,
): Promise<DeviceConfig> {
  const res = await fetch(`${API_BASE}/devices/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(device),
  });
  const data = await handleResponse<{ device: DeviceConfig }>(res);
  return data.device;
}

export async function deleteDevice(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/devices/${id}`, { method: "DELETE" });
  await handleResponse<{ ok: boolean }>(res);
}

export async function registerStudent(formData: FormData): Promise<RegisterResult> {
  const res = await fetch(`${API_BASE}/register`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<RegisterResult>(res);
}

export async function fetchUsers(deviceId: string): Promise<UserInfoSearchResponse> {
  const res = await fetch(`${API_BASE}/users?deviceId=${encodeURIComponent(deviceId)}`);
  return handleResponse<UserInfoSearchResponse>(res);
}

export async function updateUser(
  deviceId: string,
  employeeNo: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/users/${employeeNo}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceId, payload }),
  });
  return handleResponse<Record<string, unknown>>(res);
}

export async function deleteUser(
  deviceId: string,
  employeeNo: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${API_BASE}/users/${employeeNo}?deviceId=${encodeURIComponent(deviceId)}`,
    { method: "DELETE" },
  );
  return handleResponse<Record<string, unknown>>(res);
}

export async function recreateUser(
  deviceId: string,
  employeeNo: string,
  formData: FormData,
): Promise<Record<string, unknown>> {
  formData.append("deviceId", deviceId);
  const res = await fetch(`${API_BASE}/users/${employeeNo}/recreate`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<Record<string, unknown>>(res);
}

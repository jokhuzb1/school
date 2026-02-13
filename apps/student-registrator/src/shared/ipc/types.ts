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

export type LiveStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'OFFLINE'
  | 'EXPIRED'
  | 'UNSENT'
  | 'PENDING'
  | 'ERROR'
  | 'NO_CREDENTIALS';

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

export interface RecreateUserResult {
  employeeNo: string;
  deleteResult: { ok: boolean; statusString?: string; errorMsg?: string };
  createResult: { ok: boolean; statusString?: string; errorMsg?: string };
  faceUpload: { ok: boolean; statusString?: string; errorMsg?: string };
}

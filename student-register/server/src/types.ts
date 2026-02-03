export type Gender = "male" | "female" | "unknown";

export interface DeviceConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface DeviceConnectionResult {
  ok: boolean;
  message?: string;
}

export interface DeviceActionResult {
  ok: boolean;
  statusCode?: number;
  statusString?: string;
  errorMsg?: string;
  raw?: unknown;
}

export interface RegisterDeviceResult {
  deviceId: string;
  deviceName: string;
  connection: DeviceConnectionResult;
  userCreate?: DeviceActionResult;
  faceUpload?: DeviceActionResult;
}

export interface UserInfoEntry {
  employeeNo: string;
  name: string;
  gender?: string;
  numOfFace?: number;
  faceURL?: string;
}

export interface UserInfoSearchResult {
  UserInfoSearch?: {
    numOfMatches?: number;
    totalMatches?: number;
    UserInfo?: UserInfoEntry[];
  };
}

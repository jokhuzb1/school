// Re-export all types
export * from './student.types';
export * from './ui.types';

// Re-export API types
export type {
  DeviceConfig,
  DeviceConnectionResult,
  StudentDeviceLiveCheckResult,
  RegisterResult,
  ProvisioningDetails,
  ProvisioningDeviceLink,
  ProvisioningLogEntry,
  UserInfoEntry,
  UserInfoSearchResponse,
  AuthUser,
  SchoolInfo,
  ClassInfo,
  SchoolStudent,
  SchoolStudentsResponse,
  StudentDeviceDiagnostic,
  StudentDiagnosticsRow,
  StudentDiagnosticsResponse,
  SchoolDeviceInfo,
  RecreateUserResult,
  LiveStatus,
  LiveDeviceResult,
} from '../api';

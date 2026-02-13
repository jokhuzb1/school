export { BACKEND_URL, FETCH_TIMEOUT_MS, FRONTEND_CONTRACT_VERSION, VERBOSE_NETWORK_DEBUG } from './constants';

export {
  ApiRequestError,
  clearApiDebugEntries,
  formatApiErrorMessage,
  getApiDebugEntries,
  getApiDebugReport,
  pushApiDebugEntry,
  toErrorMessage,
} from './debug';
export type { ApiDebugEntry, ApiErrorCode, ApiRequestContext } from './debug';

export type { AuthUser } from './session';
export { getAuthToken, getAuthUser, logout, setAuth } from './session';

export { assertSchoolScopedResponse, buildHttpApiError, fetchWithAuth, login } from './client';

export type {
  ClassInfo,
  SchoolDeviceInfo,
  SchoolInfo,
  SchoolStudent,
  SchoolStudentsResponse,
  StudentDeviceDiagnostic,
  StudentDiagnosticsResponse,
  StudentDiagnosticsRow,
  StudentProfileDetail,
  WebhookInfo,
} from './school-types';

export {
  createClass,
  createSchoolStudent,
  fetchClasses,
  fetchSchoolStudents,
  fetchSchools,
  fetchStudentByDeviceStudentId,
  fetchStudentDiagnostics,
  updateStudentProfile,
} from './schools';

export {
  createSchoolDevice,
  deleteSchoolDevice,
  fetchSchoolDevices,
  getDeviceWebhookHealth,
  getWebhookInfo,
  rotateWebhookSecret,
  testWebhookEndpoint,
  updateSchoolDevice,
} from './school-devices';

export type {
  DeviceImportRowPayload,
  ProvisioningAuditQuery,
  ProvisioningAuditResponse,
  ProvisioningDetails,
  ProvisioningDeviceLink,
  ProvisioningLogEntry,
} from './provisioning';

export {
  commitDeviceImport,
  createImportAuditLog,
  getImportJob,
  getImportMetrics,
  getProvisioningLogs,
  getSchoolProvisioningLogs,
  previewDeviceImport,
  retryImportJob,
} from './provisioning';

export const DEVICE_ERROR_CODES = {
  UNKNOWN: 'UNKNOWN',
  NAME_REQUIRED: 'NAME_REQUIRED',
  CLASS_REQUIRED: 'CLASS_REQUIRED',
  CLASS_NOT_FOUND: 'CLASS_NOT_FOUND',
  DUPLICATE_STUDENT: 'DUPLICATE_STUDENT',
  DEVICE_ID_DUPLICATE: 'DEVICE_ID_DUPLICATE',
  HIKVISION_AUTH: 'HIKVISION_AUTH',
  HIKVISION_EMPLOYEE_NO: 'HIKVISION_EMPLOYEE_NO',
  HIKVISION_USER_CREATE_400: 'HIKVISION_USER_CREATE_400',
  HIKVISION_FACE_UPLOAD: 'HIKVISION_FACE_UPLOAD',
  BACKEND_UNAUTHORIZED: 'BACKEND_UNAUTHORIZED',
  BACKEND_SCHEMA_OLD: 'BACKEND_SCHEMA_OLD',
  MIGRATION_MISSING: 'MIGRATION_MISSING',
  REQUEST_FAILED: 'REQUEST_FAILED',
  TIMEOUT: 'TIMEOUT',
  DEVICE_SYNC_FAILED: 'DEVICE_SYNC_FAILED',
} as const;

export type DeviceErrorCode = (typeof DEVICE_ERROR_CODES)[keyof typeof DEVICE_ERROR_CODES];

export function toSafeUserMessage(input: string, fallback = "Noma'lum xato"): string {
  const message = String(input || '').trim();
  if (!message) return fallback;
  return message
    .replace(/bearer\s+[a-z0-9\-._~+/]+=*/gi, 'Bearer ***')
    .replace(/([?&](?:token|secret|apikey|api_key|password)=)[^&]*/gi, '$1***')
    .slice(0, 600);
}

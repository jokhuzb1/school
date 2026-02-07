export type DetailTab = 'overview' | 'configuration' | 'users' | 'sync';

export type ImportRow = {
  employeeNo: string;
  name: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  gender: 'MALE' | 'FEMALE';
  classId: string;
  parentPhone: string;
  hasFace: boolean;
  studentId?: string;
  faceSynced?: boolean;
  faceError?: string;
  syncResults?: Array<{
    backendDeviceId: string;
    deviceName?: string;
    status: string;
    lastError?: string | null;
  }>;
  status?: 'pending' | 'saved' | 'error';
  error?: string;
};

export type ImportJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

export type ImportJob = {
  id: string;
  status: ImportJobStatus;
  retryCount: number;
  startedAt: string;
  finishedAt?: string;
  lastError?: string;
  processed: number;
  success: number;
  failed: number;
  synced: number;
};

export type ImportPreview = {
  total: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  invalidCount: number;
  duplicateCount: number;
  classErrorCount: number;
};

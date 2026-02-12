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

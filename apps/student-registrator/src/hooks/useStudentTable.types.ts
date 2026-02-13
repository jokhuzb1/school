import type { RegisterResult, StudentRow } from '../types';

export interface UseStudentTableReturn {
  students: StudentRow[];
  addStudent: (student: Omit<StudentRow, 'id' | 'source' | 'status'>) => void;
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  deleteStudent: (id: string) => void;
  importStudents: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => StudentRow[];
  applyClassMapping: (className: string, classId: string, classDisplayName?: string) => void;
  saveStudent: (id: string, targetDeviceIds?: string[]) => Promise<void>;
  saveAllPending: (targetDeviceIds?: string[]) => Promise<{
    successCount: number;
    errorCount: number;
    errorReasons: Record<string, number>;
  }>;
  clearTable: () => void;
  isSaving: boolean;
  lastRegisterResult: RegisterResult | null;
  lastProvisioningId: string | null;
}

export type UseStudentTableOptions = {
  resolveDeviceLabel?: (input: string) => string;
};

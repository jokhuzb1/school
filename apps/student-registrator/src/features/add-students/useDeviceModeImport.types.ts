import type { DeviceConfig, SchoolDeviceInfo, StudentRow } from '../../types';

export type UseDeviceModeImportParams = {
  backendDevices: SchoolDeviceInfo[];
  credentials: DeviceConfig[];
  selectedDeviceIds: string[];
  students: StudentRow[];
  importStudents: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => StudentRow[];
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

export type UseDeviceModeImportReturn = {
  isDeviceImporting: boolean;
  isSourceImportModalOpen: boolean;
  sourceImportDeviceIds: string[];
  refreshingFaceIds: string[];
  openDeviceModeImportModal: () => void;
  closeSourceImportModal: () => void;
  toggleSourceImportDevice: (deviceId: string) => void;
  confirmDeviceModeImport: () => Promise<void>;
  refreshFaceForStudent: (studentId: string) => Promise<boolean>;
};

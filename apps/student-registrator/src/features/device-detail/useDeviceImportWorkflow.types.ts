import type { ClassInfo, DeviceConfig, SchoolDeviceInfo, UserInfoEntry } from '../../api';
import type { ImportJob, ImportPreview, ImportRow } from './types';

export type SyncMode = 'none' | 'current' | 'all' | 'selected';

export type ImportAuditItem = { at: string; stage: string; message: string };

export type ImportMetrics = {
  totalRuns: number;
  totalSuccess: number;
  totalFailed: number;
  totalSynced: number;
  successRate: number;
  retryRate: number;
  meanLatencyMs: number;
};

export type PreviewStats = {
  total: number;
  invalid: number;
  done: number;
  failed: number;
  pending: number;
};

export type UseDeviceImportWorkflowParams = {
  users: UserInfoEntry[];
  schoolDevice: SchoolDeviceInfo | null;
  localDevice: DeviceConfig | null;
  allSchoolDevices: SchoolDeviceInfo[];
  allLocalDevices: DeviceConfig[];
  findLocalForBackend: (backend: SchoolDeviceInfo, localDevices: DeviceConfig[]) => DeviceConfig | null;
  loadUsers: (reset?: boolean) => Promise<void>;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
};

export type UseDeviceImportWorkflowResult = {
  isImportOpen: boolean;
  setIsImportOpen: (next: boolean) => void;
  importRows: ImportRow[];
  importLoading: boolean;
  availableClasses: ClassInfo[];
  importSyncMode: SyncMode;
  setImportSyncMode: (mode: SyncMode) => void;
  importSelectedDeviceIds: string[];
  toggleImportSelectedDevice: (deviceId: string) => void;
  importPullFace: boolean;
  setImportPullFace: (next: boolean) => void;
  importJob: ImportJob | null;
  importAuditTrail: ImportAuditItem[];
  importPreview: ImportPreview | null;
  importMetrics: ImportMetrics | null;
  previewStats: PreviewStats;
  openImportWizard: () => Promise<void>;
  updateImportRow: (index: number, patch: Partial<ImportRow>) => void;
  getImportDeviceStatus: (device: SchoolDeviceInfo) => 'online' | 'offline' | 'no_credentials';
  refreshImportPreview: (rowsOverride?: ImportRow[]) => Promise<void>;
  processImportRows: (targetIndexes?: number[], retryOnly?: boolean) => Promise<void>;
  saveImportRows: () => Promise<void>;
  retryFailedImportRows: () => Promise<void>;
};

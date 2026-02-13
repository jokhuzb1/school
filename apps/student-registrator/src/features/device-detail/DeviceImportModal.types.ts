import type { ClassInfo, SchoolDeviceInfo } from '../../api';
import type { ImportJob, ImportPreview, ImportRow } from './types';

export type ImportSyncMode = 'none' | 'current' | 'all' | 'selected';

type PreviewStats = {
  total: number;
  pending: number;
  done: number;
  failed: number;
  invalid: number;
};

export type DeviceImportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  importLoading: boolean;
  importRows: ImportRow[];
  previewStats: PreviewStats;
  importPreview: ImportPreview | null;
  importMetrics: {
    totalRuns: number;
    totalSuccess: number;
    totalFailed: number;
    totalSynced: number;
    successRate: number;
    retryRate: number;
    meanLatencyMs: number;
  } | null;
  importSyncMode: ImportSyncMode;
  onImportSyncModeChange: (mode: ImportSyncMode) => void;
  importSelectedDeviceIds: string[];
  allSchoolDevices: SchoolDeviceInfo[];
  getImportDeviceStatus: (device: SchoolDeviceInfo) => 'online' | 'offline' | 'no_credentials';
  onToggleImportSelectedDevice: (deviceId: string) => void;
  importPullFace: boolean;
  onImportPullFaceChange: (checked: boolean) => void;
  availableClasses: ClassInfo[];
  updateImportRow: (index: number, patch: Partial<ImportRow>) => void;
  processImportRows: (targetIndexes?: number[], retryOnly?: boolean) => Promise<void>;
  refreshImportPreview: () => Promise<void>;
  saveImportRows: () => Promise<void>;
  retryFailedImportRows: () => Promise<void>;
  importJob: ImportJob | null;
  importAuditTrail: Array<{ at: string; stage: string; message: string }>;
};

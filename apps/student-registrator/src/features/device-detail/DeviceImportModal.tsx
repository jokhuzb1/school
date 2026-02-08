import { Icons } from '../../components/ui/Icons';
import type { ClassInfo, SchoolDeviceInfo } from '../../api';
import type { ImportJob, ImportPreview, ImportRow } from './types';

type ImportSyncMode = 'none' | 'current' | 'all' | 'selected';

type PreviewStats = {
  total: number;
  pending: number;
  done: number;
  failed: number;
  invalid: number;
};

type DeviceImportModalProps = {
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

export function DeviceImportModal({
  isOpen,
  onClose,
  importLoading,
  importRows,
  previewStats,
  importPreview,
  importMetrics,
  importSyncMode,
  onImportSyncModeChange,
  importSelectedDeviceIds,
  allSchoolDevices,
  getImportDeviceStatus,
  onToggleImportSelectedDevice,
  importPullFace,
  onImportPullFaceChange,
  availableClasses,
  updateImportRow,
  processImportRows,
  refreshImportPreview,
  saveImportRows,
  retryFailedImportRows,
  importJob,
  importAuditTrail,
}: DeviceImportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-provisioning" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Device Users Import (DB)</h3>
            <p className="text-secondary text-xs">Qolgan maydonlarni to'ldirib, batch saqlang.</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <Icons.X />
          </button>
        </div>
        <div className="modal-body">
          <div className="notice">EmployeeNo, ism/familiya, sinf majburiy.</div>
          <div className="device-item-meta" style={{ marginBottom: 8 }}>
            <span className="badge">Total: {previewStats.total}</span>
            <span className="badge">Pending: {previewStats.pending}</span>
            <span className="badge badge-success">Saved: {previewStats.done}</span>
            <span className={`badge ${previewStats.failed > 0 ? 'badge-danger' : ''}`}>Failed: {previewStats.failed}</span>
            <span className={`badge ${previewStats.invalid > 0 ? 'badge-danger' : ''}`}>Invalid: {previewStats.invalid}</span>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => void refreshImportPreview()}
              disabled={importLoading}
            >
              <Icons.Refresh /> Previewni yangilash
            </button>
          </div>
          {importPreview && (
            <div className="device-item-meta" style={{ marginBottom: 8 }}>
              <span className="badge">Create: {importPreview.createCount}</span>
              <span className="badge">Update: {importPreview.updateCount}</span>
              <span className="badge">Skip: {importPreview.skipCount}</span>
              <span className={`badge ${importPreview.invalidCount > 0 ? 'badge-danger' : ''}`}>
                Invalid: {importPreview.invalidCount}
              </span>
              <span className={`badge ${importPreview.duplicateCount > 0 ? 'badge-danger' : ''}`}>
                Dup: {importPreview.duplicateCount}
              </span>
              <span className={`badge ${importPreview.classErrorCount > 0 ? 'badge-danger' : ''}`}>
                Class error: {importPreview.classErrorCount}
              </span>
            </div>
          )}
          {importMetrics && (
            <div className="notice" style={{ marginBottom: 8 }}>
              Metrics: success {(importMetrics.successRate * 100).toFixed(1)}% | retry {(importMetrics.retryRate * 100).toFixed(1)}% | mean latency {Math.round(importMetrics.meanLatencyMs)} ms
            </div>
          )}
          <div className="form-group" style={{ marginTop: 10 }}>
            <label>Saqlash siyosati (Sync mode)</label>
            <select
              className="input"
              value={importSyncMode}
              onChange={(e) => onImportSyncModeChange(e.target.value as ImportSyncMode)}
            >
              <option value="none">Faqat DB</option>
              <option value="current">DB + joriy qurilma</option>
              <option value="all">DB + barcha active qurilmalar</option>
              <option value="selected">DB + tanlangan qurilmalar</option>
            </select>
          </div>
          {importSyncMode === 'selected' && (
            <div className="card" style={{ marginBottom: 10 }}>
              <div className="panel-header">
                <div className="panel-title">Target qurilmalar</div>
              </div>
              <div className="device-list">
                {allSchoolDevices.map((device) => {
                  const checked = importSelectedDeviceIds.includes(device.id);
                  const status = getImportDeviceStatus(device);
                  return (
                    <label key={device.id} className="device-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleImportSelectedDevice(device.id)}
                      />
                      <span>{device.name}</span>
                      <span
                        className={`badge ${
                          status === 'online' ? 'badge-success' : status === 'offline' ? 'badge-danger' : 'badge-warning'
                        }`}
                      >
                        {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'No credentials'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <label className="checkbox" style={{ marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={importPullFace}
              onChange={(e) => onImportPullFaceChange(e.target.checked)}
            />
            <span>Qurilmadagi mavjud rasmni ham olib `photoUrl`ga sync qilish</span>
          </label>
          <div style={{ maxHeight: 420, overflow: 'auto', marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>EmployeeNo</th>
                  <th>Ism</th>
                  <th>Familiya</th>
                  <th>Otasining ismi</th>
                  <th>Sinf</th>
                  <th>Jins</th>
                  <th>Face</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                {importRows.map((row, idx) => (
                  <tr key={`${row.employeeNo}-${idx}`}>
                    <td>{row.employeeNo}</td>
                    <td>
                      <input className="input" value={row.firstName} onChange={(e) => updateImportRow(idx, { firstName: e.target.value })} />
                    </td>
                    <td>
                      <input className="input" value={row.lastName} onChange={(e) => updateImportRow(idx, { lastName: e.target.value })} />
                    </td>
                    <td>
                      <input className="input" value={row.fatherName} onChange={(e) => updateImportRow(idx, { fatherName: e.target.value })} />
                    </td>
                    <td>
                      <select className="input" value={row.classId} onChange={(e) => updateImportRow(idx, { classId: e.target.value })}>
                        <option value="">Tanlang</option>
                        {availableClasses.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select className="input" value={row.gender} onChange={(e) => updateImportRow(idx, { gender: e.target.value as 'MALE' | 'FEMALE' })}>
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${row.hasFace ? 'badge-success' : 'badge-warning'}`}>
                        {row.hasFace ? 'Bor' : "Yo'q"}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          row.status === 'saved'
                            ? 'badge-success'
                            : row.status === 'error'
                            ? 'badge-danger'
                            : ''
                        }`}
                      >
                        {row.status || 'pending'}
                      </span>
                      {row.error && <div className="text-xs text-danger">{row.error}</div>}
                      {row.syncResults && row.syncResults.length > 0 && (
                        <div className="text-xs">
                          {row.syncResults.map((result) => (
                            <div key={`${row.employeeNo}-${result.backendDeviceId}`}>
                              {(result.deviceName || result.backendDeviceId)}: {result.status}
                              {result.lastError ? ` (${result.lastError})` : ''}
                            </div>
                          ))}
                        </div>
                      )}
                      {row.status === 'error' && (
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ marginTop: 6 }}
                          onClick={() => void processImportRows([idx], true)}
                          disabled={importLoading}
                        >
                          Retry row
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-footer">
          {importJob && (
            <div className="notice" style={{ marginRight: 'auto' }}>
              Job: {importJob.status} | processed {importJob.processed} | success {importJob.success} | failed {importJob.failed} | synced {importJob.synced}
            </div>
          )}
          <button
            type="button"
            className="button button-primary"
            onClick={() => void saveImportRows()}
            disabled={importLoading || importRows.length === 0}
          >
            <Icons.Save /> {importLoading ? 'Saqlanmoqda...' : 'DB ga saqlash'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void retryFailedImportRows()}
            disabled={importLoading || importRows.every((item) => item.status !== 'error')}
          >
            <Icons.Refresh /> Failedlarni retry
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={importLoading}
          >
            Yopish
          </button>
        </div>
        {importAuditTrail.length > 0 && (
          <div className="modal-body" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="panel-title">Audit trail</div>
            <div style={{ maxHeight: 120, overflow: 'auto' }}>
              {importAuditTrail.map((item, idx) => (
                <div key={`${item.at}-${idx}`} className="text-xs">
                  [{new Date(item.at).toLocaleTimeString()}] {item.stage}: {item.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

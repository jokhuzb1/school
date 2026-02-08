import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAuthUser, getSchoolProvisioningLogs, retryProvisioning } from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { Icons } from '../components/ui/Icons';
import type { ProvisioningLogEntry, ProvisioningAuditQuery } from '../api';

const PAGE_SIZE = 50;
const STAGE_OPTIONS = [
  { value: '', label: 'Barchasi' },
  { value: 'PROVISIONING_START', label: 'Boshlash' },
  { value: 'DEVICE_RESULT', label: 'Qurilma natijasi' },
  { value: 'RETRY', label: 'Qayta urinish' },
] as const;

const STATUS_OPTIONS = [
  { value: '', label: 'Barchasi' },
  { value: 'SUCCESS', label: 'Muvaffaqiyatli' },
  { value: 'FAILED', label: 'Xatolik' },
  { value: 'PROCESSING', label: 'Jarayonda' },
  { value: 'PENDING', label: 'Kutilmoqda' },
  { value: 'PARTIAL', label: 'Qisman' },
  { value: 'CONFIRMED', label: 'Tasdiqlangan' },
] as const;

function formatStudentName(log: ProvisioningLogEntry): string {
  if (log.student?.lastName || log.student?.firstName) {
    return [log.student?.lastName, log.student?.firstName].filter(Boolean).join(' ');
  }
  if (log.student?.name) return log.student.name;
  return '-';
}

function getLevelLabel(level: string): string {
  const value = String(level || '').toUpperCase();
  if (value === 'INFO') return "Ma'lumot";
  if (value === 'WARN') return 'Ogohlantirish';
  if (value === 'ERROR') return 'Xatolik';
  return "Noma'lum";
}

function getStageLabel(stage: string): string {
  const value = String(stage || '').toUpperCase();
  if (value === 'PROVISIONING_START') return 'Boshlash';
  if (value === 'DEVICE_RESULT') return 'Qurilma natijasi';
  if (value === 'RETRY') return 'Qayta urinish';
  return "Noma'lum";
}

function getStatusLabel(status?: string | null): string {
  const value = String(status || '').toUpperCase();
  if (!value) return '-';
  if (value === 'SUCCESS') return 'Muvaffaqiyatli';
  if (value === 'FAILED') return 'Xatolik';
  if (value === 'PROCESSING') return 'Jarayonda';
  if (value === 'PENDING') return 'Kutilmoqda';
  if (value === 'PARTIAL') return 'Qisman';
  if (value === 'CONFIRMED') return 'Tasdiqlangan';
  return "Noma'lum";
}

function levelTone(level: string): 'info' | 'warn' | 'error' {
  const value = String(level || '').toUpperCase();
  if (value === 'WARN') return 'warn';
  if (value === 'ERROR') return 'error';
  return 'info';
}

function stageTone(stage: string): 'info' | 'warn' | 'error' {
  const value = String(stage || '').toUpperCase();
  if (value === 'RETRY') return 'warn';
  return 'info';
}

function statusTone(status?: string | null): 'success' | 'warn' | 'error' | 'info' {
  const value = String(status || '').toUpperCase();
  if (value === 'SUCCESS' || value === 'CONFIRMED') return 'success';
  if (value === 'FAILED') return 'error';
  if (value === 'PROCESSING' || value === 'PENDING' || value === 'PARTIAL') return 'warn';
  return 'info';
}

type RetryTarget = {
  provisioningId: string;
  deviceIds: string[];
};

function getRetryTargetByLogType(log: ProvisioningLogEntry): RetryTarget | null {
  if (!log.provisioningId) return null;
  const stage = String(log.stage || '').toUpperCase();
  const status = String(log.status || '').toUpperCase();

  if (stage === 'DEVICE_RESULT') {
    if (status !== 'FAILED') return null;
    return {
      provisioningId: log.provisioningId,
      deviceIds: log.deviceId ? [log.deviceId] : [],
    };
  }

  if (stage === 'PROVISIONING_START') {
    if (status !== 'FAILED' && status !== 'PARTIAL') return null;
    return {
      provisioningId: log.provisioningId,
      deviceIds: [],
    };
  }

  return null;
}

export function AuditLogsPage() {
  const { addToast } = useGlobalToast();
  const user = getAuthUser();
  const schoolId = user?.schoolId || '';

  const [logs, setLogs] = useState<ProvisioningLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [draftQ, setDraftQ] = useState('');
  const [draftLevel, setDraftLevel] = useState<ProvisioningAuditQuery['level']>('');
  const [draftStage, setDraftStage] = useState('');
  const [draftStatus, setDraftStatus] = useState('');

  const [filters, setFilters] = useState<ProvisioningAuditQuery>({});

  const totalPages = useMemo(() => {
    if (total === 0) return 1;
    return Math.ceil(total / PAGE_SIZE);
  }, [total]);

  const fetchLogs = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getSchoolProvisioningLogs(schoolId, {
        ...filters,
        page,
        limit: PAGE_SIZE,
      });
      setLogs(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addToast('Audit loglarni yuklashda xato', 'error');
    } finally {
      setLoading(false);
    }
  }, [schoolId, filters, page, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setFilters({
        q: draftQ.trim() || undefined,
        level: draftLevel || undefined,
        stage: draftStage.trim() || undefined,
        status: draftStatus.trim() || undefined,
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draftQ, draftLevel, draftStage, draftStatus]);

  const resetFilters = () => {
    setDraftQ('');
    setDraftLevel('');
    setDraftStage('');
    setDraftStatus('');
    setPage(1);
    setFilters({});
  };

  const handleRetryFromLog = async (log: ProvisioningLogEntry) => {
    const target = getRetryTargetByLogType(log);
    if (!target) return;
    setRetryingId(log.id);
    try {
      const result = await retryProvisioning(target.provisioningId, target.deviceIds);
      const checked = result.connectionCheck?.checked ?? 0;
      const failed = result.connectionCheck?.failed ?? 0;
      const missing = result.connectionCheck?.missingCredentials ?? 0;
      addToast(
        `Qayta urinish yuborildi. Tekshirildi: ${checked}, ulanish xato: ${failed}, sozlama yo'q: ${missing}`,
        failed > 0 || missing > 0 ? 'error' : 'success',
      );
      await fetchLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Qayta urinishda xato: ${message}`, 'error');
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Loglar</h1>
          <p className="page-description">Provisioning va retry bo'yicha tizim audit tarixi</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="device-select-trigger"
            onClick={fetchLogs}
            disabled={loading}
          >
            <Icons.Refresh />
            <span>Yangilash</span>
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="form-group">
          <label>Qidirish</label>
          <input
            className="input"
            placeholder="Xabar, stage, provisioning ID..."
            value={draftQ}
            onChange={(e) => setDraftQ(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Level</label>
          <select
            className="input"
            value={draftLevel}
            onChange={(e) => setDraftLevel(e.target.value as ProvisioningAuditQuery['level'])}
          >
            <option value="">Barchasi</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
          </select>
        </div>
        <div className="form-group">
          <label>Stage</label>
          <select className="input" value={draftStage} onChange={(e) => setDraftStage(e.target.value)}>
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value || 'all-stage'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select className="input" value={draftStatus} onChange={(e) => setDraftStatus(e.target.value)}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value || 'all-status'} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ alignSelf: 'flex-end', display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn-icon"
            onClick={resetFilters}
            title="Filtrlarni tozalash"
            aria-label="Filtrlarni tozalash"
          >
            <Icons.X />
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-label">Jami log:</span>
          <span className="stat-value">{total}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Sahifa:</span>
          <span className="stat-value">{page}/{totalPages}</span>
        </div>
      </div>

      <div className="page-content">
        {error && <div className="notice notice-error">{error}</div>}
        {loading ? (
          <div className="loading-state">Yuklanmoqda...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <Icons.FileSpreadsheet />
            <p>Audit log topilmadi</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Vaqt</th>
                  <th>Level</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>O'quvchi</th>
                  <th>Qurilma</th>
                  <th>Xabar</th>
                  <th>Provisioning</th>
                  <th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const retryTarget = getRetryTargetByLogType(log);
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td>
                        <span className={`log-chip log-chip-${levelTone(log.level)}`}>
                          {getLevelLabel(log.level)}
                        </span>
                      </td>
                      <td>
                        <span className={`log-chip log-chip-${stageTone(log.stage)}`}>
                          {getStageLabel(log.stage)}
                        </span>
                      </td>
                      <td>
                        <span className={`log-chip log-chip-${statusTone(log.status)}`}>
                          {getStatusLabel(log.status)}
                        </span>
                      </td>
                      <td>{formatStudentName(log)}</td>
                      <td>{log.device?.name || log.deviceId || '-'}</td>
                      <td>{log.message || '-'}</td>
                      <td>{log.provisioningId || '-'}</td>
                      <td>
                        {retryTarget ? (
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleRetryFromLog(log)}
                            disabled={loading || retryingId === log.id}
                          >
                            <Icons.Refresh />
                            {retryingId === log.id ? 'Yuborilmoqda...' : 'Qayta urinish'}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="page-actions" style={{ marginTop: '1rem', justifyContent: 'space-between' }}>
        <button
          type="button"
          className="button button-secondary"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Oldingi
        </button>
        <button
          type="button"
          className="button button-secondary"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Keyingi
        </button>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getProvisioning, getProvisioningLogs, retryProvisioning } from '../../api';
import { Icons } from '../ui/Icons';
import type { ProvisioningDetails, ProvisioningLogEntry, RegisterResult } from '../../types';
import { useGlobalToast } from '../../hooks/useToast';

interface ProvisioningPanelProps {
  provisioningId?: string | null;
  registerResult?: RegisterResult | null;
}

export function ProvisioningPanel({
  provisioningId,
  registerResult,
}: ProvisioningPanelProps) {
  const { addToast } = useGlobalToast();
  const [details, setDetails] = useState<ProvisioningDetails | null>(null);
  const [logs, setLogs] = useState<ProvisioningLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'devices' | 'logs'>('devices');

  const fetchDetails = useCallback(async () => {
    if (!provisioningId) return;
    setLoading(true);
    setError(null);
    try {
      const [data, logData] = await Promise.all([
        getProvisioning(provisioningId),
        getProvisioningLogs(provisioningId),
      ]);
      setDetails(data);
      setLogs(logData);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [provisioningId]);

  useEffect(() => {
    if (!provisioningId) {
      setDetails(null);
      setLogs([]);
      setError(null);
      return;
    }
    fetchDetails();
    // Default to logs if we are looking at logs or if there are issues
    if (activeTab === 'devices' && details?.status === 'FAILED') {
      // stay on devices to see failures
    }
  }, [provisioningId, fetchDetails]);

  const summary = useMemo(() => {
    if (!details?.devices) return null;
    const total = details.devices.length;
    const success = details.devices.filter((d) => d.status === 'SUCCESS').length;
    const failed = details.devices.filter((d) => d.status === 'FAILED').length;
    const pending = details.devices.filter((d) => d.status === 'PENDING').length;
    return { total, success, failed, pending };
  }, [details]);


  const retryFailed = useCallback(async () => {
    if (!provisioningId || !details?.devices) return;
    const failed = details.devices
      .filter((d) => d.status === 'FAILED')
      .map((d) => d.deviceId);
    if (failed.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await retryProvisioning(provisioningId, failed);
      const checked = result.connectionCheck?.checked ?? 0;
      const failedChecks = result.connectionCheck?.failed ?? 0;
      const missing = result.connectionCheck?.missingCredentials ?? 0;
      addToast(
        `Retry yuborildi. Tekshirildi: ${checked}, ulanish xato: ${failedChecks}, sozlama yo'q: ${missing}`,
        failedChecks > 0 || missing > 0 ? 'error' : 'success',
      );
      await fetchDetails();
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [details, fetchDetails, provisioningId, addToast]);

  if (!provisioningId && !registerResult) return null;

  return (
    <div className="provisioning-details-container">
      {/* Summary Grid */}
      {summary && (
        <div className="provisioning-summary-grid">
          <div className="provisioning-stat">
            <span className="provisioning-stat-label">Jami</span>
            <span className="provisioning-stat-value">{summary.total}</span>
          </div>
          <div className="provisioning-stat">
            <span className="provisioning-stat-label">Muvaffaqiyat</span>
            <span className="provisioning-stat-value success">{summary.success}</span>
          </div>
          <div className="provisioning-stat">
            <span className="provisioning-stat-label">Xato</span>
            <span className="provisioning-stat-value danger">{summary.failed}</span>
          </div>
          <div className="provisioning-stat">
            <span className="provisioning-stat-label">Kutilmoqda</span>
            <span className="provisioning-stat-value warning">{summary.pending}</span>
          </div>
        </div>
      )}

      {error && <div className="notice notice-error">{error}</div>}

      <div className="tabs">
        <div 
          className={`tab ${activeTab === 'devices' ? 'active' : ''}`}
          onClick={() => setActiveTab('devices')}
        >
          Qurilmalar ({details?.devices?.length || 0})
        </div>
        <div 
          className={`tab ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Loglar ({logs.length})
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-icon btn-compact"
            onClick={fetchDetails}
            disabled={loading}
            title="Yangilash"
            aria-label="Yangilash"
          >
            <Icons.Refresh />
          </button>
          {summary?.failed ? (
            <button
              type="button"
              className="button button-secondary button-compact"
              onClick={retryFailed}
              disabled={loading}
            >
              <Icons.Refresh /> Failed Qayta
            </button>
          ) : null}
        </div>
      </div>

      <div className="provisioning-tab-content">
        {activeTab === 'devices' && (
          <div className="table-container">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Qurilma</th>
                  <th>Holat</th>
                  <th>Xato</th>
                </tr>
              </thead>
              <tbody>
                {details?.devices?.map((link) => (
                  <tr key={link.id}>
                    <td className="font-medium">{link.device?.name || link.deviceId}</td>
                    <td>
                      <span className={`badge badge-${
                        link.status === 'SUCCESS' ? 'success' : 
                        link.status === 'FAILED' ? 'danger' : 'warning'
                      }`}>
                        {link.status}
                      </span>
                    </td>
                    <td className="text-secondary">{link.lastError || '-'}</td>
                  </tr>
                ))}
                {!details?.devices?.length && (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-muted">A'lumot yo'q</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="table-container">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Vaqt</th>
                  <th>Bosqich</th>
                  <th>Xabar</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 50).map((log) => (
                  <tr key={log.id}>
                    <td className="whitespace-nowrap">{new Date(log.createdAt).toLocaleTimeString()}</td>
                    <td className="whitespace-nowrap">
                      <span className={`badge ${
                        log.level === 'ERROR' ? 'badge-danger' : 
                        log.level === 'WARN' ? 'badge-warning' : 'badge-primary'
                      }`}>
                        {log.stage}
                      </span>
                    </td>
                    <td className="text-secondary">{log.message || '-'}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-center py-4 text-muted">Hozircha loglar yo'q</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAuthUser, getSchoolProvisioningLogs, retryProvisioning } from "../api";
import type { ProvisioningAuditQuery, ProvisioningLogEntry } from "../api";
import { Icons } from "../components/ui/Icons";
import { useGlobalToast } from "../hooks/useToast";
import { useModalA11y } from "../hooks/useModalA11y";
import { redactSensitiveData } from "../utils/redact";
import {
  downloadCsv,
  formatStudentName,
  getRetryTargetByLogType,
  levelTone,
  PAGE_SIZE,
  statusTone,
} from "./audit-logs/helpers";

export function AuditLogsPage() {
  const { addToast } = useGlobalToast();
  const user = getAuthUser();
  const schoolId = user?.schoolId || "";
  const [logs, setLogs] = useState<ProvisioningLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<ProvisioningLogEntry | null>(null);
  const { dialogRef, onDialogKeyDown } = useModalA11y(Boolean(selectedPayload), () => setSelectedPayload(null));

  const [draftQ, setDraftQ] = useState("");
  const [draftLevel, setDraftLevel] = useState<ProvisioningAuditQuery["level"]>("");
  const [filters, setFilters] = useState<ProvisioningAuditQuery>({});

  const totalPages = useMemo(() => (total === 0 ? 1 : Math.ceil(total / PAGE_SIZE)), [total]);

  const fetchLogs = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await getSchoolProvisioningLogs(schoolId, { ...filters, page, limit: PAGE_SIZE });
      setLogs(response.data);
      setTotal(response.total);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addToast("Audit loglarni yuklashda xato", "error");
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
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [draftQ, draftLevel]);

  const resetFilters = () => {
    setDraftQ("");
    setDraftLevel("");
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
        failed > 0 || missing > 0 ? "error" : "success",
      );
      await fetchLogs();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      addToast(`Qayta urinishda xato: ${message}`, "error");
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="header-main">
          <h1 className="page-title">Audit Loglar</h1>
          <p className="page-description">Auth, CRUD, provisioning va security audit tarixi</p>
        </div>
        <div className="page-actions">
          <button type="button" className="button button-secondary" onClick={fetchLogs} disabled={loading}>
            <Icons.Refresh />
            <span>Yangilash</span>
          </button>
          <button type="button" className="button button-secondary" onClick={() => downloadCsv(logs)}>
            <Icons.Download />
            <span>CSV export</span>
          </button>
        </div>
      </div>

      <div className="filter-bar-integrated">
        <div className="filter-item search-group">
          <div className="input-with-icon">
            <Icons.Search />
            <input className="input" placeholder="Xabar, hodisa, foydalanuvchi..." value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
          </div>
        </div>
        <div className="filter-item">
          <select className="select" value={draftLevel} onChange={(e) => setDraftLevel(e.target.value as ProvisioningAuditQuery["level"])}>
            <option value="">Barcha darajalar</option>
            <option value="INFO">Ma'lumot</option>
            <option value="WARN">Ogohlantirish</option>
            <option value="ERROR">Xato</option>
          </select>
        </div>
        <div className="filter-item actions-group">
          <button type="button" className="button button-secondary" onClick={resetFilters} title="Filtrlarni tozalash" aria-label="Filtrlarni tozalash">
            <Icons.X />
          </button>
        </div>
      </div>

      <div className="stats-bar">
        <div className="stat-item"><span className="stat-label">Jami log:</span><span className="stat-value">{total}</span></div>
        <div className="stat-item"><span className="stat-label">Sahifa:</span><span className="stat-value">{page}/{totalPages}</span></div>
      </div>

      <div className="page-content">
        {error && <div className="notice notice-error">{error}</div>}
        {loading ? (
          <div className="loading-state">Yuklanmoqda...</div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><Icons.FileSpreadsheet /><p>Audit log topilmadi</p></div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Vaqt</th><th>Level</th><th>Event</th><th>Status</th><th>Actor</th><th>O'quvchi</th><th>Qurilma</th><th>Xabar</th><th>Payload</th><th>Amal</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const retryTarget = getRetryTargetByLogType(log);
                  return (
                    <tr key={log.id}>
                      <td>{new Date(log.createdAt).toLocaleString()}</td>
                      <td><span className={`log-chip log-chip-${levelTone(log.level)}`}>{log.level}</span></td>
                      <td>{log.eventType || log.stage}</td>
                      <td><span className={`log-chip log-chip-${statusTone(log.status)}`}>{log.status || "-"}</span></td>
                      <td>{log.actorName || log.actorId || "-"}</td>
                      <td>{formatStudentName(log)}</td>
                      <td>{log.device?.name || log.deviceId || "-"}</td>
                      <td>{log.message || "-"}</td>
                      <td>
                        <button type="button" className="button button-secondary" onClick={() => setSelectedPayload(log)}>
                          Ko'rish
                        </button>
                      </td>
                      <td>
                        {retryTarget ? (
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={() => handleRetryFromLog(log)}
                            disabled={loading || retryingId === log.id}
                          >
                            <Icons.Refresh />
                            {retryingId === log.id ? "Yuborilmoqda..." : "Qayta urinish"}
                          </button>
                        ) : (
                          "-"
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

      <div className="page-actions" style={{ marginTop: "1rem", justifyContent: "space-between" }}>
        <button type="button" className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Oldingi
        </button>
        <button type="button" className="button button-secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>
          Keyingi
        </button>
      </div>

      {selectedPayload && (
        <div className="modal-overlay" onClick={() => setSelectedPayload(null)}>
          <div
            ref={dialogRef}
            className="modal-content"
            style={{ maxWidth: "900px" }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Audit payload"
            tabIndex={-1}
          >
            <div className="modal-header">
              <h2>Audit Payload</h2>
              <button type="button" className="btn-icon" onClick={() => setSelectedPayload(null)} aria-label="Yopish"><Icons.X /></button>
            </div>
            <pre style={{ maxHeight: "480px", overflow: "auto", margin: 0 }}>
              {JSON.stringify(redactSensitiveData(selectedPayload.payload || {}), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

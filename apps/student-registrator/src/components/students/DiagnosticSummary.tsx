import { useState } from 'react';
import type { SchoolDeviceInfo, StudentDiagnosticsRow, LiveDeviceResult, LiveStatus } from '../../types';

interface DiagnosticSummaryProps {
  row: StudentDiagnosticsRow;
  backendDevices: SchoolDeviceInfo[];
  liveState: { running: boolean; byDeviceId: Record<string, LiveDeviceResult> } | undefined;
  mapBackendStatus: (row: StudentDiagnosticsRow) => Record<string, LiveDeviceResult>;
  formatDateTime: (value?: string) => string;
  statusBadgeClass: (status: LiveStatus) => string;
  statusLabel: (status: LiveStatus) => string;
  statusReason: (status: LiveStatus, message?: string | null) => string;
  summarizeStatuses: (statuses: LiveDeviceResult[], running: boolean) => string;
}

export function DiagnosticSummary({
  row,
  backendDevices,
  liveState,
  mapBackendStatus,
  formatDateTime,
  statusBadgeClass,
  statusLabel,
  statusReason,
  summarizeStatuses,
}: DiagnosticSummaryProps) {
  const [openPopover, setOpenPopover] = useState(false);
  
  const effectiveByDevice = liveState?.byDeviceId || mapBackendStatus(row);
  const statusList = backendDevices.map(
    (device) => effectiveByDevice[device.id] || { status: 'UNSENT' as LiveStatus },
  );
  const summary = summarizeStatuses(statusList, Boolean(liveState?.running));

  return (
    <div className={`diagnostics-hover ${openPopover ? 'is-open' : ''}`}>
      <button
        type="button"
        className={`diagnostics-trigger badge ${summary.startsWith('OK') ? 'badge-success' : 'badge-warning'}`}
        onClick={() => setOpenPopover(!openPopover)}
      >
        {summary}
      </button>
      
      <div className="diagnostics-popover">
        <div className="diagnostics-popover-title">
          Qurilmalar holati
        </div>
        <div className="diagnostics-popover-list">
          {backendDevices.map((device) => {
            const result = effectiveByDevice[device.id] || { status: 'UNSENT' as LiveStatus };
            return (
              <div key={`${row.studentId}-${device.id}`} className="diagnostics-popover-item">
                <div className="diagnostics-popover-head">
                  <span className="diagnostics-device-name">{device.name}</span>
                  <span className={statusBadgeClass(result.status)}>
                    {statusLabel(result.status)}
                  </span>
                </div>
                <div className="diagnostics-popover-meta">
                  <span><b>Sabab:</b> {statusReason(result.status, result.message)}</span>
                  <span><b>Vaqt:</b> {formatDateTime(result.checkedAt)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

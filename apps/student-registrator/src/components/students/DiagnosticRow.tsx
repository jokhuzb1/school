import { useState } from 'react';
import { Icons } from '../ui/Icons';
import type { StudentDiagnosticsRow, LiveDeviceResult, LiveStatus } from '../../types';

interface DiagnosticRowProps {
  row: StudentDiagnosticsRow;
  backendDevices: any[];
  liveState: { running: boolean; byDeviceId: Record<string, LiveDeviceResult> } | undefined;
  onRunCheck: (row: StudentDiagnosticsRow) => void;
  onEdit: (row: StudentDiagnosticsRow) => void;
  mapBackendStatus: (row: StudentDiagnosticsRow) => Record<string, LiveDeviceResult>;
  formatDateTime: (value?: string) => string;
  statusBadgeClass: (status: LiveStatus) => string;
  statusLabel: (status: LiveStatus) => string;
  statusReason: (status: LiveStatus, message?: string | null) => string;
  summarizeStatuses: (statuses: LiveDeviceResult[], running: boolean) => string;
}

export function DiagnosticRow({
  row,
  backendDevices,
  liveState,
  onRunCheck,
  onEdit,
  mapBackendStatus,
  formatDateTime,
  statusBadgeClass,
  statusLabel,
  statusReason,
  summarizeStatuses,
}: DiagnosticRowProps) {
  const [openPopover, setOpenPopover] = useState(false);
  
  const effectiveByDevice = liveState?.byDeviceId || mapBackendStatus(row);
  const statusList = backendDevices.map(
    (device) => effectiveByDevice[device.id] || { status: 'UNSENT' as LiveStatus },
  );
  const summary = summarizeStatuses(statusList, Boolean(liveState?.running));

  return (
    <tr className={liveState?.running ? 'row-checking' : ''}>
      <td className="font-medium">{row.studentName}</td>
      <td>{row.className || '-'}</td>
      <td className="text-secondary">{row.deviceStudentId || '-'}</td>
      <td>
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
      </td>
      <td>
        <div className="action-buttons">
          <button
            className="button button-info button-compact"
            onClick={() => onRunCheck(row)}
            disabled={Boolean(liveState?.running)}
            title="Jonli tekshirish"
          >
            <Icons.Refresh />
          </button>
          <button
            className="button button-secondary button-compact"
            onClick={() => onEdit(row)}
            title="Tahrirlash"
          >
            <Icons.Edit />
          </button>
        </div>
      </td>
    </tr>
  );
}

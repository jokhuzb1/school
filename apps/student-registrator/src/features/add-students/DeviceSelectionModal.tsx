import { Icons } from '../../components/ui/Icons';
import type { SchoolDeviceInfo } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { getDeviceSelectionStatusLabel, type DeviceSelectionStatus } from '../../utils/deviceStatus';

type DeviceSelectionModalProps = {
  isOpen: boolean;
  title: string;
  devices: SchoolDeviceInfo[];
  selectedIds: string[];
  onToggle: (deviceId: string) => void;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  confirmLabel: string;
  busy?: boolean;
  busyLabel?: string;
  statuses?: Record<string, DeviceSelectionStatus>;
  disableConfirm?: boolean;
};

export function DeviceSelectionModal({
  isOpen,
  title,
  devices,
  selectedIds,
  onToggle,
  onClose,
  onConfirm,
  confirmLabel,
  busy = false,
  busyLabel = 'Jarayon davom etmoqda...',
  statuses,
  disableConfirm = false,
}: DeviceSelectionModalProps) {
  const { dialogRef, onDialogKeyDown } = useModalA11y(isOpen, onClose, busy);
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Yopish">
            <Icons.X />
          </button>
        </div>
        <div className="modal-body">
          <div className="device-list">
            {devices.map((device) => {
              const checked = selectedIds.includes(device.id);
              const status = statuses?.[device.id] || 'unknown';
              return (
                <label
                  key={device.id}
                  className="device-item"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(device.id)}
                    disabled={busy}
                  />
                  <span>{device.name}</span>
                  {statuses && (
                    <span
                      className={`badge ${
                        status === 'online' ? 'badge-success' : status === 'offline' ? 'badge-danger' : ''
                      }`}
                    >
                      {getDeviceSelectionStatusLabel(status)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          <button className="button button-primary" onClick={() => void onConfirm()} disabled={busy || disableConfirm}>
            {busy ? busyLabel : confirmLabel}
          </button>
          <button className="button button-secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
}

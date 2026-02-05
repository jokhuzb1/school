import { useEffect, useMemo, useRef } from 'react';
import { Icons } from '../ui/Icons';
import type { SchoolDeviceInfo } from '../../types';

export type DeviceStatus = 'online' | 'offline' | 'unknown';

interface DeviceTargetsPanelProps {
  devices: SchoolDeviceInfo[];
  selectedIds: string[];
  statusById: Record<string, DeviceStatus>;
  onToggle: (deviceId: string) => void;
  onToggleAll: (next: boolean) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function DeviceTargetsPanel({
  devices,
  selectedIds,
  statusById,
  onToggle,
  onToggleAll,
  onRefresh,
  refreshing,
}: DeviceTargetsPanelProps) {
  const allSelected = devices.length > 0 && selectedIds.length === devices.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < devices.length;
  const toggleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (toggleRef.current) {
      toggleRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const selectedCountLabel = useMemo(() => {
    if (devices.length === 0) return '0';
    return `${selectedIds.length}/${devices.length}`;
  }, [devices.length, selectedIds.length]);

  return (
    <div className="card device-targets-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Qurilmalar tanlovi</div>
          <div className="panel-subtitle">
            Qaysi qurilmalarga yuborish kerakligini belgilang
          </div>
        </div>
        <div className="panel-actions">
          <label className="checkbox device-targets-toggle">
            <input
              ref={toggleRef}
              type="checkbox"
              checked={allSelected}
              onChange={(e) => onToggleAll(e.target.checked)}
              disabled={devices.length === 0}
            />
            <span>Barchasi</span>
          </label>
          <span className="badge">{selectedCountLabel}</span>
          <button
            type="button"
            className="button button-secondary button-compact"
            onClick={onRefresh}
            disabled={refreshing || devices.length === 0}
          >
            <Icons.Refresh /> Yangilash
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="notice notice-warning">
          Qurilmalar topilmadi. Avval backendda qurilmalarni qo'shing.
        </div>
      ) : (
        <div className="device-targets-list">
          {devices.map((device) => {
            const status = statusById[device.id] || 'unknown';
            const isSelected = selectedIds.includes(device.id);
            return (
              <label key={device.id} className="device-target-item">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(device.id)}
                />
                <div className="device-target-main">
                  <div className="device-target-name">{device.name}</div>
                <div className="device-target-meta">
                  {device.location && <span className="badge">{device.location}</span>}
                  {device.deviceId && <span className="badge">ID: {device.deviceId}</span>}
                  {device.lastSeenAt && (
                    <span className="badge">
                      Oxirgi ko'rilgan: {new Date(device.lastSeenAt).toLocaleString()}
                    </span>
                  )}
                  {device.isActive === false && (
                    <span className="badge badge-warning">Backend: nofaol</span>
                  )}
                </div>
                </div>
                <span
                  className={`badge ${
                    status === 'online'
                      ? 'badge-success'
                      : status === 'offline'
                      ? 'badge-danger'
                      : ''
                  }`}
                >
                  {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : "Noma'lum"}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

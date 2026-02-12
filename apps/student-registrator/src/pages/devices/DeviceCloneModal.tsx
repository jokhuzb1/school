import { Icons } from '../../components/ui/Icons';
import type { SchoolDeviceInfo } from '../../types';
import type { DeviceCloneStatus, ModalDialogRef, ModalKeyDown } from './types';

type DeviceCloneModalProps = {
  pendingDeviceClone: SchoolDeviceInfo | null;
  backendDevices: SchoolDeviceInfo[];
  sourceCloneId: string;
  setSourceCloneId: (value: string) => void;
  deviceCloneStatus: DeviceCloneStatus | null;
  setPendingDeviceClone: (value: SchoolDeviceInfo | null) => void;
  onStartClone: () => Promise<void>;
  dialogRef: ModalDialogRef;
  onDialogKeyDown: ModalKeyDown;
};

export function DeviceCloneModal({
  pendingDeviceClone,
  backendDevices,
  sourceCloneId,
  setSourceCloneId,
  deviceCloneStatus,
  setPendingDeviceClone,
  onStartClone,
  dialogRef,
  onDialogKeyDown,
}: DeviceCloneModalProps) {
  if (!pendingDeviceClone) return null;

  return (
    <div className="modal-overlay" onClick={() => !deviceCloneStatus?.running && setPendingDeviceClone(null)}>
      <div
        ref={dialogRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Qurilmadan qurilmaga clone"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3>Qurilmadan qurilmaga clone</h3>
          <button
            className="modal-close"
            onClick={() => !deviceCloneStatus?.running && setPendingDeviceClone(null)}
            disabled={deviceCloneStatus?.running}
            aria-label="Yopish"
          >
            <Icons.X />
          </button>
        </div>
        <div className="modal-body">
          <p className="notice notice-warning">
            <strong>{pendingDeviceClone.name}</strong> qurilmasiga boshqa qurilmadagi o'quvchilar ko'chiriladi.
          </p>

          <div className="form-group">
            <label>Manba qurilma</label>
            <select
              className="input"
              value={sourceCloneId}
              onChange={(e) => setSourceCloneId(e.target.value)}
              disabled={deviceCloneStatus?.running}
            >
              <option value="">Tanlang</option>
              {backendDevices
                .filter((d) => d.id !== pendingDeviceClone.id)
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
            </select>
          </div>

          {deviceCloneStatus && (
            <div className="notice">
              <div>Jami: {deviceCloneStatus.processed}</div>
              <div>Muvaffaqiyatli: {deviceCloneStatus.success}</div>
              <div>Xato: {deviceCloneStatus.failed}</div>
              <div>O'tkazildi: {deviceCloneStatus.skipped}</div>
            </div>
          )}

          {deviceCloneStatus?.errors?.length ? (
            <div className="notice notice-error" style={{ maxHeight: 200, overflow: 'auto' }}>
              {deviceCloneStatus.errors.slice(0, 20).map((item, idx) => (
                <div key={`${item.employeeNo || 'x'}-${idx}`}>
                  {(item.name || item.employeeNo || 'Student')}: {item.reason || 'Xato'}
                </div>
              ))}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void onStartClone()}
              disabled={deviceCloneStatus?.running || !sourceCloneId}
            >
              <Icons.Download /> {deviceCloneStatus?.running ? 'Yuklanmoqda...' : 'Boshlash'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPendingDeviceClone(null)}
              disabled={deviceCloneStatus?.running}
            >
              <Icons.X /> Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

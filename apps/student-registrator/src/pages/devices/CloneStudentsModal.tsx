import { Icons } from '../../components/ui/Icons';
import type { SchoolDeviceInfo } from '../../types';
import type { CloneStatus, ModalDialogRef, ModalKeyDown } from './types';

type CloneStudentsModalProps = {
  pendingClone: SchoolDeviceInfo | null;
  cloneStatus: CloneStatus | null;
  setPendingClone: (value: SchoolDeviceInfo | null) => void;
  onStartClone: () => Promise<void>;
  dialogRef: ModalDialogRef;
  onDialogKeyDown: ModalKeyDown;
};

export function CloneStudentsModal({
  pendingClone,
  cloneStatus,
  setPendingClone,
  onStartClone,
  dialogRef,
  onDialogKeyDown,
}: CloneStudentsModalProps) {
  if (!pendingClone) return null;

  return (
    <div className="modal-overlay" onClick={() => !cloneStatus?.running && setPendingClone(null)}>
      <div
        ref={dialogRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Clone mode"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3>Clone mode</h3>
          <button
            className="modal-close"
            onClick={() => !cloneStatus?.running && setPendingClone(null)}
            disabled={cloneStatus?.running}
            aria-label="Yopish"
          >
            <Icons.X />
          </button>
        </div>
        <div className="modal-body">
          <p className="notice notice-warning">
            <strong>{pendingClone.name}</strong> qurilmasiga bazadagi barcha o'quvchilar yuboriladi.
          </p>

          {cloneStatus && (
            <div className="notice">
              <div>Jami: {cloneStatus.processed}</div>
              <div>Muvaffaqiyatli: {cloneStatus.success}</div>
              <div>Xato: {cloneStatus.failed}</div>
              <div>O'tkazildi: {cloneStatus.skipped}</div>
            </div>
          )}

          {cloneStatus?.errors?.length ? (
            <div className="notice notice-error" style={{ maxHeight: 200, overflow: 'auto' }}>
              {cloneStatus.errors.slice(0, 20).map((item, idx) => (
                <div key={`${item.studentId || 'x'}-${idx}`}>
                  {(item.name || item.studentId || 'Student')}: {item.reason || 'Xato'}
                </div>
              ))}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              type="button"
              className="button button-primary"
              onClick={() => void onStartClone()}
              disabled={cloneStatus?.running}
            >
              <Icons.Download /> {cloneStatus?.running ? 'Yuklanmoqda...' : 'Boshlash'}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setPendingClone(null)}
              disabled={cloneStatus?.running}
            >
              <Icons.X /> Yopish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

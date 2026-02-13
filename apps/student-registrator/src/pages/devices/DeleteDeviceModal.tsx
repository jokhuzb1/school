import { Icons } from '../../components/ui/Icons';
import type { SchoolDeviceInfo } from '../../types';
import type { ModalDialogRef, ModalKeyDown } from './types';

type DeleteDeviceModalProps = {
  pendingDelete: SchoolDeviceInfo | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  dialogRef: ModalDialogRef;
  onDialogKeyDown: ModalKeyDown;
};

export function DeleteDeviceModal({
  pendingDelete,
  loading,
  onClose,
  onConfirm,
  dialogRef,
  onDialogKeyDown,
}: DeleteDeviceModalProps) {
  if (!pendingDelete) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Qurilmani o'chirish"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3>Qurilmani o'chirish</h3>
          <button className="modal-close" onClick={onClose} aria-label="Yopish">
            <Icons.X />
          </button>
        </div>
        <div className="modal-body">
          <p className="notice notice-warning">
            <strong>{pendingDelete.name}</strong> qurilmasi o'chiriladi. Davom etasizmi?
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="button button-danger"
              onClick={() => void onConfirm()}
              disabled={loading}
            >
              <Icons.Trash /> O'chirish
            </button>
            <button type="button" className="button button-secondary" onClick={onClose} disabled={loading}>
              <Icons.X /> Bekor qilish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import type React from 'react';
import { Icons } from '../../components/ui/Icons';

type DeleteUserDialogProps = {
  pendingDeleteEmployeeNo: string | null;
  setPendingDeleteEmployeeNo: (next: string | null) => void;
  deleteDialogRef: React.RefObject<HTMLDivElement | null>;
  onDeleteDialogKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  confirmDeleteUser: () => Promise<void>;
};

export function DeleteUserDialog({
  pendingDeleteEmployeeNo,
  setPendingDeleteEmployeeNo,
  deleteDialogRef,
  onDeleteDialogKeyDown,
  confirmDeleteUser,
}: DeleteUserDialogProps) {
  if (!pendingDeleteEmployeeNo) return null;

  return (
    <div className="modal-overlay" onClick={() => setPendingDeleteEmployeeNo(null)}>
      <div
        ref={deleteDialogRef}
        className="modal"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onDeleteDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Foydalanuvchini o'chirish"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3>Foydalanuvchini o'chirish</h3>
          <button className="modal-close" onClick={() => setPendingDeleteEmployeeNo(null)} aria-label="Yopish">
            <Icons.X />
          </button>
        </div>
        <div className="modal-body">
          <p className="notice notice-warning">
            EmployeeNo <strong>{pendingDeleteEmployeeNo}</strong> foydalanuvchisini o'chirasizmi?
          </p>
          <div className="form-actions">
            <button type="button" className="button button-danger" onClick={() => void confirmDeleteUser()}>
              <Icons.Trash /> O'chirish
            </button>
            <button type="button" className="button button-secondary" onClick={() => setPendingDeleteEmployeeNo(null)}>
              <Icons.X /> Bekor qilish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

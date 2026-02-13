import type React from 'react';
import { Icons } from '../../components/ui/Icons';
import { DEVICE_CREDENTIALS_LIMIT } from './constants';
import type { DeviceFormData, ModalDialogRef, ModalKeyDown } from './types';

type DeviceCredentialsModalProps = {
  isOpen: boolean;
  loading: boolean;
  formData: DeviceFormData;
  setFormData: (value: DeviceFormData) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  dialogRef: ModalDialogRef;
  onDialogKeyDown: ModalKeyDown;
  deviceLimitReached: boolean;
  editingLocalId: string | null;
};

export function DeviceCredentialsModal({
  isOpen,
  loading,
  formData,
  setFormData,
  onClose,
  onSubmit,
  dialogRef,
  onDialogKeyDown,
  deviceLimitReached,
  editingLocalId,
}: DeviceCredentialsModalProps) {
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
        aria-label="Ulanish sozlamalari"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3>Ulanish sozlamalari</h3>
          <button className="modal-close" onClick={onClose} aria-label="Yopish">
            <Icons.X />
          </button>
        </div>
        <div className="modal-body">
          <form
            onSubmit={(event) => {
              void onSubmit(event);
            }}
          >
            <div className="form-row">
              <div className="form-group">
                <label>IP manzil</label>
                <input
                  className="input"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  placeholder="192.168.1.100"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Port</label>
                <input
                  className="input"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Username</label>
                <input
                  className="input"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Parol</label>
                <input
                  className="input"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <p className="notice">
              Login va parol backendga yuborilmaydi. Faqat shu kompyuterda saqlanadi va 30 kun amal qiladi.
            </p>

            <div className="form-actions">
              <button type="submit" className="button button-primary" disabled={loading}>
                <><Icons.Edit /> Saqlash</>
              </button>
              <button type="button" className="button button-secondary" onClick={onClose}>
                <Icons.X /> Bekor qilish
              </button>
            </div>

            {deviceLimitReached && !editingLocalId && (
              <p className="notice notice-warning">
                Ulanish sozlamalari limiti {DEVICE_CREDENTIALS_LIMIT} ta. Yangi login/parol qo'shishda limit tekshiriladi.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

import type React from 'react';
import { Icons } from '../../components/ui/Icons';
import type { DeviceFormData, ModalDialogRef, ModalKeyDown } from './types';

type DeviceFormModalProps = {
  isOpen: boolean;
  editingBackendId: string | null;
  loading: boolean;
  formData: DeviceFormData;
  setFormData: (value: DeviceFormData) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => Promise<void>;
  dialogRef: ModalDialogRef;
  onDialogKeyDown: ModalKeyDown;
};

export function DeviceFormModal({
  isOpen,
  editingBackendId,
  loading,
  formData,
  setFormData,
  onClose,
  onSubmit,
  dialogRef,
  onDialogKeyDown,
}: DeviceFormModalProps) {
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
        aria-label={editingBackendId ? 'Qurilmani tahrirlash' : 'Yangi qurilma'}
        tabIndex={-1}
      >
        <div className="modal-header">
          <h3>{editingBackendId ? 'Qurilmani tahrirlash' : 'Yangi qurilma'}</h3>
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
            <div className="form-group">
              <label>Nomi *</label>
              <input
                className="input"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Asosiy kirish"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label>Joylashuv</label>
              <input
                className="input"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Masalan: 1-qavat, asosiy kirish"
              />
            </div>

            <div className="form-group">
              <label>Device ID (Hikvision)</label>
              <input
                className="input"
                value={formData.deviceId}
                onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                placeholder="Bo'sh qoldirsangiz ulanishdan keyin avtomatik olinadi"
              />
            </div>

            <div className="form-group">
              <label>Turi</label>
              <select
                className="input"
                value={formData.deviceType}
                onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
              >
                <option value="ENTRANCE">Kirish</option>
                <option value="EXIT">Chiqish</option>
              </select>
            </div>

            <div className="form-group">
              <label>IP manzil (ixtiyoriy, auto detect uchun)</label>
              <input
                className="input"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Port</label>
                <input
                  className="input"
                  type="number"
                  value={formData.port}
                  onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>Username (ixtiyoriy)</label>
                <input
                  className="input"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Parol (ixtiyoriy)</label>
              <input
                className="input"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <p className="notice">
              Agar `deviceId` kiritilmasa va ulanish ma'lumotlari berilsa, tizim qurilmadan `deviceId` ni avtomatik topadi.
            </p>

            <div className="form-actions">
              <button type="submit" className="button button-primary" disabled={loading}>
                {editingBackendId ? <><Icons.Edit /> Saqlash</> : <><Icons.Plus /> Qo'shish</>}
              </button>
              <button type="button" className="button button-secondary" onClick={onClose}>
                <Icons.X /> Bekor qilish
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../ui/Icons';
import { fileToFaceBase64 } from '../../api';
import { useGlobalToast } from '../../hooks/useToast';
import type { StudentRow, ClassInfo } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';
import { appLogger } from '../../utils/logger';

interface StudentTableRowProps {
  index: number;
  student: StudentRow;
  availableClasses: ClassInfo[];
  onEdit: (id: string, updates: Partial<StudentRow>) => void;
  onDelete: (id: string) => void;
  onSave: (id: string) => Promise<void>;
  onRefreshFace?: (id: string) => Promise<boolean>;
  isFaceRefreshing?: boolean;
}

export function StudentTableRow({
  index,
  student,
  availableClasses,
  onEdit,
  onDelete,
  onSave,
  onRefreshFace,
  isFaceRefreshing = false,
}: StudentTableRowProps) {
  const { addToast } = useGlobalToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { dialogRef, onDialogKeyDown } = useModalA11y(isPreviewOpen, () => setIsPreviewOpen(false));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fullName = `${student.lastName || ''} ${student.firstName || ''}`.trim();
  const validateImageFile = (file: File) => {
    const allowedTypes = new Set(['image/jpeg', 'image/png']);
    if (!allowedTypes.has(file.type)) {
      throw new Error('Faqat JPG yoki PNG formatidagi rasm qabul qilinadi.');
    }
    if (file.size < 10 * 1024) {
      throw new Error("Rasm hajmi 10KB dan kichik bo'lmasligi kerak.");
    }
  };
  const getErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return "Noma'lum xato";
  };

  const handleChange = <K extends keyof StudentRow>(field: K, value: StudentRow[K]) => {
    appLogger.debug(`[Table Row] Editing ${field}:`, value);
    onEdit(student.id, { [field]: value });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      validateImageFile(file);
      const imageBase64 = await fileToFaceBase64(file);
      onEdit(student.id, { imageBase64 });
    } catch (err) {
      appLogger.error('Image upload error:', err);
      addToast(`Rasm yuklashda xato: ${getErrorMessage(err)}`, 'error');
      e.currentTarget.value = '';
    }
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(student.id);
    } catch (err) {
      appLogger.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const rowClass = student.status === 'success' ? 'status-success' : 
                   student.status === 'error' ? 'status-error' : '';

  const previewModal =
    isPreviewOpen && student.imageBase64
      ? createPortal(
          <div className="modal-overlay" onClick={() => setIsPreviewOpen(false)}>
            <div
              ref={dialogRef}
              className="modal image-modal"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={onDialogKeyDown}
              role="dialog"
              aria-modal="true"
              aria-label="Rasm ko'rish"
              tabIndex={-1}
            >
              <div className="modal-header">
                <h3>{fullName || 'Rasm'}</h3>
                <button className="modal-close" onClick={() => setIsPreviewOpen(false)} aria-label="Yopish">
                  <Icons.X />
                </button>
              </div>
              <div className="modal-body image-modal-body">
                <img
                  src={`data:image/jpeg;base64,${student.imageBase64}`}
                  alt={fullName || 'Student'}
                  className="image-modal-preview"
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
    <tr className={rowClass}>
      <td>{index}</td>
      <td>
        <input
          className="input input-sm table-input"
          value={student.lastName}
          onChange={(e) => handleChange('lastName', e.target.value)}
          placeholder="Familiya"
          disabled={student.status === 'success'}
        />
      </td>
      <td>
        <input
          className="input input-sm table-input"
          value={student.firstName}
          onChange={(e) => handleChange('firstName', e.target.value)}
          placeholder="Ism"
          disabled={student.status === 'success'}
        />
      </td>
      <td>
        <select
          className="input input-sm table-input"
          value={student.gender}
          onChange={(e) => handleChange('gender', e.target.value)}
          disabled={student.status === 'success'}
        >
          <option value="male">Erkak</option>
          <option value="female">Ayol</option>
        </select>
      </td>
      <td>
        <select
          className="input input-sm table-input"
          value={student.classId || ''}
          onChange={(e) => {
            const classId = e.target.value;
            const className = availableClasses.find(c => c.id === classId)?.name;
            handleChange('classId', classId);
            if (className) handleChange('className', className);
          }}
          disabled={student.status === 'success'}
        >
          <option value="">Tanlang</option>
          {availableClasses.map(cls => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          className="input input-sm table-input"
          value={student.fatherName || ''}
          onChange={(e) => handleChange('fatherName', e.target.value)}
          placeholder="Otasining ismi"
          disabled={student.status === 'success'}
        />
      </td>
      <td>
        <input
          className="input input-sm table-input"
          value={student.parentPhone || ''}
          onChange={(e) => handleChange('parentPhone', e.target.value)}
          placeholder="+998..."
          disabled={student.status === 'success'}
        />
      </td>
      <td>
        <div className="image-cell">
          {student.imageBase64 ? (
            <div className="image-preview-wrapper">
              <img 
                src={`data:image/jpeg;base64,${student.imageBase64}`}
                alt={fullName || 'Student'}
                className="image-preview"
                title="Rasm ko'rish"
                onClick={() => setIsPreviewOpen(true)}
              />
              {student.status !== 'success' && (
                <button
                  className="btn-change-image"
                  onClick={() => fileInputRef.current?.click()}
                  title="Rasmni o'zgartirish"
                  aria-label="Rasmni o'zgartirish"
                >
                  <Icons.Edit />
                </button>
              )}
            </div>
          ) : (
            <div className="image-preview-wrapper">
              <button
                className="btn-upload"
                onClick={() => fileInputRef.current?.click()}
                disabled={student.status === 'success'}
                title="Rasm yuklash"
                aria-label="Rasm yuklash"
              >
                <Icons.Upload />
              </button>
              {onRefreshFace && student.source === 'import' && student.deviceStudentId && (
                <button
                  className="btn-change-image"
                  onClick={() => void onRefreshFace(student.id)}
                  disabled={isFaceRefreshing}
                  title="Qurilmadan rasmni qayta olish"
                  aria-label="Qurilmadan rasmni qayta olish"
                >
                  {isFaceRefreshing ? <span className="spinner" /> : <Icons.Refresh />}
                </button>
              )}
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,image/jpeg,image/png"
            style={{ display: 'none' }}
            onChange={handleImageUpload}
          />
        </div>
      </td>
      <td>
        {student.status === 'pending' && (
          <span className="badge badge-warning">Kutilmoqda</span>
        )}
        {student.status === 'success' && (
          <span className="badge badge-success">Saqlandi</span>
        )}
        {student.status === 'error' && (
          <span className="badge badge-danger" title={student.error}>
            Xato
          </span>
        )}
      </td>
      <td className="error-reason-cell">
        {student.status === 'error' ? (
          <span className="error-reason-text" title={student.errorRaw || student.error}>
            {student.error || "Noma'lum xato"}
          </span>
        ) : (
          <span className="error-reason-muted">-</span>
        )}
      </td>
      <td>
        <div className="action-buttons">
          {student.status !== 'success' && (
            <button
              className="btn-icon btn-success"
              onClick={handleSaveClick}
              disabled={isSaving}
              title="Saqlash"
              aria-label="Saqlash"
            >
              {isSaving ? <span className="spinner" /> : <Icons.Save />}
            </button>
          )}
          <button
            className="btn-icon btn-danger"
            onClick={() => onDelete(student.id)}
            title="O'chirish"
            aria-label="O'chirish"
          >
            <Icons.Trash />
          </button>
        </div>
      </td>
    </tr>
    {previewModal}
    </>
  );
}


import { useState, useEffect } from 'react';
import { Icons } from '../ui/Icons';
import type { ClassInfo } from '../../types';
import { useModalA11y } from '../../hooks/useModalA11y';

interface TemplateDownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableClasses: ClassInfo[];
  onDownload: (classNames: string[]) => Promise<void>;
}

interface ClassRow {
  id: string;
  value: string;
  isCustom: boolean;
}

export function TemplateDownloadModal({
  isOpen,
  onClose,
  availableClasses,
  onDownload,
}: TemplateDownloadModalProps) {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [downloading, setDownloading] = useState(false);

  // Initialize with one empty row
  useEffect(() => {
    if (isOpen && rows.length === 0) {
      setRows([{ id: crypto.randomUUID(), value: '', isCustom: false }]);
    }
  }, [isOpen, rows.length]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setRows([]);
    }
  }, [isOpen]);

  const handleAddRow = () => {
    setRows((prev) => [...prev, { id: crypto.randomUUID(), value: '', isCustom: false }]);
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const handleSelectChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? { ...row, value, isCustom: value === '__custom__' }
          : row
      )
    );
  };

  const handleCustomInputChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value } : row))
    );
  };

  const handleDownload = async () => {
    const classNames = rows
      .map((row) => row.value.trim())
      .filter((name) => name && name !== '__custom__');

    if (classNames.length === 0) {
      return;
    }

    setDownloading(true);
    try {
      await onDownload(classNames);
      onClose();
    } finally {
      setDownloading(false);
    }
  };

  const validCount = rows.filter(
    (row) => row.value.trim() && row.value !== '__custom__'
  ).length;
  const { dialogRef, onDialogKeyDown } = useModalA11y(isOpen, onClose, downloading);

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
        aria-label="Shablon yuklash"
        tabIndex={-1}
      >
        <div className="modal-header">
          <h2>Shablon Yuklash</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Yopish">
            <Icons.X />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description">Qaysi sinflar uchun shablon kerak?</p>

          <div className="class-rows">
            {rows.map((row) => (
              <div key={row.id} className="class-row">
                {row.isCustom ? (
                  <input
                    type="text"
                    className="input"
                    placeholder="Sinf nomini yozing..."
                    value={row.value === '__custom__' ? '' : row.value}
                    onChange={(e) => handleCustomInputChange(row.id, e.target.value)}
                    autoFocus
                  />
                ) : (
                  <select
                    className="input"
                    value={row.value}
                    onChange={(e) => handleSelectChange(row.id, e.target.value)}
                  >
                    <option value="">Sinf tanlang...</option>
                    {availableClasses
                      .filter((cls) => {
                        // Allow current row's value, filter out values selected in other rows
                        const otherSelectedValues = rows
                          .filter((r) => r.id !== row.id && !r.isCustom)
                          .map((r) => r.value.trim().toUpperCase());
                        return !otherSelectedValues.includes(cls.name.toUpperCase());
                      })
                      .map((cls) => (
                        <option key={cls.id} value={cls.name}>
                          {cls.name}
                        </option>
                      ))}
                    <option value="__custom__">+ Yangi sinf yozish</option>
                  </select>
                )}
                {rows.length > 1 && (
                  <button
                    type="button"
                    className="btn-icon btn-danger"
                    onClick={() => handleRemoveRow(row.id)}
                    aria-label="O'chirish"
                  >
                    <Icons.Trash />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            className="button button-secondary"
            onClick={handleAddRow}
          >
            <Icons.Plus /> Sinf qo'shish
          </button>
        </div>

        <div className="modal-footer">
          <button className="button button-secondary" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            className="button button-primary"
            onClick={handleDownload}
            disabled={downloading || validCount === 0}
          >
            <Icons.Download /> Yuklab olish {validCount > 0 && `(${validCount})`}
          </button>
        </div>
      </div>
    </div>
  );
}

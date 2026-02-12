import type React from 'react';
import { DeviceSelectionModal } from '../../features/add-students/DeviceSelectionModal';
import { ProvisioningPanel } from '../../components/students/ProvisioningPanel';
import { TemplateDownloadModal } from '../../components/students/TemplateDownloadModal';
import { Icons } from '../../components/ui/Icons';
import type { ClassInfo, RegisterResult, SchoolDeviceInfo } from '../../types';
import type { DeviceSelectionStatus } from '../../utils/deviceStatus';

type AddStudentsPageModalsProps = {
  isProvModalOpen: boolean;
  setIsProvModalOpen: (next: boolean) => void;
  provDialogRef: React.RefObject<HTMLDivElement | null>;
  onProvDialogKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  lastProvisioningId: string | null;
  lastRegisterResult: RegisterResult | null;
  isSourceImportModalOpen: boolean;
  backendDevices: SchoolDeviceInfo[];
  sourceImportDeviceIds: string[];
  toggleSourceImportDevice: (deviceId: string) => void;
  closeSourceImportModal: () => void;
  confirmDeviceModeImport: () => Promise<void>;
  isDeviceImporting: boolean;
  isTargetSaveModalOpen: boolean;
  selectedDeviceIds: string[];
  handleToggleDevice: (deviceId: string) => void;
  setIsTargetSaveModalOpen: (next: boolean) => void;
  isSaving: boolean;
  handleConfirmSaveAll: () => Promise<void>;
  deviceStatus: Record<string, DeviceSelectionStatus>;
  isClassModalOpen: boolean;
  setIsClassModalOpen: (next: boolean) => void;
  classDialogRef: React.RefObject<HTMLDivElement | null>;
  onClassDialogKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  handleCreateClass: (e: React.FormEvent) => Promise<void>;
  newClassName: string;
  setNewClassName: (next: string) => void;
  newClassGrade: number;
  setNewClassGrade: (next: number) => void;
  isCreatingClass: boolean;
  isTemplateModalOpen: boolean;
  setIsTemplateModalOpen: (next: boolean) => void;
  availableClasses: ClassInfo[];
  handleTemplateDownload: (classNames: string[]) => Promise<void>;
};

export function AddStudentsPageModals({
  isProvModalOpen,
  setIsProvModalOpen,
  provDialogRef,
  onProvDialogKeyDown,
  lastProvisioningId,
  lastRegisterResult,
  isSourceImportModalOpen,
  backendDevices,
  sourceImportDeviceIds,
  toggleSourceImportDevice,
  closeSourceImportModal,
  confirmDeviceModeImport,
  isDeviceImporting,
  isTargetSaveModalOpen,
  selectedDeviceIds,
  handleToggleDevice,
  setIsTargetSaveModalOpen,
  isSaving,
  handleConfirmSaveAll,
  deviceStatus,
  isClassModalOpen,
  setIsClassModalOpen,
  classDialogRef,
  onClassDialogKeyDown,
  handleCreateClass,
  newClassName,
  setNewClassName,
  newClassGrade,
  setNewClassGrade,
  isCreatingClass,
  isTemplateModalOpen,
  setIsTemplateModalOpen,
  availableClasses,
  handleTemplateDownload,
}: AddStudentsPageModalsProps) {
  return (
    <>
      {isProvModalOpen && (
        <div className="modal-overlay" onClick={() => setIsProvModalOpen(false)}>
          <div
            ref={provDialogRef}
            className="modal modal-provisioning"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onProvDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Provisioning holati"
            tabIndex={-1}
          >
            <div className="modal-header">
              <div>
                <h3>Provisioning Holati</h3>
                {lastProvisioningId && <p className="text-secondary text-xs">ID: {lastProvisioningId}</p>}
              </div>
              <button className="modal-close" onClick={() => setIsProvModalOpen(false)} aria-label="Yopish">
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <ProvisioningPanel provisioningId={lastProvisioningId} registerResult={lastRegisterResult} />
            </div>
            <div className="modal-footer">
              <button className="button button-secondary" onClick={() => setIsProvModalOpen(false)}>
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}

      <DeviceSelectionModal
        isOpen={isSourceImportModalOpen}
        title="Device mode import: manba qurilmalar"
        devices={backendDevices}
        selectedIds={sourceImportDeviceIds}
        onToggle={toggleSourceImportDevice}
        onClose={closeSourceImportModal}
        onConfirm={confirmDeviceModeImport}
        confirmLabel="Importni boshlash"
        busy={isDeviceImporting}
        busyLabel="Import qilinmoqda..."
        disableConfirm={sourceImportDeviceIds.length === 0}
      />

      <DeviceSelectionModal
        isOpen={isTargetSaveModalOpen}
        title="Saqlash: target qurilmalar"
        devices={backendDevices}
        selectedIds={selectedDeviceIds}
        onToggle={handleToggleDevice}
        onClose={() => {
          if (!isSaving) setIsTargetSaveModalOpen(false);
        }}
        onConfirm={handleConfirmSaveAll}
        confirmLabel="Saqlashni boshlash"
        busy={isSaving}
        busyLabel="Saqlanmoqda..."
        statuses={deviceStatus}
      />

      {isClassModalOpen && (
        <div className="modal-overlay" onClick={() => setIsClassModalOpen(false)}>
          <div
            ref={classDialogRef}
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={onClassDialogKeyDown}
            role="dialog"
            aria-modal="true"
            aria-label="Yangi sinf qo'shish"
            tabIndex={-1}
          >
            <div className="modal-header">
              <h3>Yangi sinf qo'shish</h3>
              <button
                className="modal-close"
                onClick={() => setIsClassModalOpen(false)}
                title="Yopish"
                aria-label="Yopish"
              >
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateClass}>
                <div className="form-group">
                  <label>Sinf nomi</label>
                  <input
                    className="input"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="Masalan: 9C"
                    autoFocus
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Sinf darajasi</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={11}
                    value={newClassGrade}
                    onChange={(e) => setNewClassGrade(Number(e.target.value))}
                    required
                  />
                </div>
                <div className="form-actions">
                  <button className="button button-primary" type="submit" disabled={isCreatingClass}>
                    <Icons.Check /> {isCreatingClass ? 'Yaratilmoqda...' : 'Yaratish'}
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => setIsClassModalOpen(false)}
                    disabled={isCreatingClass}
                  >
                    <Icons.X /> Bekor qilish
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <TemplateDownloadModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        availableClasses={availableClasses}
        onDownload={handleTemplateDownload}
      />
    </>
  );
}

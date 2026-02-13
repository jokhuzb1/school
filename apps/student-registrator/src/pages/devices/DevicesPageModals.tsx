import type React from 'react';
import type { SchoolDeviceInfo } from '../../types';
import { CloneStudentsModal } from './CloneStudentsModal';
import { DeleteDeviceModal } from './DeleteDeviceModal';
import { DeviceCloneModal } from './DeviceCloneModal';
import { DeviceCredentialsModal } from './DeviceCredentialsModal';
import { DeviceFormModal } from './DeviceFormModal';
import type { CloneStatus, DeviceCloneStatus, DeviceFormData, ModalDialogRef, ModalKeyDown } from './types';

type DevicesPageModalsProps = {
  isModalOpen: boolean;
  editingBackendId: string | null;
  loading: boolean;
  formData: DeviceFormData;
  setFormData: (value: DeviceFormData) => void;
  closeModal: () => void;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  modalDialogRef: ModalDialogRef;
  onModalDialogKeyDown: ModalKeyDown;
  isCredentialsModalOpen: boolean;
  closeCredentialsModal: () => void;
  credentialsDialogRef: ModalDialogRef;
  onCredentialsDialogKeyDown: ModalKeyDown;
  deviceLimitReached: boolean;
  editingLocalId: string | null;
  pendingDelete: SchoolDeviceInfo | null;
  setPendingDelete: (value: SchoolDeviceInfo | null) => void;
  handleDeleteDevice: () => Promise<void>;
  deleteDialogRef: ModalDialogRef;
  onDeleteDialogKeyDown: ModalKeyDown;
  pendingClone: SchoolDeviceInfo | null;
  cloneStatus: CloneStatus | null;
  setPendingClone: (value: SchoolDeviceInfo | null) => void;
  handleStartClone: () => Promise<void>;
  cloneDialogRef: ModalDialogRef;
  onCloneDialogKeyDown: ModalKeyDown;
  pendingDeviceClone: SchoolDeviceInfo | null;
  backendDevices: SchoolDeviceInfo[];
  sourceCloneId: string;
  setSourceCloneId: (value: string) => void;
  deviceCloneStatus: DeviceCloneStatus | null;
  setPendingDeviceClone: (value: SchoolDeviceInfo | null) => void;
  handleStartDeviceClone: () => Promise<void>;
  deviceCloneDialogRef: ModalDialogRef;
  onDeviceCloneDialogKeyDown: ModalKeyDown;
};

export function DevicesPageModals({
  isModalOpen,
  editingBackendId,
  loading,
  formData,
  setFormData,
  closeModal,
  handleSubmit,
  modalDialogRef,
  onModalDialogKeyDown,
  isCredentialsModalOpen,
  closeCredentialsModal,
  credentialsDialogRef,
  onCredentialsDialogKeyDown,
  deviceLimitReached,
  editingLocalId,
  pendingDelete,
  setPendingDelete,
  handleDeleteDevice,
  deleteDialogRef,
  onDeleteDialogKeyDown,
  pendingClone,
  cloneStatus,
  setPendingClone,
  handleStartClone,
  cloneDialogRef,
  onCloneDialogKeyDown,
  pendingDeviceClone,
  backendDevices,
  sourceCloneId,
  setSourceCloneId,
  deviceCloneStatus,
  setPendingDeviceClone,
  handleStartDeviceClone,
  deviceCloneDialogRef,
  onDeviceCloneDialogKeyDown,
}: DevicesPageModalsProps) {
  return (
    <>
      <DeviceFormModal
        isOpen={isModalOpen}
        editingBackendId={editingBackendId}
        loading={loading}
        formData={formData}
        setFormData={setFormData}
        onClose={closeModal}
        onSubmit={handleSubmit}
        dialogRef={modalDialogRef}
        onDialogKeyDown={onModalDialogKeyDown}
      />

      <DeviceCredentialsModal
        isOpen={isCredentialsModalOpen}
        loading={loading}
        formData={formData}
        setFormData={setFormData}
        onClose={closeCredentialsModal}
        onSubmit={handleSubmit}
        dialogRef={credentialsDialogRef}
        onDialogKeyDown={onCredentialsDialogKeyDown}
        deviceLimitReached={deviceLimitReached}
        editingLocalId={editingLocalId}
      />

      <DeleteDeviceModal
        pendingDelete={pendingDelete}
        loading={loading}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDeleteDevice}
        dialogRef={deleteDialogRef}
        onDialogKeyDown={onDeleteDialogKeyDown}
      />

      <CloneStudentsModal
        pendingClone={pendingClone}
        cloneStatus={cloneStatus}
        setPendingClone={setPendingClone}
        onStartClone={handleStartClone}
        dialogRef={cloneDialogRef}
        onDialogKeyDown={onCloneDialogKeyDown}
      />

      <DeviceCloneModal
        pendingDeviceClone={pendingDeviceClone}
        backendDevices={backendDevices}
        sourceCloneId={sourceCloneId}
        setSourceCloneId={setSourceCloneId}
        deviceCloneStatus={deviceCloneStatus}
        setPendingDeviceClone={setPendingDeviceClone}
        onStartClone={handleStartDeviceClone}
        dialogRef={deviceCloneDialogRef}
        onDialogKeyDown={onDeviceCloneDialogKeyDown}
      />
    </>
  );
}

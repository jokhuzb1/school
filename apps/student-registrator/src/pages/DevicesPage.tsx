import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGlobalToast } from '../hooks/useToast';
import { useModalA11y } from '../hooks/useModalA11y';
import type { DeviceConfig, SchoolDeviceInfo } from '../types';
import type { WebhookInfo } from '../api';
import {
  isDeviceCredentialsExpired,
  resolveLocalDeviceForBackend,
} from '../utils/deviceResolver';
import { DEVICE_CREDENTIALS_LIMIT, DEFAULT_DEVICE_FORM_DATA } from './devices/constants';
import {
  copyToClipboard,
  formatWebhookUrl,
  getBackendPortLabel,
  isBackendOnline,
  maskWebhookValue,
} from './devices/helpers';
import {
  loadBackendDevicesAction,
  loadCredentialsAction,
  loadWebhookInfoAction,
} from './devices/load-actions';
import {
  openCreateModalAction,
  openCredentialsModalAction,
  openEditModalAction,
} from './devices/modal-actions';
import {
  submitDeviceFormAction,
} from './devices/submit-actions';
import {
  handleDeleteDeviceAction,
  handleStartCloneAction,
  handleStartDeviceCloneAction,
  handleTestConnectionAction,
} from './devices/device-operations';
import { DevicesPageContent } from './devices/DevicesPageContent';
import { DevicesPageModals } from './devices/DevicesPageModals';
import type { CloneStatus, DeviceCloneStatus, DeviceFormData } from './devices/types';

export function DevicesPage() {
  const navigate = useNavigate();
  const { addToast } = useGlobalToast();
  const [credentials, setCredentials] = useState<DeviceConfig[]>([]);
  const [editingBackendId, setEditingBackendId] = useState<string | null>(null);
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [formData, setFormData] = useState<DeviceFormData>(DEFAULT_DEVICE_FORM_DATA);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'ok' | 'fail'>>({});
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [showWebhookAdvanced, setShowWebhookAdvanced] = useState(false);
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SchoolDeviceInfo | null>(null);
  const [pendingClone, setPendingClone] = useState<SchoolDeviceInfo | null>(null);
  const [pendingDeviceClone, setPendingDeviceClone] = useState<SchoolDeviceInfo | null>(null);
  const [sourceCloneId, setSourceCloneId] = useState<string>('');
  const [cloneStatus, setCloneStatus] = useState<CloneStatus | null>(null);
  const [deviceCloneStatus, setDeviceCloneStatus] = useState<DeviceCloneStatus | null>(null);

  const { dialogRef: modalDialogRef, onDialogKeyDown: onModalDialogKeyDown } = useModalA11y(
    isModalOpen,
    () => setIsModalOpen(false),
    loading,
  );
  const { dialogRef: credentialsDialogRef, onDialogKeyDown: onCredentialsDialogKeyDown } = useModalA11y(
    isCredentialsModalOpen,
    () => setIsCredentialsModalOpen(false),
    loading,
  );
  const { dialogRef: deleteDialogRef, onDialogKeyDown: onDeleteDialogKeyDown } = useModalA11y(
    Boolean(pendingDelete),
    () => setPendingDelete(null),
    loading,
  );
  const { dialogRef: cloneDialogRef, onDialogKeyDown: onCloneDialogKeyDown } = useModalA11y(
    Boolean(pendingClone),
    () => setPendingClone(null),
    cloneStatus?.running ?? false,
  );
  const { dialogRef: deviceCloneDialogRef, onDialogKeyDown: onDeviceCloneDialogKeyDown } = useModalA11y(
    Boolean(pendingDeviceClone),
    () => setPendingDeviceClone(null),
    deviceCloneStatus?.running ?? false,
  );

  const loadCredentials = () =>
    loadCredentialsAction({
      setCredentials,
      addToast,
    });

  const loadWebhookInfo = () =>
    loadWebhookInfoAction({
      setWebhookLoading,
      setWebhookInfo,
      addToast,
    });

  const loadBackendDevices = () =>
    loadBackendDevicesAction({
      credentials,
      setBackendLoading,
      setBackendDevices,
      loadCredentials,
      addToast,
    });

  useEffect(() => {
    void loadCredentials();
    void loadWebhookInfo();
    void loadBackendDevices();
  }, []);

  const getCredentialsForBackend = (device: SchoolDeviceInfo) =>
    resolveLocalDeviceForBackend(device, credentials).localDevice || undefined;
  const isCredentialsExpired = (device?: DeviceConfig | null) => isDeviceCredentialsExpired(device);
  const deviceLimitReached = credentials.length >= DEVICE_CREDENTIALS_LIMIT;

  const handleSubmit = async (event: React.FormEvent) =>
    submitDeviceFormAction({
      event,
      isCredentialsModalOpen,
      isModalOpen,
      formData,
      editingBackendId,
      editingLocalId,
      backendDevices,
      credentials,
      getCredentialsForBackend,
      loadBackendDevices,
      loadCredentials,
      setFormData,
      setEditingBackendId,
      setEditingLocalId,
      setIsModalOpen,
      setIsCredentialsModalOpen,
      setLoading,
      addToast,
    });

  const openEditModal = (device: SchoolDeviceInfo) =>
    openEditModalAction({
      device,
      getCredentialsForBackend,
      setEditingBackendId,
      setEditingLocalId,
      setFormData,
      setIsModalOpen,
    });

  const openCredentialsModal = (device: SchoolDeviceInfo) =>
    openCredentialsModalAction({
      device,
      getCredentialsForBackend,
      setEditingBackendId,
      setEditingLocalId,
      setFormData,
      setIsCredentialsModalOpen,
    });

  const openCreateModal = () =>
    openCreateModalAction({
      setEditingBackendId,
      setEditingLocalId,
      setFormData,
      setIsModalOpen,
    });

  const handleTestConnection = (device: SchoolDeviceInfo) =>
    handleTestConnectionAction({
      device,
      getCredentialsForBackend,
      isCredentialsExpired,
      addToast,
      setTestingId,
      setTestStatus,
      loadBackendDevices,
      loadCredentials,
    });

  const handleDeleteDevice = () =>
    handleDeleteDeviceAction({
      pendingDelete,
      getCredentialsForBackend,
      loadBackendDevices,
      loadCredentials,
      addToast,
      setLoading,
      setPendingDelete,
    });

  const handleStartClone = () =>
    handleStartCloneAction({
      pendingClone,
      setCloneStatus,
      addToast,
    });

  const handleStartDeviceClone = () =>
    handleStartDeviceCloneAction({
      pendingDeviceClone,
      sourceCloneId,
      backendDevices,
      getCredentialsForBackend,
      setDeviceCloneStatus,
      addToast,
    });

  const openDeviceCloneModal = (device: SchoolDeviceInfo) => {
    setPendingDeviceClone(device);
    setSourceCloneId('');
    setDeviceCloneStatus(null);
  };

  const handleCopyToClipboard = (value: string, label: string) =>
    copyToClipboard(value, label, addToast);

  return (
    <div className="page">
      <DevicesPageContent
        openCreateModal={openCreateModal}
        webhookLoading={webhookLoading}
        webhookInfo={webhookInfo}
        showWebhookAdvanced={showWebhookAdvanced}
        setShowWebhookAdvanced={setShowWebhookAdvanced}
        formatWebhookUrl={formatWebhookUrl}
        maskWebhookValue={maskWebhookValue}
        copyToClipboard={handleCopyToClipboard}
        getBackendPortLabel={getBackendPortLabel}
        backendDevices={backendDevices}
        backendLoading={backendLoading}
        testingId={testingId}
        testStatus={testStatus}
        loadBackendDevices={loadBackendDevices}
        getCredentialsForBackend={getCredentialsForBackend}
        isCredentialsExpired={isCredentialsExpired}
        isBackendOnline={isBackendOnline}
        onNavigateDetail={(deviceId) => navigate(`/devices/${deviceId}`)}
        onTestConnection={handleTestConnection}
        onOpenCredentialsModal={openCredentialsModal}
        onOpenEditModal={openEditModal}
        onOpenCloneModal={setPendingClone}
        onOpenDeviceCloneModal={openDeviceCloneModal}
        onOpenDeleteModal={setPendingDelete}
      />

      <DevicesPageModals
        isModalOpen={isModalOpen}
        editingBackendId={editingBackendId}
        loading={loading}
        formData={formData}
        setFormData={setFormData}
        closeModal={() => setIsModalOpen(false)}
        handleSubmit={handleSubmit}
        modalDialogRef={modalDialogRef}
        onModalDialogKeyDown={onModalDialogKeyDown}
        isCredentialsModalOpen={isCredentialsModalOpen}
        closeCredentialsModal={() => setIsCredentialsModalOpen(false)}
        credentialsDialogRef={credentialsDialogRef}
        onCredentialsDialogKeyDown={onCredentialsDialogKeyDown}
        deviceLimitReached={deviceLimitReached}
        editingLocalId={editingLocalId}
        pendingDelete={pendingDelete}
        setPendingDelete={setPendingDelete}
        handleDeleteDevice={handleDeleteDevice}
        deleteDialogRef={deleteDialogRef}
        onDeleteDialogKeyDown={onDeleteDialogKeyDown}
        pendingClone={pendingClone}
        cloneStatus={cloneStatus}
        setPendingClone={setPendingClone}
        handleStartClone={handleStartClone}
        cloneDialogRef={cloneDialogRef}
        onCloneDialogKeyDown={onCloneDialogKeyDown}
        pendingDeviceClone={pendingDeviceClone}
        backendDevices={backendDevices}
        sourceCloneId={sourceCloneId}
        setSourceCloneId={setSourceCloneId}
        deviceCloneStatus={deviceCloneStatus}
        setPendingDeviceClone={setPendingDeviceClone}
        handleStartDeviceClone={handleStartDeviceClone}
        deviceCloneDialogRef={deviceCloneDialogRef}
        onDeviceCloneDialogKeyDown={onDeviceCloneDialogKeyDown}
      />
    </div>
  );
}

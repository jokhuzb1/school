import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { BACKEND_URL, fetchDevices, fetchSchoolDevices, fetchUsers, getAuthUser, type DeviceConfig, type SchoolDeviceInfo, type UserInfoEntry } from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { useModalA11y } from '../hooks/useModalA11y';
import { resolveLocalDeviceForBackend } from '../utils/deviceResolver';
import { buildBackendPhotoUrl } from '../utils/photo';
import { useDeviceUserDetail } from '../features/device-detail/useDeviceUserDetail';
import { useDeviceImportWorkflow } from '../features/device-detail/useDeviceImportWorkflow';
import type { DetailTab } from '../features/device-detail/types';
import { useDeviceDetailActions } from './device-detail/useDeviceDetailActions';
import { useDeviceDetailEffects } from './device-detail/useDeviceDetailEffects';
import { DeviceDetailPageView } from './device-detail/DeviceDetailPageView';
export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useGlobalToast();
  const [tab, setTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [schoolDevice, setSchoolDevice] = useState<SchoolDeviceInfo | null>(null);
  const [localDevice, setLocalDevice] = useState<DeviceConfig | null>(null);
  const [allSchoolDevices, setAllSchoolDevices] = useState<SchoolDeviceInfo[]>([]);
  const [allLocalDevices, setAllLocalDevices] = useState<DeviceConfig[]>([]);
  const [users, setUsers] = useState<UserInfoEntry[]>([]);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const autoImportKeyRef = useRef<string | null>(null);
  const [capabilities, setCapabilities] = useState<Record<string, unknown> | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<Record<string, unknown> | null>(null);
  const [timeConfigText, setTimeConfigText] = useState('');
  const [ntpConfigText, setNtpConfigText] = useState('');
  const [networkConfigText, setNetworkConfigText] = useState('');
  const isOnline = useMemo(() => {
    if (!schoolDevice?.lastSeenAt) return false;
    const last = new Date(schoolDevice.lastSeenAt).getTime();
    if (Number.isNaN(last)) return false;
    return Date.now() - last < 2 * 60 * 60 * 1000;
  }, [schoolDevice?.lastSeenAt]);
  const buildPhotoUrl = (value?: string | null): string => buildBackendPhotoUrl(BACKEND_URL, value);
  const findLocalForBackend = (backend: SchoolDeviceInfo, localDevices: DeviceConfig[]) => resolveLocalDeviceForBackend(backend, localDevices).localDevice;
  const loadDetail = useCallback(async () => {
    if (!id) return;
    const user = getAuthUser();
    if (!user?.schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }
    setLoading(true);
    try {
      const [backendDevices, localDevices] = await Promise.all([fetchSchoolDevices(user.schoolId), fetchDevices()]);
      setAllSchoolDevices(backendDevices);
      setAllLocalDevices(localDevices);
      const backend = backendDevices.find((item) => item.id === id) || null;
      setSchoolDevice(backend);
      setLocalDevice(backend ? findLocalForBackend(backend, localDevices) : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Qurilma ma'lumotini yuklab bo'lmadi";
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, id]);
  const loadUsers = useCallback(
    async (reset = true) => {
      if (!localDevice?.id) {
        addToast('Local ulanish sozlamasi topilmadi', 'error');
        return;
      }
      setUsersLoading(true);
      try {
        const offset = reset ? 0 : usersOffset;
        const result = await fetchUsers(localDevice.id, { offset, limit: 30 });
        const list = result.UserInfoSearch?.UserInfo || [];
        const total = result.UserInfoSearch?.totalMatches || 0;
        const loaded = offset + list.length;
        setUsers((prev) => (reset ? list : [...prev, ...list]));
        setUsersTotal(total);
        setUsersOffset(loaded);
        setHasMoreUsers(loaded < total);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Qurilma userlarini olishda xato';
        addToast(message, 'error');
      } finally {
        setUsersLoading(false);
      }
    },
    [addToast, localDevice?.id, usersOffset],
  );
  const {
    busyAction,
    pendingDeleteEmployeeNo,
    setPendingDeleteEmployeeNo,
    sourceCloneId,
    setSourceCloneId,
    withBusy,
    handleTestConnection,
    handleDeleteUser,
    confirmDeleteUser,
    handleRecreateUser,
    saveConfig,
    handleCloneDbToDevice,
    handleCloneDeviceToDevice,
  } = useDeviceDetailActions({
    localDevice,
    schoolDevice,
    allSchoolDevices,
    allLocalDevices,
    findLocalForBackend,
    loadUsers,
    loadDetail,
    addToast,
  });
  const { dialogRef: deleteDialogRef, onDialogKeyDown: onDeleteDialogKeyDown } = useModalA11y(
    Boolean(pendingDeleteEmployeeNo),
    () => setPendingDeleteEmployeeNo(null),
    busyAction?.startsWith('delete-') ?? false,
  );
  const {
    selectedUser,
    selectedStudentDetail,
    deviceFaceMap,
    deviceFaceLoading,
    detailLoading,
    editFirstName,
    editLastName,
    editFatherName,
    editParentPhone,
    editClassId,
    editGender,
    editFacePreview,
    isEditingUser,
    setIsEditingUser,
    setEditFirstName,
    setEditLastName,
    setEditFatherName,
    setEditParentPhone,
    setEditClassId,
    setEditGender,
    handleSelectUser,
    loadDeviceFace,
    closeSelectedUserDetail,
    handleFaceFileChange,
    handleSaveUserEdit,
  } = useDeviceUserDetail({
    localDevice,
    addToast,
    buildPhotoUrl,
    loadUsers,
    withBusy,
  });
  const {
    isImportOpen,
    setIsImportOpen,
    importRows,
    importLoading,
    availableClasses,
    importSyncMode,
    setImportSyncMode,
    importSelectedDeviceIds,
    toggleImportSelectedDevice,
    importPullFace,
    setImportPullFace,
    importJob,
    importAuditTrail,
    importPreview,
    importMetrics,
    previewStats,
    openImportWizard,
    updateImportRow,
    getImportDeviceStatus,
    refreshImportPreview,
    processImportRows,
    saveImportRows,
    retryFailedImportRows,
  } = useDeviceImportWorkflow({
    users,
    schoolDevice,
    localDevice,
    allSchoolDevices,
    allLocalDevices,
    findLocalForBackend,
    loadUsers,
    addToast,
  });
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);
  useDeviceDetailEffects({
    location,
    tab,
    setTab,
    usersLoading,
    usersLength: users.length,
    openImportWizard,
    autoImportKeyRef,
    closeSelectedUserDetail,
    setIsEditingUser,
    loadUsers,
    localDeviceId: localDevice?.id,
    addToast,
    setCapabilities,
    setConfigSnapshot,
    setTimeConfigText,
    setNtpConfigText,
    setNetworkConfigText,
  });
  return (
    <DeviceDetailPageView
      loading={loading}
      schoolDevice={schoolDevice}
      navigate={navigate}
      localDevice={localDevice}
      isOnline={isOnline}
      busyAction={busyAction}
      handleTestConnection={handleTestConnection}
      tab={tab}
      setTab={setTab}
      capabilities={capabilities}
      configSnapshot={configSnapshot}
      timeConfigText={timeConfigText}
      ntpConfigText={ntpConfigText}
      networkConfigText={networkConfigText}
      setTimeConfigText={setTimeConfigText}
      setNtpConfigText={setNtpConfigText}
      setNetworkConfigText={setNetworkConfigText}
      saveConfig={saveConfig}
      users={users}
      usersOffset={usersOffset}
      usersTotal={usersTotal}
      usersLoading={usersLoading}
      hasMoreUsers={hasMoreUsers}
      deviceFaceMap={deviceFaceMap}
      deviceFaceLoading={deviceFaceLoading}
      openImportWizard={openImportWizard}
      loadDeviceFace={loadDeviceFace}
      handleSelectUser={handleSelectUser}
      handleRecreateUser={handleRecreateUser}
      handleDeleteUser={handleDeleteUser}
      loadUsers={loadUsers}
      allSchoolDevices={allSchoolDevices}
      sourceCloneId={sourceCloneId}
      setSourceCloneId={setSourceCloneId}
      handleCloneDbToDevice={handleCloneDbToDevice}
      handleCloneDeviceToDevice={handleCloneDeviceToDevice}
      selectedUser={selectedUser}
      selectedStudentDetail={selectedStudentDetail}
      detailLoading={detailLoading}
      isEditingUser={isEditingUser}
      editFirstName={editFirstName}
      editLastName={editLastName}
      editFatherName={editFatherName}
      editParentPhone={editParentPhone}
      editClassId={editClassId}
      editGender={editGender}
      editFacePreview={editFacePreview}
      setIsEditingUser={setIsEditingUser}
      handleSaveUserEdit={handleSaveUserEdit}
      handleFaceFileChange={handleFaceFileChange}
      setEditFirstName={setEditFirstName}
      setEditLastName={setEditLastName}
      setEditFatherName={setEditFatherName}
      setEditParentPhone={setEditParentPhone}
      setEditClassId={setEditClassId}
      setEditGender={setEditGender}
      closeSelectedUserDetail={closeSelectedUserDetail}
      buildPhotoUrl={buildPhotoUrl}
      isImportOpen={isImportOpen}
      setIsImportOpen={setIsImportOpen}
      importLoading={importLoading}
      importRows={importRows}
      previewStats={previewStats}
      importPreview={importPreview}
      importMetrics={importMetrics}
      importSyncMode={importSyncMode}
      setImportSyncMode={setImportSyncMode}
      importSelectedDeviceIds={importSelectedDeviceIds}
      getImportDeviceStatus={getImportDeviceStatus}
      toggleImportSelectedDevice={toggleImportSelectedDevice}
      importPullFace={importPullFace}
      setImportPullFace={setImportPullFace}
      availableClasses={availableClasses}
      updateImportRow={updateImportRow}
      processImportRows={processImportRows}
      refreshImportPreview={() => refreshImportPreview()}
      saveImportRows={saveImportRows}
      retryFailedImportRows={retryFailedImportRows}
      importJob={importJob}
      importAuditTrail={importAuditTrail}
      pendingDeleteEmployeeNo={pendingDeleteEmployeeNo}
      setPendingDeleteEmployeeNo={setPendingDeleteEmployeeNo}
      deleteDialogRef={deleteDialogRef}
      onDeleteDialogKeyDown={onDeleteDialogKeyDown}
      confirmDeleteUser={confirmDeleteUser}
    />
  );
}

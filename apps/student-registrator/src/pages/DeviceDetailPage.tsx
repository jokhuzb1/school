import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  BACKEND_URL,
  cloneDeviceToDevice,
  cloneStudentsToDevice,
  deleteUser,
  fetchDevices,
  getDeviceCapabilities,
  getDeviceConfiguration,
  fetchSchoolDevices,
  fetchUsers,
  getAuthUser,
  recreateUser,
  testDeviceConnection,
  updateDeviceConfiguration,
  type DeviceConfig,
  type SchoolDeviceInfo,
  type UserInfoEntry,
} from '../api';
import { Icons } from '../components/ui/Icons';
import { useGlobalToast } from '../hooks/useToast';
import { resolveLocalDeviceForBackend } from '../utils/deviceResolver';
import { buildBackendPhotoUrl } from '../utils/photo';
import { ConfigurationTab } from '../features/device-detail/ConfigurationTab';
import { DeviceImportModal } from '../features/device-detail/DeviceImportModal';
import { OverviewTab } from '../features/device-detail/OverviewTab';
import { SyncTab } from '../features/device-detail/SyncTab';
import { UserDetailModal } from '../features/device-detail/UserDetailModal';
import { useDeviceUserDetail } from '../features/device-detail/useDeviceUserDetail';
import { UsersTab } from '../features/device-detail/UsersTab';
import { useDeviceImportWorkflow } from '../features/device-detail/useDeviceImportWorkflow';
import type { DetailTab } from '../features/device-detail/types';

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
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [sourceCloneId, setSourceCloneId] = useState<string>('');
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

  const buildPhotoUrl = (value?: string | null): string => {
    return buildBackendPhotoUrl(BACKEND_URL, value);
  };

  const findLocalForBackend = (
    backend: SchoolDeviceInfo,
    localDevices: DeviceConfig[],
  ) => {
    return resolveLocalDeviceForBackend(backend, localDevices).localDevice;
  };

  const loadDetail = useCallback(async () => {
    if (!id) return;
    const user = getAuthUser();
    if (!user?.schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }

    setLoading(true);
    try {
      const [backendDevices, localDevices] = await Promise.all([
        fetchSchoolDevices(user.schoolId),
        fetchDevices(),
      ]);
      setAllSchoolDevices(backendDevices);
      setAllLocalDevices(localDevices);

      const backend = backendDevices.find((item) => item.id === id) || null;
      setSchoolDevice(backend);
      setLocalDevice(backend ? findLocalForBackend(backend, localDevices) : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Qurilma ma\'lumotini yuklab bo\'lmadi';
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast, id]);

  const loadUsers = useCallback(async (reset = true) => {
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
  }, [addToast, localDevice?.id, usersOffset]);

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

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

  const handleTestConnection = async () => {
    if (!localDevice?.id) {
      addToast('Local ulanish sozlamasi topilmadi', 'error');
      return;
    }
    await withBusy('test-connection', async () => {
      const result = await testDeviceConnection(localDevice.id);
      if (result.ok) {
        addToast('Ulanish muvaffaqiyatli', 'success');
        await loadDetail();
      } else {
        addToast(result.message || 'Ulanish muvaffaqiyatsiz', 'error');
      }
    });
  };

  const handleDeleteUser = async (employeeNo: string) => {
    if (!localDevice?.id) return;
    if (!confirm(`Foydalanuvchini o'chirasizmi? EmployeeNo: ${employeeNo}`)) return;
    await withBusy(`delete-${employeeNo}`, async () => {
      try {
        await deleteUser(localDevice.id, employeeNo);
        addToast('Foydalanuvchi o\'chirildi', 'success');
        await loadUsers(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Delete failed';
        const lower = raw.toLowerCase();
        if (lower.includes('not found')) {
          addToast('Foydalanuvchi topilmadi', 'error');
        } else {
          addToast(raw || 'Foydalanuvchini o\'chirishda xato', 'error');
        }
      }
    });
  };

  const handleRecreateUser = async (user: UserInfoEntry) => {
    if (!localDevice?.id) return;
    await withBusy(`recreate-${user.employeeNo}`, async () => {
      try {
        const result = await recreateUser(
          localDevice.id,
          user.employeeNo,
          user.name,
          (user.gender || 'male').toLowerCase(),
          false,
          true,
        );
        if (result.faceUpload?.ok) {
          addToast(`User recreate qilindi: ${result.employeeNo}`, 'success');
        } else {
          const lower = (result.faceUpload?.errorMsg || '').toLowerCase();
          if (lower.includes('duplicate') || lower.includes('exist')) {
            addToast('Foydalanuvchi allaqachon mavjud', 'error');
          } else {
            addToast(result.faceUpload?.errorMsg || 'Recreate qisman bajarildi', 'error');
          }
        }
        await loadUsers(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Recreate failed';
        const lower = raw.toLowerCase();
        if (lower.includes('not found')) {
          addToast('Foydalanuvchi topilmadi', 'error');
        } else if (lower.includes('upload')) {
          addToast('Face uploadda xato', 'error');
        } else {
          addToast(raw || 'Recreate jarayonida xato', 'error');
        }
      }
    });
  };

  const saveConfig = async (
    key: 'time' | 'ntpServers' | 'networkInterfaces',
    text: string,
  ) => {
    if (!localDevice?.id) return;
    await withBusy(`save-config-${key}`, async () => {
      try {
        const payload = JSON.parse(text);
        await updateDeviceConfiguration({
          deviceId: localDevice.id,
          configType: key,
          payload,
        });
        addToast(`${key} sozlamasi saqlandi`, 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Config save xato';
        addToast(message, 'error');
      }
    });
  };

  const handleCloneDbToDevice = async () => {
    if (!schoolDevice?.id) return;
    await withBusy('clone-db-device', async () => {
      const result = await cloneStudentsToDevice({ backendDeviceId: schoolDevice.id });
      addToast(
        `Clone yakunlandi: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`,
        result.failed > 0 ? 'error' : 'success',
      );
    });
  };

  const handleCloneDeviceToDevice = async () => {
    if (!sourceCloneId || !localDevice?.id) {
      addToast('Manba qurilmani tanlang', 'error');
      return;
    }
    const sourceBackend = allSchoolDevices.find((d) => d.id === sourceCloneId);
    if (!sourceBackend) {
      addToast('Manba qurilma topilmadi', 'error');
      return;
    }
    const sourceLocal = findLocalForBackend(sourceBackend, allLocalDevices);
    if (!sourceLocal?.id) {
      addToast('Manba qurilmaning local ulanish sozlamasi topilmadi', 'error');
      return;
    }
    await withBusy('clone-device-device', async () => {
      const result = await cloneDeviceToDevice({
        sourceDeviceId: sourceLocal.id,
        targetDeviceId: localDevice.id,
      });
      addToast(
        `Clone yakunlandi: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`,
        result.failed > 0 ? 'error' : 'success',
      );
    });
  };

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

  useEffect(() => {
    const queryTab = new URLSearchParams(location.search).get('tab');
    const allowedTabs: DetailTab[] = ['overview', 'configuration', 'users', 'sync'];
    if (queryTab && allowedTabs.includes(queryTab as DetailTab)) {
      setTab(queryTab as DetailTab);
    }
  }, [location.search]);

  useEffect(() => {
    if (tab === 'users') {
      closeSelectedUserDetail();
      setIsEditingUser(false);
      void loadUsers(true);
    }
  }, [tab, localDevice?.id, closeSelectedUserDetail, loadUsers, setIsEditingUser]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldAutoOpenImport = params.get('import') === '1';
    const key = `${location.pathname}${location.search}`;
    if (!shouldAutoOpenImport) return;
    if (tab !== 'users' || usersLoading || users.length === 0) return;
    if (autoImportKeyRef.current === key) return;
    autoImportKeyRef.current = key;
    void openImportWizard();
  }, [location.pathname, location.search, tab, usersLoading, users.length]);

  useEffect(() => {
    const loadConfigData = async () => {
      if (tab !== 'configuration' || !localDevice?.id) return;
      try {
        const [caps, config] = await Promise.all([
          getDeviceCapabilities(localDevice.id),
          getDeviceConfiguration(localDevice.id),
        ]);
        setCapabilities(caps);
        setConfigSnapshot(config);
        setTimeConfigText(JSON.stringify(config?.time || {}, null, 2));
        setNtpConfigText(JSON.stringify(config?.ntpServers || {}, null, 2));
        setNetworkConfigText(JSON.stringify(config?.networkInterfaces || {}, null, 2));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Configuration yuklashda xato';
        addToast(message, 'error');
      }
    };
    loadConfigData();
  }, [tab, localDevice?.id, addToast]);

  if (loading) {
    return (
      <div className="page">
        <p className="notice">Yuklanmoqda...</p>
      </div>
    );
  }

  if (!schoolDevice) {
    return (
      <div className="page">
        <p className="notice notice-warning">Qurilma topilmadi</p>
        <button type="button" className="button button-secondary" onClick={() => navigate('/devices')}>
          <Icons.ChevronLeft /> Ortga
        </button>
      </div>
    );
  }

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'configuration', label: 'Config' },
    { key: 'users', label: 'Users' },
    { key: 'sync', label: 'Sync' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button type="button" className="button button-secondary" onClick={() => navigate('/devices')}>
            <Icons.ChevronLeft /> Qurilmalar ro'yxati
          </button>
          <h1 className="page-title" style={{ marginTop: 12 }}>{schoolDevice.name}</h1>
          <p className="page-description">Qurilma detail boshqaruvi</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleTestConnection}
            disabled={busyAction === 'test-connection'}
          >
            <Icons.Refresh /> Ulanishni tekshirish
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="device-item-meta">
          <span className="badge">ID: {schoolDevice.deviceId || '-'}</span>
          <span className="badge">{schoolDevice.type || '-'}</span>
          <span className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {localDevice ? <span className="badge badge-success">Local ulanish bor</span> : <span className="badge badge-warning">Local ulanish yo'q</span>}
        </div>
      </div>

      <div className="card">
        <div className="panel-header">
          <div className="panel-title">Bo'limlar</div>
          <div className="panel-actions" style={{ gap: 8 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`button ${tab === t.key ? 'button-primary' : 'button-secondary'}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview' && (
          <OverviewTab schoolDevice={schoolDevice} />
        )}

        {tab === 'configuration' && (
          <ConfigurationTab
            schoolDevice={schoolDevice}
            localDevice={localDevice}
            capabilities={capabilities}
            configSnapshot={configSnapshot}
            timeConfigText={timeConfigText}
            ntpConfigText={ntpConfigText}
            networkConfigText={networkConfigText}
            busyAction={busyAction}
            onTimeConfigTextChange={setTimeConfigText}
            onNtpConfigTextChange={setNtpConfigText}
            onNetworkConfigTextChange={setNetworkConfigText}
            onSaveConfig={saveConfig}
          />
        )}

        {tab === 'users' && (
          <UsersTab
            users={users}
            usersOffset={usersOffset}
            usersTotal={usersTotal}
            usersLoading={usersLoading}
            hasMoreUsers={hasMoreUsers}
            deviceFaceMap={deviceFaceMap}
            deviceFaceLoading={deviceFaceLoading}
            busyAction={busyAction}
            onOpenImportWizard={openImportWizard}
            onLoadDeviceFace={loadDeviceFace}
            onSelectUser={handleSelectUser}
            onRecreateUser={handleRecreateUser}
            onDeleteUser={handleDeleteUser}
            onLoadMoreUsers={() => loadUsers(false)}
          />
        )}

        {tab === 'sync' && (
          <SyncTab
            schoolDeviceId={schoolDevice.id}
            allSchoolDevices={allSchoolDevices}
            sourceCloneId={sourceCloneId}
            busyAction={busyAction}
            onSourceCloneChange={setSourceCloneId}
            onCloneDbToDevice={handleCloneDbToDevice}
            onCloneDeviceToDevice={handleCloneDeviceToDevice}
          />
        )}
      </div>

      <UserDetailModal
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
        deviceFaceMap={deviceFaceMap}
        busyAction={busyAction}
        buildPhotoUrl={buildPhotoUrl}
        onClose={closeSelectedUserDetail}
        onToggleEdit={() => setIsEditingUser((prev) => !prev)}
        onSave={handleSaveUserEdit}
        onFaceFileChange={handleFaceFileChange}
        onEditFirstNameChange={setEditFirstName}
        onEditLastNameChange={setEditLastName}
        onEditFatherNameChange={setEditFatherName}
        onEditParentPhoneChange={setEditParentPhone}
        onEditClassIdChange={setEditClassId}
        onEditGenderChange={setEditGender}
      />

      <DeviceImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        importLoading={importLoading}
        importRows={importRows}
        previewStats={previewStats}
        importPreview={importPreview}
        importMetrics={importMetrics}
        importSyncMode={importSyncMode}
        onImportSyncModeChange={setImportSyncMode}
        importSelectedDeviceIds={importSelectedDeviceIds}
        allSchoolDevices={allSchoolDevices}
        getImportDeviceStatus={getImportDeviceStatus}
        onToggleImportSelectedDevice={toggleImportSelectedDevice}
        importPullFace={importPullFace}
        onImportPullFaceChange={setImportPullFace}
        availableClasses={availableClasses}
        updateImportRow={updateImportRow}
        processImportRows={processImportRows}
        refreshImportPreview={() => refreshImportPreview()}
        saveImportRows={saveImportRows}
        retryFailedImportRows={retryFailedImportRows}
        importJob={importJob}
        importAuditTrail={importAuditTrail}
      />
    </div>
  );
}

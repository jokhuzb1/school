import { Icons } from '../../components/ui/Icons';
import { ConfigurationTab } from '../../features/device-detail/ConfigurationTab';
import { DeviceImportModal } from '../../features/device-detail/DeviceImportModal';
import { OverviewTab } from '../../features/device-detail/OverviewTab';
import { SyncTab } from '../../features/device-detail/SyncTab';
import { UserDetailModal } from '../../features/device-detail/UserDetailModal';
import { UsersTab } from '../../features/device-detail/UsersTab';
import type { DetailTab } from '../../features/device-detail/types';
import { DeleteUserDialog } from './DeleteUserDialog';
import type { DeviceDetailPageViewProps } from './DeviceDetailPageView.types';

export function DeviceDetailPageView({
  loading,
  schoolDevice,
  navigate,
  localDevice,
  isOnline,
  busyAction,
  handleTestConnection,
  tab,
  setTab,
  capabilities,
  configSnapshot,
  timeConfigText,
  ntpConfigText,
  networkConfigText,
  setTimeConfigText,
  setNtpConfigText,
  setNetworkConfigText,
  saveConfig,
  users,
  usersOffset,
  usersTotal,
  usersLoading,
  hasMoreUsers,
  deviceFaceMap,
  deviceFaceLoading,
  openImportWizard,
  loadDeviceFace,
  handleSelectUser,
  handleRecreateUser,
  handleDeleteUser,
  loadUsers,
  allSchoolDevices,
  sourceCloneId,
  setSourceCloneId,
  handleCloneDbToDevice,
  handleCloneDeviceToDevice,
  selectedUser,
  selectedStudentDetail,
  detailLoading,
  isEditingUser,
  editFirstName,
  editLastName,
  editFatherName,
  editParentPhone,
  editClassId,
  editGender,
  editFacePreview,
  setIsEditingUser,
  handleSaveUserEdit,
  handleFaceFileChange,
  setEditFirstName,
  setEditLastName,
  setEditFatherName,
  setEditParentPhone,
  setEditClassId,
  setEditGender,
  closeSelectedUserDetail,
  buildPhotoUrl,
  isImportOpen,
  setIsImportOpen,
  importLoading,
  importRows,
  previewStats,
  importPreview,
  importMetrics,
  importSyncMode,
  setImportSyncMode,
  importSelectedDeviceIds,
  getImportDeviceStatus,
  toggleImportSelectedDevice,
  importPullFace,
  setImportPullFace,
  availableClasses,
  updateImportRow,
  processImportRows,
  refreshImportPreview,
  saveImportRows,
  retryFailedImportRows,
  importJob,
  importAuditTrail,
  pendingDeleteEmployeeNo,
  setPendingDeleteEmployeeNo,
  deleteDialogRef,
  onDeleteDialogKeyDown,
  confirmDeleteUser,
}: DeviceDetailPageViewProps) {
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
            onClick={() => void handleTestConnection()}
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
          <span className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>{isOnline ? 'Online' : 'Offline'}</span>
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

        {tab === 'overview' && <OverviewTab schoolDevice={schoolDevice} />}

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
        refreshImportPreview={refreshImportPreview}
        saveImportRows={saveImportRows}
        retryFailedImportRows={retryFailedImportRows}
        importJob={importJob}
        importAuditTrail={importAuditTrail}
      />

      <DeleteUserDialog
        pendingDeleteEmployeeNo={pendingDeleteEmployeeNo}
        setPendingDeleteEmployeeNo={setPendingDeleteEmployeeNo}
        deleteDialogRef={deleteDialogRef}
        onDeleteDialogKeyDown={onDeleteDialogKeyDown}
        confirmDeleteUser={confirmDeleteUser}
      />
    </div>
  );
}

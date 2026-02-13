import { ExcelImportButton } from '../../components/students/ExcelImportButton';
import { Icons } from '../../components/ui/Icons';
import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import type { DeviceSelectionStatus } from '../../utils/deviceStatus';

type AddStudentsPageHeaderProps = {
  setIsClassModalOpen: (next: boolean) => void;
  openDeviceModeImportModal: () => void;
  backendDevices: SchoolDeviceInfo[];
  isDeviceImporting: boolean;
  isDeviceDropdownOpen: boolean;
  setIsDeviceDropdownOpen: (next: boolean | ((prev: boolean) => boolean)) => void;
  selectedDeviceIds: string[];
  handleToggleAllDevices: (next: boolean) => void;
  refreshDeviceStatuses: (backendList: SchoolDeviceInfo[], localList?: DeviceConfig[]) => Promise<void>;
  credentials: DeviceConfig[];
  deviceStatusLoading: boolean;
  handleToggleDevice: (deviceId: string) => void;
  deviceStatus: Record<string, DeviceSelectionStatus>;
  handleExcelImport: (file: File) => Promise<void>;
  loading: boolean;
  setIsTemplateModalOpen: (next: boolean) => void;
  lastProvisioningId: string | null;
  setIsProvModalOpen: (next: boolean) => void;
  pendingCount: number;
  isSaving: boolean;
  handleSaveAll: () => void;
};

export function AddStudentsPageHeader({
  setIsClassModalOpen,
  openDeviceModeImportModal,
  backendDevices,
  isDeviceImporting,
  isDeviceDropdownOpen,
  setIsDeviceDropdownOpen,
  selectedDeviceIds,
  handleToggleAllDevices,
  refreshDeviceStatuses,
  credentials,
  deviceStatusLoading,
  handleToggleDevice,
  deviceStatus,
  handleExcelImport,
  loading,
  setIsTemplateModalOpen,
  lastProvisioningId,
  setIsProvModalOpen,
  pendingCount,
  isSaving,
  handleSaveAll,
}: AddStudentsPageHeaderProps) {
  return (
    <div className="page-header">
      <div className="header-main">
        <h1 className="page-title">O'quvchilar qo'shish</h1>
        <p className="page-description">Jadvalni to'ldiring, Excel yuklang yoki qurilmadan import qiling</p>
      </div>

      <div className="page-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => setIsClassModalOpen(true)}
          title="Yangi sinf qo'shish"
        >
          <Icons.Plus />
          <span>Sinf</span>
        </button>

        <button
          type="button"
          className="button button-secondary"
          onClick={openDeviceModeImportModal}
          disabled={backendDevices.length === 0 || isDeviceImporting}
          title="Qurilmadan jadvalga import (device mode)"
          aria-label="Qurilmadan jadvalga import (device mode)"
        >
          <Icons.Download />
          <span>{isDeviceImporting ? 'Import...' : 'Qurilmadan'}</span>
        </button>

        <div className="device-select">
          <button
            type="button"
            className="device-select-trigger"
            onClick={() => setIsDeviceDropdownOpen((prev) => !prev)}
            title="Qurilma tanlovi"
          >
            <Icons.Monitor />
            <span>Tanlangan: {selectedDeviceIds.length}</span>
            <Icons.ChevronDown />
          </button>
          {isDeviceDropdownOpen && (
            <div className="device-select-menu">
              <div className="device-select-header">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={backendDevices.length > 0 && selectedDeviceIds.length === backendDevices.length}
                    onChange={(e) => handleToggleAllDevices(e.target.checked)}
                  />
                  <span>Barchasi</span>
                </label>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => void refreshDeviceStatuses(backendDevices, credentials)}
                  disabled={deviceStatusLoading || backendDevices.length === 0}
                  title="Yangilash"
                  aria-label="Qurilmalarni yangilash"
                >
                  <Icons.Refresh />
                </button>
              </div>
              <div className="device-select-list">
                {backendDevices.length === 0 && <div className="device-select-empty">Qurilmalar topilmadi</div>}
                {backendDevices.map((device) => {
                  const status = deviceStatus[device.id] || 'unknown';
                  const isSelected = selectedDeviceIds.includes(device.id);
                  return (
                    <label key={device.id} className="device-select-item">
                      <input type="checkbox" checked={isSelected} onChange={() => handleToggleDevice(device.id)} />
                      <span className="device-select-name">{device.name}</span>
                      <div
                        className={`status-dot ${status === 'no_credentials' ? 'unknown' : status}`}
                        title={status}
                      ></div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <ExcelImportButton onImport={handleExcelImport} disabled={loading} />

        <button
          type="button"
          className="button button-secondary"
          onClick={() => setIsTemplateModalOpen(true)}
          disabled={loading}
          title="Shablon yuklash"
        >
          <Icons.FileText />
          <span>Shablon</span>
        </button>

        {lastProvisioningId && (
          <button
            type="button"
            className="button button-icon"
            onClick={() => setIsProvModalOpen(true)}
            title="Provisioning holati"
            aria-label="Provisioning holatini ochish"
          >
            <Icons.Refresh />
          </button>
        )}

        {pendingCount > 0 && (
          <button className="button button-success" onClick={handleSaveAll} disabled={isSaving}>
            <Icons.Save />
            <span>Saqlash ({pendingCount})</span>
          </button>
        )}
      </div>
    </div>
  );
}

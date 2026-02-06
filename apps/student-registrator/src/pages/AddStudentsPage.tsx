import { useState, useEffect, useCallback } from 'react';
import {
  fetchSchools,
  fetchClasses,
  fetchSchoolDevices,
  fetchDevices,
  testDeviceConnection,
  getAuthUser,
} from '../api';
import { useStudentTable } from '../hooks/useStudentTable';
import { useExcelImport } from '../hooks/useExcelImport';
import { useGlobalToast } from '../hooks/useToast';
import { StudentTable } from '../components/students/StudentTable';
import { ExcelImportButton } from '../components/students/ExcelImportButton';
import { ImportMappingPanel } from '../components/students/ImportMappingPanel';
import { ProvisioningPanel } from '../components/students/ProvisioningPanel';
import type { DeviceStatus } from '../components/students/DeviceTargetsPanel';
import { downloadStudentsTemplate } from '../services/excel.service';
import { Icons } from '../components/ui/Icons';
import type { ClassInfo, DeviceConfig, SchoolDeviceInfo } from '../types';

export function AddStudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [credentials, setCredentials] = useState<DeviceConfig[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<Record<string, DeviceStatus>>({});
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceSelectionTouched, setDeviceSelectionTouched] = useState(false);
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);

  const {
    students,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    applyClassMapping,
    saveStudent,
    saveAllPending,
    isSaving,
    lastRegisterResult,
    lastProvisioningId,
  } = useStudentTable();
  const { parseExcel, resizeImages } = useExcelImport();
  const { addToast } = useGlobalToast();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.device-select')) return;
      setIsDeviceDropdownOpen(false);
    };
    if (isDeviceDropdownOpen) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isDeviceDropdownOpen]);

  const refreshDeviceStatuses = useCallback(async (
    backendList: SchoolDeviceInfo[],
    localList?: DeviceConfig[],
  ) => {
    if (backendList.length === 0) {
      setDeviceStatus({});
      return;
    }

    const normalize = (value?: string | null) => (value || '').trim().toLowerCase();
    const isCredentialsExpired = (device?: DeviceConfig | null) => {
      if (!device?.credentialsExpiresAt) return false;
      const expires = new Date(device.credentialsExpiresAt).getTime();
      if (Number.isNaN(expires)) return false;
      return Date.now() > expires;
    };

    setDeviceStatusLoading(true);
    try {
      const local = localList ?? await fetchDevices();
      if (!localList) setCredentials(local);

      const byBackendId = new Map<string, DeviceConfig>();
      const byDeviceId = new Map<string, DeviceConfig>();
      local.forEach((device) => {
        if (device.backendId) byBackendId.set(device.backendId, device);
        if (device.deviceId) byDeviceId.set(normalize(device.deviceId), device);
      });

      const results = await Promise.all(
        backendList.map(async (device) => {
          const localDevice =
            byBackendId.get(device.id) ||
            (device.deviceId ? byDeviceId.get(normalize(device.deviceId)) : undefined);
          if (!localDevice || isCredentialsExpired(localDevice)) {
            return { backendId: device.id, status: 'unknown' as DeviceStatus };
          }
          try {
            const result = await testDeviceConnection(localDevice.id);
            return { backendId: device.id, status: (result.ok ? 'online' : 'offline') as DeviceStatus };
          } catch (err) {
            return { backendId: device.id, status: 'offline' as DeviceStatus };
          }
        }),
      );

      const nextStatus: Record<string, DeviceStatus> = {};
      results.forEach((item) => {
        nextStatus[item.backendId] = item.status;
      });
      setDeviceStatus(nextStatus);
    } catch (err) {
      console.error('Failed to refresh device status:', err);
      addToast('Qurilma holatini tekshirishda xato', 'error');
    } finally {
      setDeviceStatusLoading(false);
    }
  }, [addToast]);

  const handleToggleDevice = (deviceId: string) => {
    setDeviceSelectionTouched(true);
    setSelectedDeviceIds((prev) =>
      prev.includes(deviceId) ? prev.filter((id) => id !== deviceId) : [...prev, deviceId],
    );
  };

  const handleToggleAllDevices = (next: boolean) => {
    setDeviceSelectionTouched(true);
    setSelectedDeviceIds(next ? backendDevices.map((d) => d.id) : []);
  };

  // Load school and classes
  useEffect(() => {
    const loadData = async () => {
      const user = getAuthUser();
      if (!user) return;

      try {
        const schools = await fetchSchools();
        const schoolId = user.schoolId || schools[0]?.id;
        
        if (schoolId) {
          const [classes, devices, local] = await Promise.all([
            fetchClasses(schoolId),
            fetchSchoolDevices(schoolId),
            fetchDevices(),
          ]);
          console.log('[AddStudents] Loaded classes from backend:', classes);
          setAvailableClasses(classes);
          setBackendDevices(devices);
          setCredentials(local);
          await refreshDeviceStatuses(devices, local);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        addToast('Ma\'lumotlarni yuklashda xato', 'error');
      }
    };

    loadData();
  }, [addToast, refreshDeviceStatuses]);

  useEffect(() => {
    if (!deviceSelectionTouched) {
      setSelectedDeviceIds(backendDevices.map((d) => d.id));
    }
  }, [backendDevices, deviceSelectionTouched]);

  // Handle Excel import
  const handleExcelImport = async (file: File) => {
    console.log('[Excel Import] Starting with availableClasses:', availableClasses);
    
    if (availableClasses.length === 0) {
      addToast('Sinflar yuklanmagan! Sahifani yangilang.', 'error');
      return;
    }
    
    setLoading(true);
    try {
      const rows = await parseExcel(file, availableClasses);
      const resized = await resizeImages(rows);
      
      // Check if all rows have classId
      const withoutClass = resized.filter(r => !r.classId);
      if (withoutClass.length > 0) {
        const missingNames = withoutClass.map((r) => `${r.lastName || ''} ${r.firstName || ''}`.trim());
        console.warn('[Excel Import] Rows without classId:', missingNames);
        addToast(`${withoutClass.length} ta o'quvchining sinfi topilmadi!`, 'error');
      }
      
      importStudents(resized);
      addToast(`${resized.length} ta o'quvchi yuklandi`, 'success');
    } catch (err) {
      console.error('Excel import error:', err);
      addToast('Excel yuklashda xato', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (availableClasses.length === 0) {
      addToast('Sinflar yuklanmagan!', 'error');
      return;
    }
    try {
      await downloadStudentsTemplate(availableClasses.map((cls) => cls.name));
      addToast('Shablon yuklandi', 'success');
    } catch (err) {
      console.error('Template download error:', err);
      addToast('Shablon yuklashda xato', 'error');
    }
  };

  // Handle save student
  const handleSaveStudent = async (id: string) => {
    if (selectedDeviceIds.length === 0) {
      addToast('Qurilma tanlanmagan', 'error');
      return;
    }
    try {
      await saveStudent(id, selectedDeviceIds);
      addToast('O\'quvchi saqlandi', 'success');
    } catch (err: any) {
      // Check if it's validation error
      const errorMsg = err?.message || 'Saqlashda xato';
      addToast(errorMsg, 'error');
    }
  };

  // Handle save all
  const handleSaveAll = async () => {
    if (selectedDeviceIds.length === 0) {
      addToast('Qurilma tanlanmagan', 'error');
      return;
    }
    const pendingCount = students.filter(s => s.status === 'pending').length;
    if (pendingCount === 0) {
      addToast('Saqlanishi kerak bo\'lgan o\'quvchilar yo\'q', 'error');
      return;
    }

    try {
      const { successCount, errorCount } = await saveAllPending(selectedDeviceIds);
      if (errorCount > 0) {
        addToast(`${errorCount} ta xato, ${successCount} ta saqlandi`, 'error');
        return;
      }
      addToast(`${successCount} ta o'quvchi saqlandi`, 'success');
    } catch (err) {
      addToast('Ba\'zi o\'quvchilarni saqlashda xato', 'error');
    }
  };

  const pendingCount = students.filter(s => s.status === 'pending').length;
  const successCount = students.filter(s => s.status === 'success').length;
  const errorCount = students.filter(s => s.status === 'error').length;

  // Add empty row handler
  const handleAddRow = () => {
    addStudent({
      firstName: '',
      lastName: '',
      fatherName: undefined,
      gender: 'male',
      classId: undefined,
      className: undefined,
      parentPhone: undefined,
      imageBase64: undefined,
    });
  };

  const handleApplyMapping = (className: string, classId: string) => {
    if (!classId) return;
    const selectedClass = availableClasses.find((cls) => cls.id === classId);
    applyClassMapping(className, classId, selectedClass?.name);
  };

  return (
    <div className="page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar qo'shish</h1>
          <p className="page-description">
            Jadvalni to'ldiring yoki Excel yuklang
          </p>
        </div>

        <div className="page-actions">
          <div className="device-select">
            <button
              type="button"
              className="device-select-trigger"
              onClick={() => setIsDeviceDropdownOpen((prev) => !prev)}
              title="Qurilma tanlovi"
            >
              <Icons.Monitor />
              <span>Qurilmalar ({selectedDeviceIds.length}/{backendDevices.length})</span>
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
                    onClick={() => refreshDeviceStatuses(backendDevices, credentials)}
                    disabled={deviceStatusLoading || backendDevices.length === 0}
                    title="Yangilash"
                    aria-label="Yangilash"
                  >
                    <Icons.Refresh />
                  </button>
                </div>
                <div className="device-select-list">
                  {backendDevices.length === 0 && (
                    <div className="device-select-empty">Qurilmalar topilmadi</div>
                  )}
                  {backendDevices.map((device) => {
                    const status = deviceStatus[device.id] || 'unknown';
                    const isSelected = selectedDeviceIds.includes(device.id);
                    return (
                      <label key={device.id} className="device-select-item">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleDevice(device.id)}
                        />
                        <span className="device-select-name">{device.name}</span>
                        <span
                          className={`badge ${
                            status === 'online'
                              ? 'badge-success'
                              : status === 'offline'
                              ? 'badge-danger'
                              : ''
                          }`}
                        >
                          {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : "Sozlanmagan"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <ExcelImportButton 
            onImport={handleExcelImport} 
            disabled={loading}
          />
          <button
            type="button"
            className="device-select-trigger"
            onClick={handleDownloadTemplate}
            disabled={loading}
            title="Shablon yuklash"
            aria-label="Shablon yuklash"
          >
            <Icons.Download />
            <span>Shablon yuklash</span>
          </button>

          {pendingCount > 0 && (
            <button 
              className="button button-success" 
              onClick={handleSaveAll}
              disabled={isSaving}
            >
              <Icons.Save /> Barchasini Saqlash ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {students.length > 0 && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Jami:</span>
            <span className="stat-value">{students.length}</span>
          </div>
          <div className="stat-item stat-warning">
            <span className="stat-label">Kutilmoqda:</span>
            <span className="stat-value">{pendingCount}</span>
          </div>
          <div className="stat-item stat-success">
            <span className="stat-label">Saqlandi:</span>
            <span className="stat-value">{successCount}</span>
          </div>
          {errorCount > 0 && (
            <div className="stat-item stat-danger">
              <span className="stat-label">Xato:</span>
              <span className="stat-value">{errorCount}</span>
            </div>
          )}
        </div>
      )}

      <ImportMappingPanel
        students={students}
        availableClasses={availableClasses}
        onApplyMapping={handleApplyMapping}
      />

      <ProvisioningPanel
        provisioningId={lastProvisioningId}
        registerResult={lastRegisterResult}
      />

      {/* Table */}
      <div className="page-content">
        <StudentTable
          students={students}
          availableClasses={availableClasses}
          onEdit={updateStudent}
          onDelete={(id) => {
            deleteStudent(id);
            addToast('O\'quvchi o\'chirildi', 'success');
          }}
          onSave={handleSaveStudent}
          onAddRow={handleAddRow}
        />
      </div>
    </div>
  );
}

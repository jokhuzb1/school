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
import { DeviceTargetsPanel, type DeviceStatus } from '../components/students/DeviceTargetsPanel';
import { downloadStudentsTemplate } from '../services/excel.service';
import { Icons } from '../components/ui/Icons';
import type { ClassInfo, DeviceConfig, DeviceConnectionResult, SchoolDeviceInfo } from '../types';

export function AddStudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [, setLocalDevices] = useState<DeviceConfig[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<Record<string, DeviceStatus>>({});
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceSelectionTouched, setDeviceSelectionTouched] = useState(false);

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

  const refreshDeviceStatuses = useCallback(async (
    backendList: SchoolDeviceInfo[],
    localList?: DeviceConfig[],
  ) => {
    const backend = backendList;
    if (backend.length === 0) {
      setDeviceStatus({});
      return;
    }

    setDeviceStatusLoading(true);
    try {
      const local = localList ?? await fetchDevices();
      if (!localList) setLocalDevices(local);

      const results = await Promise.all(
        local.map(async (device) => {
          try {
            const result = await testDeviceConnection(device.id);
            return { device, result };
          } catch (err) {
            const fallback: DeviceConnectionResult = { ok: false };
            return { device, result: fallback };
          }
        }),
      );

      const statusByExternalId = new Map<string, DeviceStatus>();
      results.forEach(({ device, result }) => {
        const externalId = result.deviceId || device.deviceId;
        if (!externalId) return;
        statusByExternalId.set(externalId, result.ok ? 'online' : 'offline');
      });

      const nextStatus: Record<string, DeviceStatus> = {};
      backend.forEach((device) => {
        if (device.deviceId && statusByExternalId.has(device.deviceId)) {
          nextStatus[device.id] = statusByExternalId.get(device.deviceId) || 'offline';
        } else {
          nextStatus[device.id] = local.length === 0 ? 'unknown' : 'offline';
        }
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
          setLocalDevices(local);
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
        console.warn('[Excel Import] Rows without classId:', withoutClass.map(r => r.name));
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
      name: '',
      gender: 'male',
      classId: undefined,
      className: undefined,
      parentName: undefined,
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
          <ExcelImportButton 
            onImport={handleExcelImport} 
            disabled={loading}
          />
          <button
            type="button"
            className="button button-secondary"
            onClick={handleDownloadTemplate}
            disabled={loading}
          >
            <Icons.Download /> Shablon yuklash
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

      <DeviceTargetsPanel
        devices={backendDevices}
        selectedIds={selectedDeviceIds}
        statusById={deviceStatus}
        onToggle={handleToggleDevice}
        onToggleAll={handleToggleAllDevices}
        onRefresh={() => refreshDeviceStatuses(backendDevices)}
        refreshing={deviceStatusLoading}
      />

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

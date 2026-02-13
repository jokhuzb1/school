import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStudentTable } from '../hooks/useStudentTable';
import { useExcelImport } from '../hooks/useExcelImport';
import { useGlobalToast } from '../hooks/useToast';
import { useModalA11y } from '../hooks/useModalA11y';
import type { ClassInfo, DeviceConfig, SchoolDeviceInfo } from '../types';
import { useDeviceModeImport } from '../features/add-students/useDeviceModeImport';
import { type DeviceSelectionStatus } from '../utils/deviceStatus';
import { AddStudentsPageHeader } from './add-students/AddStudentsPageHeader';
import { AddStudentsPageContent } from './add-students/AddStudentsPageContent';
import { AddStudentsPageModals } from './add-students/AddStudentsPageModals';
import {
  handleConfirmSaveAllAction,
  handleCreateClassAction,
  handleExcelImportAction,
  handleSaveStudentAction,
  handleTemplateDownloadAction,
  loadAddStudentsDataAction,
  refreshDeviceStatusesAction,
} from './add-students/actions';
export function AddStudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [credentials, setCredentials] = useState<DeviceConfig[]>([]);
  const [deviceStatus, setDeviceStatus] = useState<Record<string, DeviceSelectionStatus>>({});
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(false);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceSelectionTouched, setDeviceSelectionTouched] = useState(false);
  const [isDeviceDropdownOpen, setIsDeviceDropdownOpen] = useState(false);
  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState<number>(1);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isProvModalOpen, setIsProvModalOpen] = useState(false);
  const [isTargetSaveModalOpen, setIsTargetSaveModalOpen] = useState(false);
  const { dialogRef: provDialogRef, onDialogKeyDown: onProvDialogKeyDown } = useModalA11y(
    isProvModalOpen,
    () => setIsProvModalOpen(false),
  );
  const { dialogRef: classDialogRef, onDialogKeyDown: onClassDialogKeyDown } = useModalA11y(
    isClassModalOpen,
    () => setIsClassModalOpen(false),
    isCreatingClass,
  );
  const resolveDeviceLabel = useCallback((input: string) => {
    if (!backendDevices.length) return input;
    const byId = new Map(backendDevices.map((d) => [d.id, d.name]));
    return input.replace(/Backend ([a-f0-9-]{36})/gi, (full, id) => {
      const name = byId.get(id);
      if (!name) return full;
      return name;
    });
  }, [backendDevices]);
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
  } = useStudentTable({ resolveDeviceLabel });
  const { parseExcel, resizeImages } = useExcelImport();
  const { addToast } = useGlobalToast();
  const {
    isDeviceImporting,
    isSourceImportModalOpen,
    sourceImportDeviceIds,
    refreshingFaceIds,
    openDeviceModeImportModal,
    closeSourceImportModal,
    toggleSourceImportDevice,
    confirmDeviceModeImport,
    refreshFaceForStudent,
  } = useDeviceModeImport({
    backendDevices,
    credentials,
    selectedDeviceIds,
    students,
    importStudents,
    updateStudent,
    addToast,
  });
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
    await refreshDeviceStatusesAction({
      backendList,
      localList,
      setDeviceStatus,
      setDeviceStatusLoading,
      setCredentials,
      addToast,
    });
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
      await loadAddStudentsDataAction({
        addToast,
        setAvailableClasses,
        setBackendDevices,
        setCredentials,
        refreshDeviceStatuses,
      });
    };
    void loadData();
  }, [addToast, refreshDeviceStatuses]);
  useEffect(() => {
    if (!deviceSelectionTouched) {
      setSelectedDeviceIds(backendDevices.map((d) => d.id));
    }
  }, [backendDevices, deviceSelectionTouched]);
  // Handle Excel import
  const handleExcelImport = async (file: File) => {
    await handleExcelImportAction({
      availableClasses,
      parseExcel,
      resizeImages,
      importStudents,
      addToast,
      setLoading,
      file,
    });
  };
  const handleTemplateDownload = async (classNames: string[]) => {
    await handleTemplateDownloadAction({ classNames, addToast });
  };
  // Handle save student
  const handleSaveStudent = async (id: string) => {
    await handleSaveStudentAction({
      id,
      selectedDeviceIds,
      saveStudent,
      addToast,
    });
  };
  // Handle save all
  const handleSaveAll = async () => {
    setIsTargetSaveModalOpen(true);
  };
  const handleConfirmSaveAll = async () => {
    await handleConfirmSaveAllAction({
      students,
      saveAllPending,
      selectedDeviceIds,
      addToast,
      setIsTargetSaveModalOpen,
    });
  };
  const pendingCount = students.filter(s => s.status === 'pending').length;
  const successCount = students.filter(s => s.status === 'success').length;
  const errorCount = students.filter(s => s.status === 'error').length;
  const errorRows = useMemo(
    () =>
      students
        .map((student, index) => ({ student, index: index + 1 }))
        .filter((item) => item.student.status === 'error'),
    [students],
  );
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
  const handleCreateClass = async (e: React.FormEvent) =>
    handleCreateClassAction({
      e,
      newClassName,
      newClassGrade,
      addToast,
      setAvailableClasses,
      setIsClassModalOpen,
      setNewClassName,
      setNewClassGrade,
      setIsCreatingClass,
    });
  return (
    <div className="page">
      <AddStudentsPageHeader
        setIsClassModalOpen={setIsClassModalOpen}
        openDeviceModeImportModal={openDeviceModeImportModal}
        backendDevices={backendDevices}
        isDeviceImporting={isDeviceImporting}
        isDeviceDropdownOpen={isDeviceDropdownOpen}
        setIsDeviceDropdownOpen={setIsDeviceDropdownOpen}
        selectedDeviceIds={selectedDeviceIds}
        handleToggleAllDevices={handleToggleAllDevices}
        refreshDeviceStatuses={refreshDeviceStatuses}
        credentials={credentials}
        deviceStatusLoading={deviceStatusLoading}
        handleToggleDevice={handleToggleDevice}
        deviceStatus={deviceStatus}
        handleExcelImport={handleExcelImport}
        loading={loading}
        setIsTemplateModalOpen={setIsTemplateModalOpen}
        lastProvisioningId={lastProvisioningId}
        setIsProvModalOpen={setIsProvModalOpen}
        pendingCount={pendingCount}
        isSaving={isSaving}
        handleSaveAll={handleSaveAll}
      />
      <AddStudentsPageContent
        students={students}
        pendingCount={pendingCount}
        successCount={successCount}
        errorCount={errorCount}
        errorRows={errorRows}
        availableClasses={availableClasses}
        handleApplyMapping={handleApplyMapping}
        updateStudent={updateStudent}
        deleteStudent={deleteStudent}
        addToast={addToast}
        handleSaveStudent={handleSaveStudent}
        refreshFaceForStudent={refreshFaceForStudent}
        refreshingFaceIds={refreshingFaceIds}
        handleAddRow={handleAddRow}
      />
      <AddStudentsPageModals
        isProvModalOpen={isProvModalOpen}
        setIsProvModalOpen={setIsProvModalOpen}
        provDialogRef={provDialogRef}
        onProvDialogKeyDown={onProvDialogKeyDown}
        lastProvisioningId={lastProvisioningId}
        lastRegisterResult={lastRegisterResult}
        isSourceImportModalOpen={isSourceImportModalOpen}
        backendDevices={backendDevices}
        sourceImportDeviceIds={sourceImportDeviceIds}
        toggleSourceImportDevice={toggleSourceImportDevice}
        closeSourceImportModal={closeSourceImportModal}
        confirmDeviceModeImport={confirmDeviceModeImport}
        isDeviceImporting={isDeviceImporting}
        isTargetSaveModalOpen={isTargetSaveModalOpen}
        selectedDeviceIds={selectedDeviceIds}
        handleToggleDevice={handleToggleDevice}
        setIsTargetSaveModalOpen={setIsTargetSaveModalOpen}
        isSaving={isSaving}
        handleConfirmSaveAll={handleConfirmSaveAll}
        deviceStatus={deviceStatus}
        isClassModalOpen={isClassModalOpen}
        setIsClassModalOpen={setIsClassModalOpen}
        classDialogRef={classDialogRef}
        onClassDialogKeyDown={onClassDialogKeyDown}
        handleCreateClass={handleCreateClass}
        newClassName={newClassName}
        setNewClassName={setNewClassName}
        newClassGrade={newClassGrade}
        setNewClassGrade={setNewClassGrade}
        isCreatingClass={isCreatingClass}
        isTemplateModalOpen={isTemplateModalOpen}
        setIsTemplateModalOpen={setIsTemplateModalOpen}
        availableClasses={availableClasses}
        handleTemplateDownload={handleTemplateDownload}
      />
    </div>
  );
}

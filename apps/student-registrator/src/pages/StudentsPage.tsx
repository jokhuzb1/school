import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchClasses,
  fetchDevices,
  fetchSchoolDevices,
  fetchStudentDiagnostics,
  getAuthUser,
  BACKEND_URL,
} from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { useTableSelection } from '../hooks/useTableSelection';
import { useTableSort } from '../hooks/useTableSort';
import { useStudentEdit } from '../features/students/useStudentEdit';
import type { ClassInfo, StudentDiagnosticsResponse, StudentDiagnosticsRow } from '../types';
import { buildBackendPhotoUrl } from '../utils/photo';
import { appLogger } from '../utils/logger';
import { splitPersonNameWithFather } from '../utils/name';
import {
  formatDateTime,
  mapBackendStatus,
  PAGE_SIZE,
  statusBadgeClass,
  statusLabel,
  statusReason,
  summarizeStatuses,
  type DeviceFaceFetchState,
  type DeviceOnlyMeta,
  type StudentLiveState,
} from './students/helpers';
import { runLiveCheckAction } from './students/runLiveCheck';
import { useStudentsDeviceDiscovery } from './students/useStudentsDeviceDiscovery';
import { buildStudentsColumns } from './students/columns';
import { StudentsPageView } from './students/StudentsPageView';

export function StudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [localDevices, setLocalDevices] = useState<Awaited<ReturnType<typeof fetchDevices>>>([]);
  const [backendDevices, setBackendDevices] = useState<Awaited<ReturnType<typeof fetchSchoolDevices>>>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [diagnostics, setDiagnostics] = useState<StudentDiagnosticsResponse | null>(null);
  const [deviceDiscoveredRows, setDeviceDiscoveredRows] = useState<StudentDiagnosticsRow[]>([]);
  const [deviceOnlyMetaByEmployeeNo, setDeviceOnlyMetaByEmployeeNo] = useState<Record<string, DeviceOnlyMeta>>({});
  const [deviceOnlyFaceByEmployeeNo, setDeviceOnlyFaceByEmployeeNo] = useState<Record<string, string>>({});
  const [deviceOnlyFaceFetchStateByEmployeeNo, setDeviceOnlyFaceFetchStateByEmployeeNo] = useState<
    Record<string, DeviceFaceFetchState>
  >({});
  const [loading, setLoading] = useState(false);
  const [deviceUsersLoading, setDeviceUsersLoading] = useState(false);
  const [liveStateByStudent, setLiveStateByStudent] = useState<Record<string, StudentLiveState>>({});
  const [page, setPage] = useState(1);

  const { addToast } = useGlobalToast();
  const schoolId = useMemo(() => getAuthUser()?.schoolId || '', []);

  const dbDeviceStudentIds = useMemo(() => {
    const ids = new Set<string>();
    (diagnostics?.data || []).forEach((row) => {
      const employeeNo = (row.deviceStudentId || '').trim();
      if (employeeNo) ids.add(employeeNo);
    });
    return ids;
  }, [diagnostics]);

  const filteredDeviceRows = useMemo(() => {
    if (selectedClassId) return [];
    const query = debouncedSearchQuery.trim().toLowerCase();
    return deviceDiscoveredRows.filter((row) => {
      const employeeNo = (row.deviceStudentId || '').trim();
      if (!employeeNo || dbDeviceStudentIds.has(employeeNo)) return false;
      if (!query) return true;
      return (
        (row.studentName || '').toLowerCase().includes(query) ||
        employeeNo.toLowerCase().includes(query) ||
        (row.className || '').toLowerCase().includes(query)
      );
    });
  }, [dbDeviceStudentIds, debouncedSearchQuery, deviceDiscoveredRows, selectedClassId]);

  const allRows = useMemo(() => [...(diagnostics?.data || []), ...filteredDeviceRows], [diagnostics, filteredDeviceRows]);

  const { sortedData, sortColumn, sortDirection, toggleSort } = useTableSort({
    data: allRows,
    defaultColumn: 'studentName',
    defaultDirection: 'asc',
  });

  const { selectedKeys, selectedCount, replaceSelection, clearSelection } = useTableSelection({
    items: sortedData,
    keyField: 'studentId',
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!schoolId) return;
    const loadInitial = async () => {
      try {
        const [classes, devices, backend] = await Promise.all([
          fetchClasses(schoolId),
          fetchDevices(),
          fetchSchoolDevices(schoolId),
        ]);
        setAvailableClasses(classes);
        setLocalDevices(devices);
        setBackendDevices(backend);
      } catch (err: unknown) {
        appLogger.error('Failed to load Students initial data', err);
      }
    };
    void loadInitial();
  }, [schoolId]);

  const loadDiagnostics = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await fetchStudentDiagnostics(schoolId, {
        classId: selectedClassId || undefined,
        search: debouncedSearchQuery || undefined,
      });
      setDiagnostics(data);
    } catch (err: unknown) {
      appLogger.error('Failed to load diagnostics', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedClassId, debouncedSearchQuery]);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  useStudentsDeviceDiscovery({
    schoolId,
    backendDevices,
    localDevices,
    filteredDeviceRows,
    deviceOnlyMetaByEmployeeNo,
    deviceOnlyFaceFetchStateByEmployeeNo,
    setDeviceDiscoveredRows,
    setDeviceOnlyMetaByEmployeeNo,
    setDeviceOnlyFaceByEmployeeNo,
    setDeviceOnlyFaceFetchStateByEmployeeNo,
    setDeviceUsersLoading,
  });

  const buildPhotoUrl = (url?: string | null) => buildBackendPhotoUrl(BACKEND_URL, url);

  const {
    editingStudent,
    editFirstName,
    editLastName,
    editFatherName,
    editClassId,
    savingEdit,
    editImagePreview,
    startEdit,
    cancelEdit,
    saveEdit,
    handleEditImageChange,
    setEditFirstName,
    setEditLastName,
    setEditFatherName,
    setEditClassId,
  } = useStudentEdit({
    addToast,
    loadDiagnostics,
    buildPhotoUrl,
    extractNameComponents: splitPersonNameWithFather,
  });

  const runLiveCheck = (row: StudentDiagnosticsRow) =>
    runLiveCheckAction({
      row,
      backendDevices,
      localDevices,
      addToast,
      setLiveStateByStudent,
    });

  const sortableColumns = useMemo(() => new Set(['lastName', 'firstName', 'className', 'deviceStudentId']), []);
  const handleSort = useCallback(
    (column: string) => {
      if (sortableColumns.has(column)) {
        toggleSort(column as keyof StudentDiagnosticsRow);
      }
    },
    [sortableColumns, toggleSort],
  );

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedData.slice(start, start + PAGE_SIZE);
  }, [sortedData, page]);

  const rowNumberByStudentId = useMemo(() => {
    const map = new Map<string, number>();
    sortedData.forEach((item, index) => {
      map.set(item.studentId, index + 1);
    });
    return map;
  }, [sortedData]);

  const columns = useMemo(
    () =>
      buildStudentsColumns({
        rowNumberByStudentId,
        deviceOnlyFaceByEmployeeNo,
        buildPhotoUrl,
        backendDevices,
        liveStateByStudent,
        mapBackendStatus,
        formatDateTime,
        statusBadgeClass,
        statusLabel,
        statusReason,
        summarizeStatuses,
        runLiveCheck,
        startEdit,
      }),
    [backendDevices, deviceOnlyFaceByEmployeeNo, liveStateByStudent, rowNumberByStudentId],
  );

  return (
    <StudentsPageView
      sortedData={sortedData}
      selectedKeys={selectedKeys}
      backendDevices={backendDevices}
      loading={loading}
      availableClasses={availableClasses}
      selectedClassId={selectedClassId}
      setSelectedClassId={setSelectedClassId}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      loadDiagnostics={loadDiagnostics}
      editingStudent={editingStudent}
      cancelEdit={cancelEdit}
      editLastName={editLastName}
      setEditLastName={setEditLastName}
      editFirstName={editFirstName}
      setEditFirstName={setEditFirstName}
      editFatherName={editFatherName}
      setEditFatherName={setEditFatherName}
      editClassId={editClassId}
      setEditClassId={setEditClassId}
      handleEditImageChange={handleEditImageChange}
      editImagePreview={editImagePreview}
      saveEdit={saveEdit}
      savingEdit={savingEdit}
      selectedCount={selectedCount}
      clearSelection={clearSelection}
      paginatedRows={paginatedRows}
      columns={columns}
      deviceUsersLoading={deviceUsersLoading}
      replaceSelection={replaceSelection}
      sortColumn={sortColumn ? String(sortColumn) : null}
      sortDirection={sortDirection}
      handleSort={handleSort}
      page={page}
      pageSize={PAGE_SIZE}
      setPage={setPage}
    />
  );
}

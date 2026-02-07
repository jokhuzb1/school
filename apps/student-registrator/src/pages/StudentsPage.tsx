import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  checkStudentOnDevice,
  fetchClasses,
  fetchDevices,
  fetchUsers,
  getUserFaceByUrl,
  fetchStudentDiagnostics,
  fetchSchoolDevices,
  getAuthUser,
  BACKEND_URL,
} from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { useTableSelection } from '../hooks/useTableSelection';
import { useTableSort } from '../hooks/useTableSort';
import { Icons } from '../components/ui/Icons';
import { DataTable, ColumnDef } from '../components/ui/DataTable';
import { DiagnosticsFilterBar } from '../components/students/DiagnosticsFilterBar';
import { DiagnosticSummary } from '../components/students/DiagnosticSummary';
import { Pagination } from '../components/ui/Pagination';
import { ExportButton } from '../components/students/ExportButton';
import { useStudentEdit } from '../features/students/useStudentEdit';
import type {
  ClassInfo,
  StudentDiagnosticsResponse,
  StudentDiagnosticsRow,
} from '../types';
import { buildBackendPhotoUrl } from '../utils/photo';
import { resolveLocalDeviceForBackend } from '../utils/deviceResolver';

type LiveStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'OFFLINE'
  | 'EXPIRED'
  | 'NO_CREDENTIALS'
  | 'ERROR'
  | 'PENDING'
  | 'UNSENT';

type LiveDeviceResult = {
  status: LiveStatus;
  message?: string | null;
  checkedAt?: string;
};

type StudentLiveState = {
  running: boolean;
  checkedAt?: string;
  byDeviceId: Record<string, LiveDeviceResult>;
};

type DeviceOnlyMeta = {
  localDeviceId: string;
  hasFace: boolean;
  faceUrl?: string;
};
type DeviceFaceFetchState = 'loading' | 'success' | 'failed';

const PAGE_SIZE = 25;

function statusBadgeClass(status: LiveStatus): string {
  if (status === 'PRESENT') return 'badge badge-success';
  if (status === 'PENDING' || status === 'UNSENT') return 'badge badge-warning';
  if (status === 'ABSENT') return 'badge';
  return 'badge badge-danger';
}

function statusLabel(status: LiveStatus): string {
  if (status === 'PRESENT') return 'Bor';
  if (status === 'ABSENT') return "Yo'q";
  if (status === 'OFFLINE') return 'Offline';
  if (status === 'EXPIRED') return 'Muddati tugagan';
  if (status === 'NO_CREDENTIALS') return "Credentials yo'q";
  if (status === 'ERROR') return 'Xato';
  if (status === 'PENDING') return 'Kutilmoqda';
  return 'Yuborilmagan';
}

function statusReason(status: LiveStatus, message?: string | null): string {
  if (message && message.trim()) return message;
  if (status === 'PRESENT') return "O'quvchi qurilmada topildi";
  if (status === 'ABSENT') return "O'quvchi qurilmada topilmadi";
  if (status === 'OFFLINE') return "Qurilmaga ulanish bo'lmadi";
  if (status === 'EXPIRED') return "Local credentials muddati tugagan";
  if (status === 'NO_CREDENTIALS') return "Bu kompyuterda qurilma credentials yo'q";
  if (status === 'PENDING') return 'Jarayon davom etmoqda';
  if (status === 'UNSENT') return "Provisioning hali yuborilmagan";
  return "Noma'lum xato";
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString('uz-UZ');
}

function mapBackendStatus(row: StudentDiagnosticsRow): Record<string, LiveDeviceResult> {
  const result: Record<string, LiveDeviceResult> = {};
  row.devices.forEach((device) => {
    if (device.status === 'SUCCESS') {
      result[device.deviceId] = {
        status: 'PRESENT',
        message: "Server log bo'yicha yozilgan",
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    if (device.status === 'FAILED') {
      result[device.deviceId] = {
        status: 'ERROR',
        message: device.lastError || "Provisioning xatosi",
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    if (device.status === 'PENDING') {
      result[device.deviceId] = {
        status: 'PENDING',
        message: 'Provisioning yakunlanmagan',
        checkedAt: device.updatedAt || undefined,
      };
      return;
    }
    result[device.deviceId] = {
      status: 'UNSENT',
      message: "Provisioning yozuvi yo'q",
      checkedAt: device.updatedAt || undefined,
    };
  });
  return result;
}

function summarizeStatuses(statuses: LiveDeviceResult[], running: boolean): string {
  if (running) return 'Tekshirilmoqda...';
  if (statuses.length === 0) return "Qurilma yo'q";
  const ok = statuses.filter((item) => item.status === 'PRESENT').length;
  const issues = statuses.filter((item) =>
    ['ABSENT', 'OFFLINE', 'EXPIRED', 'NO_CREDENTIALS', 'ERROR'].includes(item.status),
  ).length;
  if (issues === 0 && ok === statuses.length) return `OK ${ok}/${statuses.length}`;
  if (issues === 0) return `Jarayonda ${ok}/${statuses.length}`;
  return `Muammo ${issues}`;
}

function extractNameComponents(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { lastName: parts[0], firstName: '', fatherName: '' };
  if (parts.length === 2) return { lastName: parts[0], firstName: parts[1], fatherName: '' };
  return {
    lastName: parts[0],
    firstName: parts[1],
    fatherName: parts.slice(2).join(' ')
  };
}

export function StudentsPage() {
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [localDevices, setLocalDevices] = useState<Awaited<ReturnType<typeof fetchDevices>>>([]);
  const [backendDevices, setBackendDevices] = useState<Awaited<ReturnType<typeof fetchSchoolDevices>>>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [diagnostics, setDiagnostics] = useState<StudentDiagnosticsResponse | null>(null);
  const [deviceDiscoveredRows, setDeviceDiscoveredRows] = useState<StudentDiagnosticsRow[]>([]);
  const [deviceOnlyMetaByEmployeeNo, setDeviceOnlyMetaByEmployeeNo] = useState<
    Record<string, DeviceOnlyMeta>
  >({});
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

  const allRows = useMemo(
    () => [...(diagnostics?.data || []), ...filteredDeviceRows],
    [diagnostics, filteredDeviceRows],
  );

  const { sortedData, sortColumn, sortDirection, toggleSort } = useTableSort({
    data: allRows,
    defaultColumn: 'studentName',
    defaultDirection: 'asc'
  });

  const {
    selectedKeys,
    selectedCount,
    replaceSelection,
    clearSelection,
  } = useTableSelection({ items: sortedData, keyField: 'studentId' });

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
      } catch (err) {
        console.error('Failed to load initial data:', err);
      }
    };
    loadInitial();
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
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, selectedClassId, debouncedSearchQuery]);

  useEffect(() => {
    loadDiagnostics();
  }, [loadDiagnostics]);

  useEffect(() => {
    const loadDeviceUsers = async () => {
      if (!schoolId || backendDevices.length === 0 || localDevices.length === 0) {
        setDeviceDiscoveredRows([]);
        setDeviceOnlyMetaByEmployeeNo({});
        setDeviceOnlyFaceByEmployeeNo({});
        setDeviceOnlyFaceFetchStateByEmployeeNo({});
        return;
      }

      setDeviceUsersLoading(true);
      try {
        const byEmployeeNo = new Map<string, StudentDiagnosticsRow>();
        const nextMetaByEmployeeNo: Record<string, DeviceOnlyMeta> = {};

        await Promise.all(
          backendDevices.map(async (backendDevice) => {
            const localDevice = resolveLocalDeviceForBackend(backendDevice, localDevices).localDevice;
            if (!localDevice?.id) return;

            let offset = 0;
            const limit = 100;
            for (;;) {
              const response = await fetchUsers(localDevice.id, { offset, limit });
              const list = response.UserInfoSearch?.UserInfo || [];
              const total = response.UserInfoSearch?.totalMatches || 0;
              if (list.length === 0) break;

              list.forEach((user) => {
                const employeeNo = (user.employeeNo || '').trim();
                if (!employeeNo) return;
                const hasFace = (user.numOfFace || 0) > 0;

                const existing = byEmployeeNo.get(employeeNo);
                if (!existing) {
                  const fullName = (user.name || employeeNo).trim();
                  const nameParts = extractNameComponents(fullName);
                  nextMetaByEmployeeNo[employeeNo] = {
                    localDeviceId: localDevice.id,
                    hasFace,
                    faceUrl: user.faceURL || undefined,
                  };
                  byEmployeeNo.set(employeeNo, {
                    studentId: `device-only-${employeeNo}`,
                    studentName: fullName,
                    firstName: nameParts.firstName || undefined,
                    lastName: nameParts.lastName || undefined,
                    fatherName: nameParts.fatherName || null,
                    classId: null,
                    className: "Qurilmada (DB yo'q)",
                    deviceStudentId: employeeNo,
                    photoUrl: null,
                    devices: [
                      {
                        deviceId: backendDevice.id,
                        deviceName: backendDevice.name,
                        deviceExternalId: backendDevice.deviceId || null,
                        status: 'SUCCESS',
                        updatedAt: new Date().toISOString(),
                        lastError: null,
                      },
                    ],
                  });
                  return;
                }

                if (!existing.devices.some((item) => item.deviceId === backendDevice.id)) {
                  existing.devices.push({
                    deviceId: backendDevice.id,
                    deviceName: backendDevice.name,
                    deviceExternalId: backendDevice.deviceId || null,
                    status: 'SUCCESS',
                    updatedAt: new Date().toISOString(),
                    lastError: null,
                  });
                }

                const currentMeta = nextMetaByEmployeeNo[employeeNo];
                if (!currentMeta || (!currentMeta.hasFace && hasFace)) {
                  nextMetaByEmployeeNo[employeeNo] = {
                    localDeviceId: localDevice.id,
                    hasFace,
                    faceUrl: user.faceURL || currentMeta?.faceUrl || undefined,
                  };
                }
              });

              offset += list.length;
              if (offset >= total) break;
            }
          }),
        );

        setDeviceDiscoveredRows(Array.from(byEmployeeNo.values()));
        setDeviceOnlyMetaByEmployeeNo(nextMetaByEmployeeNo);
        setDeviceOnlyFaceByEmployeeNo({});
        setDeviceOnlyFaceFetchStateByEmployeeNo({});
      } catch (err) {
        console.error('Failed to load device-discovered users:', err);
        setDeviceDiscoveredRows([]);
        setDeviceOnlyMetaByEmployeeNo({});
        setDeviceOnlyFaceByEmployeeNo({});
        setDeviceOnlyFaceFetchStateByEmployeeNo({});
      } finally {
        setDeviceUsersLoading(false);
      }
    };

    void loadDeviceUsers();
  }, [backendDevices, localDevices, schoolId]);

  useEffect(() => {
    const pending = filteredDeviceRows
      .map((row) => (row.deviceStudentId || '').trim())
      .filter((employeeNo) => {
        if (!employeeNo) return false;
        if (deviceOnlyFaceFetchStateByEmployeeNo[employeeNo]) return false;
        const meta = deviceOnlyMetaByEmployeeNo[employeeNo];
        return Boolean(meta?.localDeviceId && meta.hasFace);
      });

    if (pending.length === 0) return;

    let cancelled = false;
    const run = async () => {
      const queue = [...new Set(pending)];
      setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => {
        const next = { ...prev };
        queue.forEach((employeeNo) => {
          if (!next[employeeNo]) next[employeeNo] = 'loading';
        });
        return next;
      });

      const concurrency = Math.min(2, queue.length);
      let cursor = 0;

      const worker = async () => {
        while (cursor < queue.length) {
          const currentIndex = cursor;
          cursor += 1;
          const employeeNo = queue[currentIndex];
          const meta = deviceOnlyMetaByEmployeeNo[employeeNo];
          if (!meta?.localDeviceId) continue;
          if (!meta.faceUrl) {
            setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: 'failed',
            }));
            continue;
          }
          try {
            const face = await getUserFaceByUrl(meta.localDeviceId, employeeNo, meta.faceUrl);
            if (cancelled) continue;
            if (!face.imageBase64) {
              setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
                ...prev,
                [employeeNo]: 'failed',
              }));
              continue;
            }
            const image = face.imageBase64.startsWith('data:image')
              ? face.imageBase64
              : `data:image/jpeg;base64,${face.imageBase64}`;
            setDeviceOnlyFaceByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: image,
            }));
            setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: 'success',
            }));
          } catch {
            setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: 'failed',
            }));
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [deviceOnlyFaceFetchStateByEmployeeNo, deviceOnlyMetaByEmployeeNo, filteredDeviceRows]);

  const buildPhotoUrl = (url?: string | null) => {
    return buildBackendPhotoUrl(BACKEND_URL, url);
  };

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
    extractNameComponents,
  });

  const runLiveCheck = async (row: StudentDiagnosticsRow) => {
    if (!row.deviceStudentId) {
      addToast("O'quvchida Device ID yo'q", 'error');
      return;
    }

    setLiveStateByStudent((prev) => ({
      ...prev,
      [row.studentId]: {
        running: true,
        byDeviceId: prev[row.studentId]?.byDeviceId || {},
      },
    }));

    const checks = await Promise.all(
      backendDevices.map(async (backendDevice) => {
        const localDevice = resolveLocalDeviceForBackend(backendDevice, localDevices).localDevice;

        if (!localDevice) {
          return { backendDeviceId: backendDevice.id, status: 'NO_CREDENTIALS' as LiveStatus };
        }

        try {
          const result = await checkStudentOnDevice(localDevice.id, row.deviceStudentId || '');
          return {
            backendDeviceId: backendDevice.id,
            status: result.status as LiveStatus,
            message: result.message,
            checkedAt: result.checkedAt,
          };
        } catch (err) {
          return { backendDeviceId: backendDevice.id, status: 'ERROR' as LiveStatus };
        }
      }),
    );

    const byDeviceId: Record<string, LiveDeviceResult> = {};
    checks.forEach((item) => {
      byDeviceId[item.backendDeviceId] = {
        status: item.status,
        message: item.message,
        checkedAt: item.checkedAt,
      };
    });

    setLiveStateByStudent((prev) => ({
      ...prev,
      [row.studentId]: { running: false, byDeviceId },
    }));
  };

  const sortableColumns = useMemo(
    () => new Set(['studentName', 'className', 'deviceStudentId']),
    [],
  );

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

  const columns = useMemo<ColumnDef<StudentDiagnosticsRow>[]>(() => [
    {
      header: '#',
      cell: (item) => {
        const idx = sortedData.findIndex(s => s.studentId === item.studentId);
        return (page - 1) * PAGE_SIZE + idx + 1;
      },
      width: 50,
    },
    {
      header: "O'quvchi",
      accessorKey: 'studentName',
      sortable: true,
      width: '25%',
    },
    {
      header: 'Rasm',
      cell: (row) => {
        const employeeNo = (row.deviceStudentId || '').trim();
        const deviceFace = employeeNo ? deviceOnlyFaceByEmployeeNo[employeeNo] : '';
        const url = buildPhotoUrl(row.photoUrl) || deviceFace;
        if (!url) return <span className="text-secondary">-</span>;
        return <img src={url} alt="photo" className="student-avatar" />;
      },
      width: '80px',
    },
    {
      header: 'Sinf',
      accessorKey: 'className',
      sortable: true,
      width: '12%',
    },
    {
      header: 'Device ID',
      accessorKey: 'deviceStudentId',
      sortable: true,
      width: '12%',
    },
    {
      header: 'Diagnostika',
      cell: (row) => (
        <DiagnosticSummary
          row={row}
          backendDevices={backendDevices}
          liveState={liveStateByStudent[row.studentId]}
          mapBackendStatus={mapBackendStatus}
          formatDateTime={formatDateTime}
          statusBadgeClass={statusBadgeClass}
          statusLabel={statusLabel}
          statusReason={statusReason}
          summarizeStatuses={summarizeStatuses}
        />
      ),
      width: '20%',
    },
    {
      header: 'Amallar',
      cell: (row) => (
        <div className="action-buttons">
          <button
            className="button button-info button-compact"
            onClick={() => runLiveCheck(row)}
            disabled={liveStateByStudent[row.studentId]?.running}
            title="Jonli tekshirish"
          >
            <Icons.Refresh />
          </button>
          <button
            className="button button-secondary button-compact"
            onClick={() => startEdit(row)}
            title="Tahrirlash"
          >
            <Icons.Edit />
          </button>
        </div>
      ),
      width: '100px',
    }
  ], [backendDevices, deviceOnlyFaceByEmployeeNo, liveStateByStudent, page]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar</h1>
          <p className="page-description">Diagnostika va tahrirlash</p>
        </div>
        <div className="page-actions">
          <ExportButton
            students={sortedData}
            selectedIds={selectedKeys}
            devices={backendDevices}
            disabled={loading}
          />
        </div>
      </div>

      <DiagnosticsFilterBar
        classes={availableClasses}
        selectedClassId={selectedClassId}
        onClassChange={setSelectedClassId}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={loadDiagnostics}
        loading={loading}
      />

      {editingStudent && (
        <div className="overlay" onClick={cancelEdit}>
          <div className="card edit-panel animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="panel-header">
              <h2>O'quvchini tahrirlash</h2>
              <button className="button button-secondary button-compact" onClick={cancelEdit}><Icons.X /></button>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Familiya</label>
                <input className="input" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Ism</label>
                <input className="input" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Otasining ismi</label>
                <input className="input" value={editFatherName} onChange={(e) => setEditFatherName(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Sinf</label>
                <select className="input" value={editClassId} onChange={(e) => setEditClassId(e.target.value)}>
                  <option value="">Tanlang</option>
                  {availableClasses.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label">Rasm</label>
                <input
                  className="input"
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => handleEditImageChange(e.target.files?.[0] || null)}
                />
              </div>
              <div className="form-group">
                {editImagePreview ? (
                  <img src={editImagePreview} alt="preview" className="student-avatar" />
                ) : (
                  <div className="text-secondary">Rasm tanlanmagan</div>
                )}
              </div>
            </div>
            <div className="form-actions">
              <button className="button button-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saqlanmoqda...' : <><Icons.Check /> Saqlash</>}
              </button>
              <button className="button button-secondary" onClick={cancelEdit} disabled={savingEdit}>Bekor qilish</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-content">
        {selectedCount > 0 && (
          <div className="selection-toolbar">
            <span className="selection-info">{selectedCount} ta o'quvchi tanlandi</span>
            <button className="button button-secondary button-compact" onClick={clearSelection} title="Tanlovni bekor qilish">
              <Icons.X />
            </button>
          </div>
        )}
        
        <DataTable
          data={paginatedRows}
          columns={columns}
          loading={loading || deviceUsersLoading}
          rowKey="studentId"
          selectable
          selectedKeys={selectedKeys}
          onSelectionChange={replaceSelection}
          sortColumn={sortColumn ? String(sortColumn) : null}
          sortDirection={sortDirection}
          onSort={handleSort}
        />
        
        <Pagination
          page={page}
          pageSize={PAGE_SIZE}
          total={sortedData.length}
          onChange={setPage}
        />
      </div>
    </div>
  );
}

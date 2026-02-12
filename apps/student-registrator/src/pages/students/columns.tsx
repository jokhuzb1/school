import { Icons } from '../../components/ui/Icons';
import { DiagnosticSummary } from '../../components/students/DiagnosticSummary';
import type { ColumnDef } from '../../components/ui/DataTable';
import type { SchoolDeviceInfo, StudentDiagnosticsRow } from '../../types';
import type {
  LiveDeviceResult,
  LiveStatus,
  StudentLiveState,
} from './helpers';

type BuildStudentsColumnsParams = {
  rowNumberByStudentId: Map<string, number>;
  deviceOnlyFaceByEmployeeNo: Record<string, string>;
  buildPhotoUrl: (url?: string | null) => string;
  backendDevices: SchoolDeviceInfo[];
  liveStateByStudent: Record<string, StudentLiveState>;
  mapBackendStatus: (row: StudentDiagnosticsRow) => Record<string, LiveDeviceResult>;
  formatDateTime: (value?: string) => string;
  statusBadgeClass: (status: LiveStatus) => string;
  statusLabel: (status: LiveStatus) => string;
  statusReason: (status: LiveStatus, message?: string | null) => string;
  summarizeStatuses: (statuses: LiveDeviceResult[], running: boolean) => string;
  runLiveCheck: (row: StudentDiagnosticsRow) => Promise<void>;
  startEdit: (row: StudentDiagnosticsRow) => void;
};

export function buildStudentsColumns({
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
}: BuildStudentsColumnsParams): ColumnDef<StudentDiagnosticsRow>[] {
  return [
    {
      header: '#',
      cell: (item) => rowNumberByStudentId.get(item.studentId) || '-',
      width: 50,
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
      width: '60px',
    },
    {
      header: 'Familiya',
      accessorKey: 'lastName',
      sortable: true,
      width: '15%',
    },
    {
      header: 'Ism',
      accessorKey: 'firstName',
      sortable: true,
      width: '15%',
    },
    {
      header: 'Otasi',
      accessorKey: 'fatherName',
      cell: (row) => row.fatherName || <span className="text-secondary">-</span>,
      width: '12%',
    },
    {
      header: 'Jinsi',
      accessorKey: 'gender',
      cell: (row) => {
        if (!row.gender) return <span className="text-secondary">-</span>;
        return row.gender === 'MALE' ? 'Erkak' : 'Ayol';
      },
      width: '80px',
    },
    {
      header: 'Sinf',
      accessorKey: 'className',
      sortable: true,
      width: '10%',
    },
    {
      header: 'Device ID',
      accessorKey: 'deviceStudentId',
      sortable: true,
      width: '10%',
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
      width: '15%',
    },
    {
      header: 'Amallar',
      cell: (row) => (
        <div className="action-buttons">
          <button
            className="button button-info button-compact"
            onClick={() => void runLiveCheck(row)}
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
    },
  ];
}

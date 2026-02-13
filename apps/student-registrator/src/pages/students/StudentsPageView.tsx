import { Icons } from '../../components/ui/Icons';
import { DataTable, type ColumnDef } from '../../components/ui/DataTable';
import { DiagnosticsFilterBar } from '../../components/students/DiagnosticsFilterBar';
import { ExportButton } from '../../components/students/ExportButton';
import { Pagination } from '../../components/ui/Pagination';
import type { ClassInfo, SchoolDeviceInfo, StudentDiagnosticsRow } from '../../types';

type StudentsPageViewProps = {
  sortedData: StudentDiagnosticsRow[];
  selectedKeys: Set<string>;
  backendDevices: SchoolDeviceInfo[];
  loading: boolean;
  availableClasses: ClassInfo[];
  selectedClassId: string;
  setSelectedClassId: (next: string) => void;
  searchQuery: string;
  setSearchQuery: (next: string) => void;
  loadDiagnostics: () => Promise<void>;
  editingStudent: StudentDiagnosticsRow | null;
  cancelEdit: () => void;
  editLastName: string;
  setEditLastName: (next: string) => void;
  editFirstName: string;
  setEditFirstName: (next: string) => void;
  editFatherName: string;
  setEditFatherName: (next: string) => void;
  editClassId: string;
  setEditClassId: (next: string) => void;
  handleEditImageChange: (file: File | null) => void;
  editImagePreview: string;
  saveEdit: () => Promise<void>;
  savingEdit: boolean;
  selectedCount: number;
  clearSelection: () => void;
  paginatedRows: StudentDiagnosticsRow[];
  columns: ColumnDef<StudentDiagnosticsRow>[];
  deviceUsersLoading: boolean;
  replaceSelection: (next: Set<string>) => void;
  sortColumn: string | null;
  sortDirection: 'asc' | 'desc';
  handleSort: (column: string) => void;
  page: number;
  pageSize: number;
  setPage: (next: number) => void;
};

export function StudentsPageView({
  sortedData,
  selectedKeys,
  backendDevices,
  loading,
  availableClasses,
  selectedClassId,
  setSelectedClassId,
  searchQuery,
  setSearchQuery,
  loadDiagnostics,
  editingStudent,
  cancelEdit,
  editLastName,
  setEditLastName,
  editFirstName,
  setEditFirstName,
  editFatherName,
  setEditFatherName,
  editClassId,
  setEditClassId,
  handleEditImageChange,
  editImagePreview,
  saveEdit,
  savingEdit,
  selectedCount,
  clearSelection,
  paginatedRows,
  columns,
  deviceUsersLoading,
  replaceSelection,
  sortColumn,
  sortDirection,
  handleSort,
  page,
  pageSize,
  setPage,
}: StudentsPageViewProps) {
  return (
    <div className="page">
      <div className="page-header">
        <div className="header-main">
          <h1 className="page-title">O'quvchilar</h1>
          <p className="page-description">Diagnostika va tahrirlash</p>
        </div>
        <div className="page-actions">
          <ExportButton students={sortedData} selectedIds={selectedKeys} devices={backendDevices} disabled={loading} />
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
              <button className="button button-secondary button-compact" onClick={cancelEdit}>
                <Icons.X />
              </button>
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
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
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
              <button className="button button-primary" onClick={() => void saveEdit()} disabled={savingEdit}>
                {savingEdit ? 'Saqlanmoqda...' : <><Icons.Check /> Saqlash</>}
              </button>
              <button className="button button-secondary" onClick={cancelEdit} disabled={savingEdit}>
                Bekor qilish
              </button>
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
          sortColumn={sortColumn}
          sortDirection={sortDirection}
          onSort={handleSort}
        />

        <Pagination page={page} pageSize={pageSize} total={sortedData.length} onChange={setPage} />
      </div>
    </div>
  );
}

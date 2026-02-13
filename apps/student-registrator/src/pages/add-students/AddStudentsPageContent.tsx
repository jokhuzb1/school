import { Icons } from '../../components/ui/Icons';
import { ImportMappingPanel } from '../../components/students/ImportMappingPanel';
import { StudentTable } from '../../components/students/StudentTable';
import type { ClassInfo, StudentRow } from '../../types';

type ErrorRow = { student: StudentRow; index: number };

type AddStudentsPageContentProps = {
  students: StudentRow[];
  pendingCount: number;
  successCount: number;
  errorCount: number;
  errorRows: ErrorRow[];
  availableClasses: ClassInfo[];
  handleApplyMapping: (className: string, classId: string) => void;
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  deleteStudent: (id: string) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  handleSaveStudent: (id: string) => Promise<void>;
  refreshFaceForStudent: (studentId: string) => Promise<boolean>;
  refreshingFaceIds: string[];
  handleAddRow: () => void;
};

export function AddStudentsPageContent({
  students,
  pendingCount,
  successCount,
  errorCount,
  errorRows,
  availableClasses,
  handleApplyMapping,
  updateStudent,
  deleteStudent,
  addToast,
  handleSaveStudent,
  refreshFaceForStudent,
  refreshingFaceIds,
  handleAddRow,
}: AddStudentsPageContentProps) {
  return (
    <>
      {students.length > 0 && (
        <div className="stats-bar">
          <div className="stat-item">
            <span className="stat-label">Jami o'quvchilar</span>
            <span className="stat-value">{students.length}</span>
          </div>
          <div className="stat-item stat-warning">
            <span className="stat-label">Saqlash kutilmoqda</span>
            <span className="stat-value">{pendingCount}</span>
          </div>
          <div className="stat-item stat-success">
            <span className="stat-label">Muvaffaqiyatli</span>
            <span className="stat-value">{successCount}</span>
          </div>
          {errorCount > 0 && (
            <div className="stat-item stat-danger">
              <span className="stat-label">Xatoliklar</span>
              <span className="stat-value">{errorCount}</span>
            </div>
          )}
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="notice notice-error">
          <div className="notice-header">
            <Icons.AlertCircle />
            <strong>Saqlashda yuzaga kelgan xatoliklar:</strong>
          </div>
          <div className="error-summary-list">
            {errorRows.map(({ student, index }) => {
              const name = `${student.lastName || ''} ${student.firstName || ''}`.trim() || `Qator ${index}`;
              return (
                <div key={student.id} className="error-summary-item">
                  <span className="error-summary-name">#{index} {name}</span>
                  <span className="error-summary-message">{student.error || "Noma'lum xato yuz berdi"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ImportMappingPanel students={students} availableClasses={availableClasses} onApplyMapping={handleApplyMapping} />

      <div className="page-content">
        <StudentTable
          students={students}
          availableClasses={availableClasses}
          onEdit={updateStudent}
          onDelete={(id) => {
            deleteStudent(id);
            addToast("O'quvchi o'chirildi", 'success');
          }}
          onSave={handleSaveStudent}
          onRefreshFace={refreshFaceForStudent}
          refreshingFaceIds={refreshingFaceIds}
          onAddRow={handleAddRow}
        />
      </div>
    </>
  );
}

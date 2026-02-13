import type { StudentRow, ClassInfo } from '../../types';
import { StudentTableRow } from './StudentTableRow';

interface StudentTableProps {
  students: StudentRow[];
  availableClasses: ClassInfo[];
  onEdit: (id: string, updates: Partial<StudentRow>) => void;
  onDelete: (id: string) => void;
  onSave: (id: string) => Promise<void>;
  onRefreshFace?: (id: string) => Promise<boolean>;
  refreshingFaceIds?: string[];
  onAddRow: () => void;
}

export function StudentTable({
  students,
  availableClasses,
  onEdit,
  onDelete,
  onSave,
  onRefreshFace,
  refreshingFaceIds = [],
  onAddRow,
}: StudentTableProps) {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th style={{width: '50px'}}>#</th>
            <th style={{width: '180px'}}>Familiya</th>
            <th style={{width: '160px'}}>Ism</th>
            <th style={{width: '120px'}}>Jinsi</th>
            <th style={{width: '150px'}}>Sinf</th>
            <th style={{width: '180px'}}>Otasining ismi</th>
            <th style={{width: '150px'}}>Telefon</th>
            <th style={{width: '100px'}}>Rasm</th>
            <th style={{width: '100px'}}>Holat</th>
            <th style={{width: '300px'}}>Xato sababi</th>
            <th style={{width: '100px'}}>Amallar</th>
          </tr>
        </thead>
        <tbody>
          {students.map((student, idx) => (
            <StudentTableRow
              key={student.id}
              index={idx + 1}
              student={student}
              availableClasses={availableClasses}
              onEdit={onEdit}
              onDelete={onDelete}
              onSave={onSave}
              onRefreshFace={onRefreshFace}
              isFaceRefreshing={refreshingFaceIds.includes(student.id)}
            />
          ))}
          {/* Empty row with Add button */}
          <tr className="add-row">
            <td colSpan={11}>
              <button className="btn-add-row" onClick={onAddRow}>
                + Yangi qator qo'shish
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

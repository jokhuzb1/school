import { useMemo, useState } from 'react';
import { Icons } from '../ui/Icons';
import type { StudentRow, ClassInfo } from '../../types';

interface MappingGroup {
  className: string;
  count: number;
  classId: string;
  mixed: boolean;
}

interface ImportMappingPanelProps {
  students: StudentRow[];
  availableClasses: ClassInfo[];
  onApplyMapping: (className: string, classId: string) => void;
}

export function ImportMappingPanel({
  students,
  availableClasses,
  onApplyMapping,
}: ImportMappingPanelProps) {
  const [showAll, setShowAll] = useState(false);

  const groups = useMemo<MappingGroup[]>(() => {
    const groupMap = new Map<string, { count: number; classIds: Set<string> }>();

    students.forEach((student) => {
      if (student.source !== 'import') return;
      if (!student.className) return;
      const key = student.className.trim();
      if (!key) return;

      if (!groupMap.has(key)) {
        groupMap.set(key, { count: 0, classIds: new Set<string>() });
      }

      const entry = groupMap.get(key);
      if (!entry) return;

      entry.count += 1;
      if (student.classId) {
        entry.classIds.add(student.classId);
      }
    });

    return Array.from(groupMap.entries())
      .map(([className, entry]) => {
        const classId = entry.classIds.size === 1 ? Array.from(entry.classIds)[0] : '';
        return {
          className,
          count: entry.count,
          classId,
          mixed: entry.classIds.size > 1,
        };
      })
      .sort((a, b) => a.className.localeCompare(b.className));
  }, [students]);

  const unmapped = groups.filter((g) => !g.classId);
  const visibleGroups = showAll ? groups : unmapped;

  if (visibleGroups.length === 0) return null;

  return (
    <div className="card mapping-panel">
      <div className="panel-header">
        <div>
          <div className="panel-title">Sinf mapping</div>
          <div className="panel-subtitle">
            Excel sheet nomlarini sinfga bog&apos;lang
          </div>
        </div>
        {groups.length > unmapped.length && (
          <button
            type="button"
            className="btn-icon"
            onClick={() => setShowAll((prev) => !prev)}
            title={showAll ? "Faqat moslanmaganlar" : "Barchasini ko'rsatish"}
            aria-label={showAll ? "Faqat moslanmaganlar" : "Barchasini ko'rsatish"}
          >
            {showAll ? <Icons.EyeOff /> : <Icons.Eye />}
          </button>
        )}
      </div>

      {availableClasses.length === 0 ? (
        <div className="notice notice-warning">
          Sinflar yuklanmagan. Mapping uchun sinflar kerak.
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Excel sheet</th>
                <th>Qator</th>
                <th>Sinf</th>
              </tr>
            </thead>
            <tbody>
              {visibleGroups.map((group) => {
                const hasClassId = availableClasses.some((c) => c.id === group.classId);
                const selectedValue = hasClassId ? group.classId : '';
                return (
                  <tr key={group.className}>
                    <td>
                      <div className="mapping-name">
                        <span>{group.className}</span>
                        {group.mixed && (
                          <span className="badge badge-warning">Aralash</span>
                        )}
                      </div>
                    </td>
                    <td>{group.count}</td>
                    <td>
                      <select
                        className="input input-sm table-input"
                        value={selectedValue}
                        onChange={(e) => onApplyMapping(group.className, e.target.value)}
                      >
                        <option value="">Tanlang</option>
                        {availableClasses.map((cls) => (
                          <option key={cls.id} value={cls.id}>
                            {cls.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

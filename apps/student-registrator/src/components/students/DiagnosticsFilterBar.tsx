import { Icons } from '../ui/Icons';
import type { ClassInfo } from '../../types';

interface DiagnosticsFilterBarProps {
  classes: ClassInfo[];
  selectedClassId: string;
  onClassChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (val: string) => void;
  onRefresh: () => void;
  loading?: boolean;
}

export function DiagnosticsFilterBar({
  classes,
  selectedClassId,
  onClassChange,
  searchQuery,
  onSearchChange,
  onRefresh,
  loading,
}: DiagnosticsFilterBarProps) {
  return (
    <div className="filter-bar-integrated">
      <div className="filter-item search-group">
        <div className="input-with-icon">
          <Icons.Search />
          <input
            className="input"
            placeholder="O'quvchi ismi yoki ID..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-item">
        <select
          className="select"
          value={selectedClassId}
          onChange={(e) => onClassChange(e.target.value)}
        >
          <option value="">Barcha sinflar</option>
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-item actions-group">
        <button 
          className="button button-secondary" 
          onClick={onRefresh}
          disabled={loading}
          title="Yangilash"
        >
          <Icons.Refresh />
        </button>
      </div>
    </div>
  );
}

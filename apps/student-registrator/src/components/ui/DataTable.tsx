import React, { useMemo } from 'react';
import { Icons } from './Icons';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  id?: string;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
}

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  rowKey: keyof T;
  selectable?: boolean;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  sortColumn?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

export function DataTable<T>({
  data,
  columns,
  loading,
  rowKey,
  selectable,
  selectedKeys = new Set(),
  onSelectionChange,
  sortColumn,
  sortDirection,
  onSort,
}: DataTableProps<T>) {
  const allSelected = useMemo(() => {
    if (data.length === 0) return false;
    return data.every((item) => selectedKeys.has(String(item[rowKey])));
  }, [data, selectedKeys, rowKey]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      const next = new Set(selectedKeys);
      data.forEach((item) => next.add(String(item[rowKey])));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedKeys);
      data.forEach((item) => next.delete(String(item[rowKey])));
      onSelectionChange(next);
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectionChange(next);
  };

  if (loading && data.length === 0) {
    return (
      <div className="table-loading-skeleton">
        <div className="skeleton-row header" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {selectable && (
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  className="table-checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                />
              </th>
            )}
            {columns.map((col, idx) => {
              const columnId = col.id || String(col.accessorKey);
              const isSorted = sortColumn === columnId;
              
              return (
                <th 
                  key={idx} 
                  style={{ width: col.width }}
                >
                  {col.sortable ? (
                    <button
                      className={`table-header-sortable ${isSorted ? 'active' : ''}`}
                      onClick={() => onSort?.(columnId)}
                    >
                      {col.header}
                      <span className="sort-icon">
                        {isSorted && sortDirection === 'desc' ? (
                          <Icons.ChevronDown />
                        ) : (
                          <Icons.ChevronUp />
                        )}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)} className="empty-cell">
                Ma'lumot topilmadi
              </td>
            </tr>
          ) : (
            data.map((item) => {
              const key = String(item[rowKey]);
              const isSelected = selectedKeys.has(key);
              
              return (
                <tr key={key} className={isSelected ? 'selected' : ''}>
                  {selectable && (
                    <td>
                      <input
                        type="checkbox"
                        className="table-checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectRow(key)}
                      />
                    </td>
                  )}
                  {columns.map((col, idx) => (
                    <td key={idx}>
                      {col.cell ? col.cell(item) : (col.accessorKey ? String(item[col.accessorKey] || '-') : '-')}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

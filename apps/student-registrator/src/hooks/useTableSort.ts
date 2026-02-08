import { useState, useMemo, useCallback } from 'react';

type SortDirection = 'asc' | 'desc';

interface UseTableSortOptions<T> {
  data: T[];
  defaultColumn?: keyof T | null;
  defaultDirection?: SortDirection;
}

interface UseTableSortReturn<T> {
  sortedData: T[];
  sortColumn: keyof T | null;
  sortDirection: SortDirection;
  toggleSort: (column: keyof T) => void;
  clearSort: () => void;
}

export function useTableSort<T>({
  data,
  defaultColumn = null,
  defaultDirection = 'asc',
}: UseTableSortOptions<T>): UseTableSortReturn<T> {
  const [sortColumn, setSortColumn] = useState<keyof T | null>(defaultColumn);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDirection);

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;

      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.localeCompare(bVal, 'uz-UZ', { sensitivity: 'base' });
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Number comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Fallback to string
      const aStr = String(aVal);
      const bStr = String(bVal);
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection]);

  const toggleSort = useCallback((column: keyof T) => {
    if (sortColumn === column) {
      // Same column - toggle direction or clear
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        // Reset sort
        setSortColumn(null);
        setSortDirection('asc');
      }
    } else {
      // New column - start with asc
      setSortColumn(column);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection]);

  const clearSort = useCallback(() => {
    setSortColumn(null);
    setSortDirection('asc');
  }, []);

  return {
    sortedData,
    sortColumn,
    sortDirection,
    toggleSort,
    clearSort,
  };
}

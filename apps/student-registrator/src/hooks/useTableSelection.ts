import { useState, useMemo, useCallback } from 'react';

interface UseTableSelectionOptions<T> {
  items: T[];
  keyField: keyof T;
}

interface UseTableSelectionReturn {
  selectedKeys: Set<string>;
  selectedCount: number;
  isAllSelected: boolean;
  isSelected: (key: string) => boolean;
  replaceSelection: (keys: Set<string>) => void;
  toggleItem: (key: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleAll: () => void;
}

export function useTableSelection<T>({
  items,
  keyField,
}: UseTableSelectionOptions<T>): UseTableSelectionReturn {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const allKeys = useMemo(() => {
    return items.map((item) => String(item[keyField]));
  }, [items, keyField]);

  const selectedCount = selectedKeys.size;
  const isAllSelected = allKeys.length > 0 && selectedKeys.size === allKeys.length;

  const isSelected = useCallback(
    (key: string) => selectedKeys.has(key),
    [selectedKeys]
  );

  const replaceSelection = useCallback((keys: Set<string>) => {
    setSelectedKeys(new Set(keys));
  }, []);

  const toggleItem = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedKeys(new Set(allKeys));
  }, [allKeys]);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    if (isAllSelected) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [isAllSelected, clearSelection, selectAll]);

  return {
    selectedKeys,
    selectedCount,
    isAllSelected,
    isSelected,
    replaceSelection,
    toggleItem,
    selectAll,
    clearSelection,
    toggleAll,
  };
}

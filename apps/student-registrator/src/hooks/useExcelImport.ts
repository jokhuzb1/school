import { useCallback } from 'react';
import { parseExcelFile } from '../services/excel.service';
import { base64ToResizedBase64 } from '../api';
import type { StudentRow, ExcelImportMapping, ClassInfo } from '../types';

interface UseExcelImportReturn {
  parseExcel: (file: File, availableClasses: ClassInfo[]) => Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]>;
  buildMappings: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[], availableClasses: ClassInfo[]) => ExcelImportMapping[];
  applyMappings: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[], mappings: ExcelImportMapping[]) => Omit<StudentRow, 'id' | 'source' | 'status'>[];
  resizeImages: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]>;
}

export function useExcelImport(): UseExcelImportReturn {
  // Parse Excel file
  const parseExcel = useCallback(async (
    file: File, 
    availableClasses: ClassInfo[]
  ): Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]> => {
    const rows = await parseExcelFile(file);
    const mappings = buildMappings(rows, availableClasses);
    const withMappings = applyMappings(rows, mappings);
    return withMappings;
  }, []);

  // Build class mappings
  const buildMappings = useCallback((
    rows: Omit<StudentRow, 'id' | 'source' | 'status'>[], 
    availableClasses: ClassInfo[]
  ): ExcelImportMapping[] => {
    console.log('[Excel Import] Building mappings...');
    console.log('[Excel Import] Available classes:', availableClasses.map(c => ({ name: c.name, id: c.id })));
    
    const classCounts = new Map<string, number>();
    rows.forEach((row) => {
      if (!row.className) return;
      const key = row.className.trim();
      if (!key) return;
      classCounts.set(key, (classCounts.get(key) || 0) + 1);
    });

    console.log('[Excel Import] Classes found in Excel:', Array.from(classCounts.keys()));

    const classIdByName = new Map(
      availableClasses.map((cls) => [cls.name.toLowerCase(), cls.id]),
    );

    const mappings = Array.from(classCounts.entries()).map(([sheet, rowCount]) => {
      const matchedId = classIdByName.get(sheet.toLowerCase()) || "";
      const matchedName = availableClasses.find((c) => c.id === matchedId)?.name || "";
      const matchedClass = availableClasses.find((c) => c.id === matchedId);
      console.log(`[Excel Import] Mapping "${sheet}" -> ID: ${matchedId || 'NOT FOUND'}`, {
        found: !!matchedClass,
        classDetails: matchedClass
      });
      return {
        sheet,
        classId: matchedId,
        className: matchedName,
        rowCount,
      };
    });

    return mappings;
  }, []);

  // Apply class mappings to rows
  const applyMappings = useCallback((
    rows: Omit<StudentRow, 'id' | 'source' | 'status'>[], 
    mappings: ExcelImportMapping[]
  ): Omit<StudentRow, 'id' | 'source' | 'status'>[] => {
    console.log('[Excel Import] Applying mappings to rows...');
    const classIdBySheet = new Map(
      mappings.map((m) => [m.sheet.toLowerCase(), m.classId]),
    );

    const result = rows.map((row) => {
      const classId = row.className ? classIdBySheet.get(row.className.toLowerCase()) : undefined;
      const displayName = `${row.lastName || ""} ${row.firstName || ""}`.trim();
      console.log(`[Excel Import] Row "${displayName}" className="${row.className}" -> classId="${classId}"`);
      return {
        ...row,
        classId,
      };
    });

    return result;
  }, []);

  // Resize images if needed
  const resizeImages = useCallback(async (
    rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]
  ): Promise<Omit<StudentRow, 'id' | 'source' | 'status'>[]> => {
    const results = await Promise.all(
      rows.map(async (row) => {
        if (!row.imageBase64) return row;
        
        try {
          const resized = await base64ToResizedBase64(row.imageBase64);
          return { ...row, imageBase64: resized };
        } catch (err) {
          const displayName = `${row.lastName || ""} ${row.firstName || ""}`.trim();
          console.warn(`Could not resize image for ${displayName}:`, err);
          return { ...row, imageBase64: '' };
        }
      })
    );
    
    return results;
  }, []);

  return {
    parseExcel,
    buildMappings,
    applyMappings,
    resizeImages,
  };
}

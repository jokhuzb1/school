import { useState, useCallback } from 'react';
import { registerStudent } from '../api';
import type { RegisterResult, StudentRow } from '../types';
import { appLogger } from '../utils/logger';
import { DEVICE_ERROR_CODES } from '../utils/errorCodes';
import { formatStudentName, normalizeSaveError } from './useStudentTable.errors';
import type { UseStudentTableOptions, UseStudentTableReturn } from './useStudentTable.types';

const LAST_PROVISIONING_ID_KEY = 'registrator_last_provisioning_id';

export function useStudentTable(options?: UseStudentTableOptions): UseStudentTableReturn {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRegisterResult, setLastRegisterResult] = useState<RegisterResult | null>(null);
  const [lastProvisioningId, setLastProvisioningId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_PROVISIONING_ID_KEY);
    } catch (error: unknown) {
      void error;
      return null;
    }
  });

  // Qo'lda bitta qo'shish
  const addStudent = useCallback((student: Omit<StudentRow, 'id' | 'source' | 'status'>) => {
    const newStudent: StudentRow = {
      ...student,
      id: `manual-${Date.now()}-${Math.random()}`,
      source: 'manual',
      status: 'pending',
    };
    setStudents(prev => [...prev, newStudent]);
  }, []);

  // Excel import (bulk)
  const importStudents = useCallback((rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => {
    const imported: StudentRow[] = rows.map((row, idx) => ({
      ...row,
      id: `import-${Date.now()}-${idx}`,
      source: 'import',
      status: 'pending',
    }));
    setStudents(prev => [...prev, ...imported]);
    return imported;
  }, []);

  // Update student
  const updateStudent = useCallback((id: string, updates: Partial<StudentRow>) => {
    setStudents(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  }, []);

  // Delete student
  const deleteStudent = useCallback((id: string) => {
    setStudents(prev => prev.filter(s => s.id !== id));
  }, []);

  const applyClassMapping = useCallback(
    (className: string, classId: string, classDisplayName?: string) => {
      const normalized = className.trim().toLowerCase();
      if (!normalized) return;
      setStudents((prev) =>
        prev.map((student) => {
          if (student.source !== 'import') return student;
          const currentName = student.className?.trim().toLowerCase();
          if (currentName !== normalized) return student;
          return {
            ...student,
            classId,
            className: classDisplayName || student.className,
          };
        }),
      );
    },
    [],
  );

  // Bitta studentni saqlash
  const saveStudent = useCallback(async (id: string, targetDeviceIds?: string[]) => {
    const student = students.find(s => s.id === id);
    if (!student) return;

    // Validation
    if (!student.firstName || !student.firstName.trim() || !student.lastName || !student.lastName.trim()) {
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: 'Ism va familiya majburiy',
          errorCode: DEVICE_ERROR_CODES.NAME_REQUIRED,
        } : s
      ));
      throw new Error('Ism va familiya majburiy');
    }

    if (!student.classId) {
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: 'Sinf tanlanmagan',
          errorCode: DEVICE_ERROR_CODES.CLASS_REQUIRED,
        } : s
      ));
      throw new Error('Sinf tanlanmagan');
    }

    // Set to pending
    setStudents(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'pending' as const, error: undefined } : s
    ));

    const fullName = formatStudentName(student);
    appLogger.debug(`[Save Student] Saving "${fullName}"`, {
      name: fullName,
      firstName: student.firstName,
      lastName: student.lastName,
      gender: student.gender,
      className: student.className,
      classId: student.classId,
      hasImage: !!student.imageBase64,
    });

    try {
      const result = await registerStudent(
        fullName,
        student.gender,
        student.imageBase64 || '',
        {
          firstName: student.firstName,
          lastName: student.lastName,
          fatherName: student.fatherName,
          parentPhone: student.parentPhone,
          classId: student.classId,
          targetDeviceIds,
        }
      );

      setLastRegisterResult(result);
      if (result.provisioningId) {
        setLastProvisioningId(result.provisioningId);
        try {
          localStorage.setItem(LAST_PROVISIONING_ID_KEY, result.provisioningId);
        } catch (error: unknown) {
          void error;
          // no-op in restricted environments
        }
      }

      const failedDevices = result.results.filter((item) => {
        if (!item.connection.ok) return true;
        if (item.userCreate && !item.userCreate.ok) return true;
        if (item.faceUpload && !item.faceUpload.ok) return true;
        return false;
      });

      if (failedDevices.length > 0) {
        const firstFailure = failedDevices[0];
        const pickReason = (status?: string, error?: string) => {
          if (error && (!status || ["RequestFailed", "UploadFailed", "ParseError"].includes(status))) {
            return error;
          }
          return status || error || "Noma'lum xato";
        };

        let reason = "";
        const deviceLabel = firstFailure.deviceName || firstFailure.deviceId;
        if (!firstFailure.connection.ok) {
          reason = pickReason(undefined, firstFailure.connection.message);
        } else if (firstFailure.userCreate && !firstFailure.userCreate.ok) {
          reason = `User yaratish: ${pickReason(
            firstFailure.userCreate.statusString,
            firstFailure.userCreate.errorMsg,
          )}`;
        } else if (firstFailure.faceUpload && !firstFailure.faceUpload.ok) {
          reason = `Face yuklash: ${pickReason(
            firstFailure.faceUpload.statusString,
            firstFailure.faceUpload.errorMsg,
          )}`;
        }

        const errorMessage = `Hikvision yozilmadi (${failedDevices.length} ta qurilma). Qurilma: ${deviceLabel}. ${reason}`;

        setStudents(prev => prev.map(s =>
          s.id === id
            ? {
                ...s,
                status: 'error' as const,
                error: errorMessage,
                errorCode: DEVICE_ERROR_CODES.DEVICE_SYNC_FAILED,
              }
            : s
        ));
        throw new Error(errorMessage);
      }

      setStudents(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'success' as const } : s
      ));
    } catch (err) {
      appLogger.error("[Save Student] registerStudent failed", {
        studentId: student.id,
        name: fullName,
        error: err instanceof Error ? err.message : String(err || "Unknown error"),
        raw: err,
      });
      const normalized = normalizeSaveError(err, options?.resolveDeviceLabel);
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: normalized.message,
          errorCode: normalized.code,
          errorRaw: normalized.raw,
        } : s
      ));
      throw new Error(normalized.message);
    }
  }, [students]);

  // Barcha pending larni saqlash
  const saveAllPending = useCallback(async (targetDeviceIds?: string[]) => {
    const pending = students.filter(s => s.status === 'pending');
    if (pending.length === 0) {
      return { successCount: 0, errorCount: 0, errorReasons: {} };
    }

    setIsSaving(true);
    
    let successCount = 0;
    let errorCount = 0;
    const errorReasons: Record<string, number> = {};
    
    for (const student of pending) {
      try {
        await saveStudent(student.id, targetDeviceIds);
        successCount++;
      } catch (err) {
        errorCount++;
        const message = err instanceof Error ? err.message : String(err || "Noma'lum xato");
        errorReasons[message] = (errorReasons[message] || 0) + 1;
        // Error already handled in saveStudent
        appLogger.error(`Failed to save student ${formatStudentName(student)}`, err);
      }
    }
    
    setIsSaving(false);
    
    appLogger.info(`[Save All] Success: ${successCount}, Errors: ${errorCount}`);
    return { successCount, errorCount, errorReasons };
  }, [students, saveStudent]);

  // Clear table
  const clearTable = useCallback(() => {
    setStudents([]);
  }, []);

  return {
    students,
    addStudent,
    updateStudent,
    deleteStudent,
    importStudents,
    applyClassMapping,
    saveStudent,
    saveAllPending,
    clearTable,
    isSaving,
    lastRegisterResult,
    lastProvisioningId,
  };
}

import { useState, useCallback } from 'react';
import { registerStudent } from '../api';
import type { RegisterResult, StudentRow } from '../types';

interface UseStudentTableReturn {
  students: StudentRow[];
  addStudent: (student: Omit<StudentRow, 'id' | 'source' | 'status'>) => void;
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  deleteStudent: (id: string) => void;
  importStudents: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => void;
  applyClassMapping: (className: string, classId: string, classDisplayName?: string) => void;
  saveStudent: (id: string, targetDeviceIds?: string[]) => Promise<void>;
  saveAllPending: (targetDeviceIds?: string[]) => Promise<{ successCount: number; errorCount: number }>;
  clearTable: () => void;
  isSaving: boolean;
  lastRegisterResult: RegisterResult | null;
  lastProvisioningId: string | null;
}

function formatStudentName(student: StudentRow): string {
  const parts = [student.lastName?.trim(), student.firstName?.trim()].filter(Boolean);
  return parts.join(' ').trim();
}

function normalizeSaveError(err: unknown): string {
  const raw = (err instanceof Error ? err.message : String(err || 'Xato'))
    .replace(/^Error:\s*/i, '')
    .trim();

  let message = raw;
  const backendPrefix = 'Backend provisioning failed:';
  if (message.startsWith(backendPrefix)) {
    message = message.slice(backendPrefix.length).trim();
  }

  if (message.startsWith('{')) {
    try {
      const parsed = JSON.parse(message);
      if (typeof parsed?.error === 'string' && parsed.error.trim()) {
        message = parsed.error.trim();
      } else if (typeof parsed?.message === 'string' && parsed.message.trim()) {
        message = parsed.message.trim();
      }
    } catch {
      // keep raw message when not valid JSON
    }
  }

  const lower = message.toLowerCase();
  if (lower.includes('unknown argument `firstname`') || lower.includes('unknown argument `lastname`')) {
    return "Server sxemasi yangilanmagan (firstName/lastName). Backendni yangilash kerak.";
  }
  if (lower.includes('studentprovisioning') && lower.includes('does not exist')) {
    return "Server migratsiyasi toliq emas (StudentProvisioning jadvali topilmadi).";
  }
  if (lower.includes('duplicate student in class')) {
    return "Bu sinfda shu ism-familiyali oquvchi allaqachon mavjud.";
  }
  if (lower.includes('class not found')) {
    return "Tanlangan sinf topilmadi.";
  }
  if (lower.includes('unauthorized')) {
    return "Backendga kirish rad etildi (Unauthorized). Login yoki tokenni tekshiring.";
  }
  if (lower.includes('invalid `tx.student.findfirst()` invocation')) {
    return "Serverda student tekshiruv querysi ishlamadi. Backend loglarini tekshiring.";
  }

  return message || 'Nomalum xato';
}

export function useStudentTable(): UseStudentTableReturn {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRegisterResult, setLastRegisterResult] = useState<RegisterResult | null>(null);
  const [lastProvisioningId, setLastProvisioningId] = useState<string | null>(null);

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
          error: 'Ism va familiya majburiy' 
        } : s
      ));
      throw new Error('Ism va familiya majburiy');
    }

    if (!student.classId) {
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: 'Sinf tanlanmagan' 
        } : s
      ));
      throw new Error('Sinf tanlanmagan');
    }

    // Set to pending
    setStudents(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'pending' as const, error: undefined } : s
    ));

    const fullName = formatStudentName(student);
    console.log(`[Save Student] Saving "${fullName}":`, {
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
          targetDeviceIds: targetDeviceIds && targetDeviceIds.length > 0 ? targetDeviceIds : undefined,
        }
      );

      setLastRegisterResult(result);
      if (result.provisioningId) {
        setLastProvisioningId(result.provisioningId);
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

        const errorMessage = `Hikvision yozilmadi (${failedDevices.length} ta qurilma). ${reason}`;

        setStudents(prev => prev.map(s => 
          s.id === id ? { ...s, status: 'error' as const, error: errorMessage } : s
        ));
        throw new Error(errorMessage);
      }

      setStudents(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'success' as const } : s
      ));
    } catch (err) {
      const normalizedMessage = normalizeSaveError(err);
      setStudents(prev => prev.map(s => 
        s.id === id ? { 
          ...s, 
          status: 'error' as const, 
          error: normalizedMessage,
        } : s
      ));
      throw new Error(normalizedMessage);
    }
  }, [students]);

  // Barcha pending larni saqlash
  const saveAllPending = useCallback(async (targetDeviceIds?: string[]) => {
    const pending = students.filter(s => s.status === 'pending');
    if (pending.length === 0) {
      return { successCount: 0, errorCount: 0 };
    }

    setIsSaving(true);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const student of pending) {
      try {
        await saveStudent(student.id, targetDeviceIds);
        successCount++;
      } catch (err) {
        errorCount++;
        // Error already handled in saveStudent
        console.error(`Failed to save student ${formatStudentName(student)}:`, err);
      }
    }
    
    setIsSaving(false);
    
    console.log(`[Save All] Success: ${successCount}, Errors: ${errorCount}`);
    return { successCount, errorCount };
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

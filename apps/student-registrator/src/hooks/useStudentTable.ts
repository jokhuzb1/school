import { useState, useCallback } from 'react';
import { registerStudent } from '../api';
import type { RegisterResult, StudentRow } from '../types';

const LAST_PROVISIONING_ID_KEY = 'registrator_last_provisioning_id';

interface UseStudentTableReturn {
  students: StudentRow[];
  addStudent: (student: Omit<StudentRow, 'id' | 'source' | 'status'>) => void;
  updateStudent: (id: string, updates: Partial<StudentRow>) => void;
  deleteStudent: (id: string) => void;
  importStudents: (rows: Omit<StudentRow, 'id' | 'source' | 'status'>[]) => StudentRow[];
  applyClassMapping: (className: string, classId: string, classDisplayName?: string) => void;
  saveStudent: (id: string, targetDeviceIds?: string[]) => Promise<void>;
  saveAllPending: (targetDeviceIds?: string[]) => Promise<{
    successCount: number;
    errorCount: number;
    errorReasons: Record<string, number>;
  }>;
  clearTable: () => void;
  isSaving: boolean;
  lastRegisterResult: RegisterResult | null;
  lastProvisioningId: string | null;
}

function formatStudentName(student: StudentRow): string {
  const parts = [student.lastName?.trim(), student.firstName?.trim()].filter(Boolean);
  return parts.join(' ').trim();
}

type NormalizedSaveError = {
  code: string;
  message: string;
  raw: string;
};

function normalizeSaveError(
  err: unknown,
  resolveDeviceLabel?: (input: string) => string,
): NormalizedSaveError {
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
  if (lower.includes('duplicate student in class')) {
    return {
      code: 'DUPLICATE_STUDENT',
      message: "Bu sinfda shu ism-familiyali o'quvchi allaqachon mavjud.",
      raw,
    };
  }
  if (lower.includes('class not found')) {
    return { code: 'CLASS_NOT_FOUND', message: "Tanlangan sinf topilmadi.", raw };
  }
  if (lower.includes('sinf tanlanishi shart')) {
    return { code: 'CLASS_REQUIRED', message: 'Sinf tanlanishi shart.', raw };
  }
  if (lower.includes('ism va familiya majburiy')) {
    return { code: 'NAME_REQUIRED', message: 'Ism va familiya majburiy.', raw };
  }
  if (lower.includes('device id takrorlangan') || lower.includes('qurilma id takrorlangan')) {
    return { code: 'DEVICE_ID_DUPLICATE', message: "Qurilma identifikatori takrorlangan.", raw };
  }
  if (lower.includes('unauthorized (no digest challenge)')) {
    return {
      code: 'HIKVISION_AUTH',
      message: "Qurilma autentifikatsiyasida xato (login/parol noto'g'ri yoki digest o'chirilgan).",
      raw,
    };
  }
  if (lower.includes('employeeNo') && lower.includes('badjsoncontent')) {
    return {
      code: 'HIKVISION_EMPLOYEE_NO',
      message: "Qurilma employeeNo formatini qabul qilmadi. Device ID strategiyasini tekshiring.",
      raw,
    };
  }
  if (lower.includes('user yaratish: http 400 bad request')) {
    return {
      code: 'HIKVISION_USER_CREATE_400',
      message: 'Qurilmada foydalanuvchini yaratish rad etildi (HTTP 400).',
      raw,
    };
  }
  if (lower.includes('face yuklash')) {
    return { code: 'HIKVISION_FACE_UPLOAD', message: 'Qurilmaga rasm yuklashda xato.', raw };
  }
  if (lower.includes('unauthorized')) {
    return {
      code: 'BACKEND_UNAUTHORIZED',
      message: "Backendga kirish rad etildi. Login yoki tokenni tekshiring.",
      raw,
    };
  }
  if (lower.includes('unknown argument `firstname`') || lower.includes('unknown argument `lastname`')) {
    return {
      code: 'BACKEND_SCHEMA_OLD',
      message: 'Server sxemasi eski (firstName/lastName maydonlari yoq). Backendni yangilang.',
      raw,
    };
  }
  if (lower.includes('studentprovisioning') && lower.includes('does not exist')) {
    return {
      code: 'MIGRATION_MISSING',
      message: 'Server migratsiyasi toliq emas (StudentProvisioning jadvali topilmadi).',
      raw,
    };
  }
  if (lower.includes('requestfailed')) {
    return {
      code: 'REQUEST_FAILED',
      message: "Qurilmaga so'rov muvaffaqiyatsiz tugadi. Ulanish va qurilma holatini tekshiring.",
      raw,
    };
  }

  if (resolveDeviceLabel) {
    message = resolveDeviceLabel(message);
  }

  if (message.toLowerCase().includes('operation timed out')) {
    const deviceMatch = message.match(/Qurilma\s+(.+?):\s*/i);
    const deviceName = deviceMatch?.[1]?.trim();
    const uzbek = deviceName
      ? `Qurilm ${deviceName} bilan bog'liq xatolik, tarmoqni tekshiring.`
      : "Qurilma bilan bog'liq xatolik, tarmoqni tekshiring.";
    return { code: 'TIMEOUT', message: uzbek, raw };
  }

  return {
    code: 'UNKNOWN',
    message: message || "Noma'lum xato",
    raw,
  };
}

export function useStudentTable(options?: {
  resolveDeviceLabel?: (input: string) => string;
}): UseStudentTableReturn {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastRegisterResult, setLastRegisterResult] = useState<RegisterResult | null>(null);
  const [lastProvisioningId, setLastProvisioningId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(LAST_PROVISIONING_ID_KEY);
    } catch {
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
          errorCode: 'NAME_REQUIRED',
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
          errorCode: 'CLASS_REQUIRED',
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
          targetDeviceIds,
        }
      );

      setLastRegisterResult(result);
      if (result.provisioningId) {
        setLastProvisioningId(result.provisioningId);
        try {
          localStorage.setItem(LAST_PROVISIONING_ID_KEY, result.provisioningId);
        } catch {
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
        let deviceLabel = firstFailure.deviceName || firstFailure.deviceId;
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
          s.id === id ? { ...s, status: 'error' as const, error: errorMessage, errorCode: 'DEVICE_SYNC_FAILED' } : s
        ));
        throw new Error(errorMessage);
      }

      setStudents(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'success' as const } : s
      ));
    } catch (err) {
      console.error("[Save Student] registerStudent failed:", {
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
        console.error(`Failed to save student ${formatStudentName(student)}:`, err);
      }
    }
    
    setIsSaving(false);
    
    console.log(`[Save All] Success: ${successCount}, Errors: ${errorCount}`);
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

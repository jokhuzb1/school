import type { StudentRow } from '../types';
import { DEVICE_ERROR_CODES, type DeviceErrorCode, toSafeUserMessage } from '../utils/errorCodes';

export function formatStudentName(student: StudentRow): string {
  const parts = [student.lastName?.trim(), student.firstName?.trim()].filter(Boolean);
  return parts.join(' ').trim();
}

type NormalizedSaveError = {
  code: DeviceErrorCode;
  message: string;
  raw: string;
};

export function normalizeSaveError(
  err: unknown,
  resolveDeviceLabel?: (input: string) => string,
): NormalizedSaveError {
  const raw = (err instanceof Error ? err.message : String(err || 'Xato')).replace(/^Error:\s*/i, '').trim();

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
    } catch (error: unknown) {
      void error;
      // keep raw message when not valid JSON
    }
  }

  const lower = message.toLowerCase();
  if (lower.includes('duplicate student in class')) {
    return {
      code: DEVICE_ERROR_CODES.DUPLICATE_STUDENT,
      message: "Bu sinfda shu ism-familiyali o'quvchi allaqachon mavjud.",
      raw,
    };
  }
  if (lower.includes('class not found')) {
    return { code: DEVICE_ERROR_CODES.CLASS_NOT_FOUND, message: 'Tanlangan sinf topilmadi.', raw };
  }
  if (lower.includes('sinf tanlanishi shart')) {
    return { code: DEVICE_ERROR_CODES.CLASS_REQUIRED, message: 'Sinf tanlanishi shart.', raw };
  }
  if (lower.includes('ism va familiya majburiy')) {
    return { code: DEVICE_ERROR_CODES.NAME_REQUIRED, message: 'Ism va familiya majburiy.', raw };
  }
  if (lower.includes('device id takrorlangan') || lower.includes('qurilma id takrorlangan')) {
    return { code: DEVICE_ERROR_CODES.DEVICE_ID_DUPLICATE, message: 'Qurilma identifikatori takrorlangan.', raw };
  }
  if (lower.includes('unauthorized (no digest challenge)')) {
    return {
      code: DEVICE_ERROR_CODES.HIKVISION_AUTH,
      message: "Qurilma autentifikatsiyasida xato (login/parol noto'g'ri yoki digest o'chirilgan).",
      raw,
    };
  }
  if (lower.includes('employeeNo') && lower.includes('badjsoncontent')) {
    return {
      code: DEVICE_ERROR_CODES.HIKVISION_EMPLOYEE_NO,
      message: 'Qurilma employeeNo formatini qabul qilmadi. Device ID strategiyasini tekshiring.',
      raw,
    };
  }
  if (lower.includes('user yaratish: http 400 bad request')) {
    return {
      code: DEVICE_ERROR_CODES.HIKVISION_USER_CREATE_400,
      message: 'Qurilmada foydalanuvchini yaratish rad etildi (HTTP 400).',
      raw,
    };
  }
  if (lower.includes('face yuklash')) {
    return { code: DEVICE_ERROR_CODES.HIKVISION_FACE_UPLOAD, message: 'Qurilmaga rasm yuklashda xato.', raw };
  }
  if (lower.includes('unauthorized')) {
    return {
      code: DEVICE_ERROR_CODES.BACKEND_UNAUTHORIZED,
      message: 'Backendga kirish rad etildi. Login yoki tokenni tekshiring.',
      raw,
    };
  }
  if (lower.includes('unknown argument `firstname`') || lower.includes('unknown argument `lastname`')) {
    return {
      code: DEVICE_ERROR_CODES.BACKEND_SCHEMA_OLD,
      message: 'Server sxemasi eski (firstName/lastName maydonlari yoq). Backendni yangilang.',
      raw,
    };
  }
  if (lower.includes('studentprovisioning') && lower.includes('does not exist')) {
    return {
      code: DEVICE_ERROR_CODES.MIGRATION_MISSING,
      message: 'Server migratsiyasi toliq emas (StudentProvisioning jadvali topilmadi).',
      raw,
    };
  }
  if (lower.includes('requestfailed')) {
    return {
      code: DEVICE_ERROR_CODES.REQUEST_FAILED,
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
    return { code: DEVICE_ERROR_CODES.TIMEOUT, message: uzbek, raw };
  }

  return {
    code: DEVICE_ERROR_CODES.UNKNOWN,
    message: toSafeUserMessage(message),
    raw,
  };
}

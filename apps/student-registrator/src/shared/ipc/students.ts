import { appLogger } from '../../utils/logger';
import { BACKEND_URL } from '../http/constants';
import { getAuthToken, getAuthUser } from '../http/session';
import { invoke } from './client';
import { RegisterResult } from './types';

export async function registerStudent(
  name: string,
  gender: string,
  faceImageBase64: string,
  options?: {
    firstName?: string;
    lastName?: string;
    fatherName?: string;
    parentPhone?: string;
    classId?: string;
    targetDeviceIds?: string[];
  },
): Promise<RegisterResult> {
  const token = getAuthToken();
  const user = getAuthUser();

  appLogger.debug('[Register] register_student', {
    backendUrl: BACKEND_URL,
    hasToken: Boolean(token),
    schoolId: user?.schoolId || '',
    targetDeviceIds: options?.targetDeviceIds?.length || 0,
  });

  return invoke<RegisterResult>('register_student', {
    name,
    gender,
    faceImageBase64,
    firstName: options?.firstName,
    lastName: options?.lastName,
    fatherName: options?.fatherName,
    parentPhone: options?.parentPhone,
    classId: options?.classId,
    targetDeviceIds: options?.targetDeviceIds,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
    schoolId: user?.schoolId || '',
  });
}

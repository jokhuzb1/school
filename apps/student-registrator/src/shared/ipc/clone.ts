import { BACKEND_URL } from '../http/constants';
import { getAuthToken, getAuthUser } from '../http/session';
import { invoke } from './client';

export async function cloneStudentsToDevice(params: {
  backendDeviceId: string;
  pageSize?: number;
  maxStudents?: number;
}): Promise<{
  ok: boolean;
  device: string;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ studentId?: string; name?: string; reason?: string }>;
}> {
  const token = getAuthToken();
  const user = getAuthUser();
  return invoke('clone_students_to_device', {
    backendDeviceId: params.backendDeviceId,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
    schoolId: user?.schoolId || '',
    pageSize: params.pageSize,
    maxStudents: params.maxStudents,
  });
}

export async function cloneDeviceToDevice(params: {
  sourceDeviceId: string;
  targetDeviceId: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  source: string;
  target: string;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ employeeNo?: string; name?: string; reason?: string }>;
}> {
  return invoke('clone_device_to_device', {
    sourceDeviceId: params.sourceDeviceId,
    targetDeviceId: params.targetDeviceId,
    limit: params.limit,
  });
}

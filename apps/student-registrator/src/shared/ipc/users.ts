import { invoke } from './client';
import { RecreateUserResult, UserInfoSearchResponse } from './types';

export async function fetchUsers(
  deviceId: string,
  options?: { offset?: number; limit?: number },
): Promise<UserInfoSearchResponse> {
  return invoke<UserInfoSearchResponse>('fetch_users', {
    deviceId,
    offset: options?.offset ?? 0,
    limit: options?.limit ?? 30,
  });
}

export async function deleteUser(deviceId: string, employeeNo: string): Promise<boolean> {
  return invoke<boolean>('delete_user', { deviceId, employeeNo });
}

export async function getUserFace(
  deviceId: string,
  employeeNo: string,
): Promise<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }> {
  return invoke<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }>('get_user_face', {
    deviceId,
    employeeNo,
  });
}

export async function getUserFaceByUrl(
  deviceId: string,
  employeeNo: string,
  faceUrl: string,
): Promise<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }> {
  return invoke<{ ok: boolean; employeeNo: string; faceUrl?: string; imageBase64: string }>('get_user_face_by_url', {
    deviceId,
    employeeNo,
    faceUrl,
  });
}

export async function recreateUser(
  deviceId: string,
  employeeNo: string,
  name: string,
  gender: string,
  newEmployeeNo: boolean,
  reuseExistingFace: boolean,
  faceImageBase64?: string,
): Promise<RecreateUserResult> {
  return invoke<RecreateUserResult>('recreate_user', {
    deviceId,
    employeeNo,
    name,
    gender,
    newEmployeeNo,
    reuseExistingFace,
    faceImageBase64,
  });
}

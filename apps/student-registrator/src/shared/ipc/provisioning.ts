import { appLogger } from '../../utils/logger';
import { getSchoolProvisioningLogs, ProvisioningDetails } from '../http/provisioning';
import { BACKEND_URL } from '../http/constants';
import { getAuthToken, getAuthUser } from '../http/session';
import { invoke } from './client';

export async function getProvisioning(provisioningId: string): Promise<ProvisioningDetails> {
  const token = getAuthToken();
  return invoke<ProvisioningDetails>('get_provisioning', {
    provisioningId,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
  });
}

export async function retryProvisioning(
  provisioningId: string,
  deviceIds: string[] = [],
): Promise<{
  ok: boolean;
  updated?: number;
  targetDeviceIds?: string[];
  perDeviceResults?: Array<{
    backendDeviceId: string;
    deviceExternalId?: string | null;
    deviceName?: string;
    status: string;
    lastError?: string | null;
    updatedAt?: string | null;
  }>;
  connectionCheck?: {
    checked: number;
    failed: number;
    missingCredentials: number;
  };
}> {
  const token = getAuthToken();

  return invoke<{
    ok: boolean;
    updated?: number;
    targetDeviceIds?: string[];
    perDeviceResults?: Array<{
      backendDeviceId: string;
      deviceExternalId?: string | null;
      deviceName?: string;
      status: string;
      lastError?: string | null;
      updatedAt?: string | null;
    }>;
    connectionCheck?: {
      checked: number;
      failed: number;
      missingCredentials: number;
    };
  }>('retry_provisioning', {
    provisioningId,
    backendUrl: BACKEND_URL,
    backendToken: token || '',
    deviceIds,
  });
}

/**
 * Syncs a student to devices by finding their last provisioning ID and retrying it.
 * This is used when a student's profile is updated and needs to be pushed to devices.
 */
export async function syncStudentToDevices(
  studentId: string,
  deviceIds: string[] = [],
): Promise<{
  ok: boolean;
  reason?: string;
  perDeviceResults: Array<{
    backendDeviceId: string;
    deviceExternalId?: string | null;
    deviceName?: string;
    status: string;
    lastError?: string | null;
    updatedAt?: string | null;
  }>;
}> {
  const user = getAuthUser();
  if (!user?.schoolId) {
    return { ok: false, reason: 'No school', perDeviceResults: [] };
  }

  try {
    appLogger.debug('[Sync] start', { studentId, schoolId: user.schoolId, backendUrl: BACKEND_URL });

    // 1. Find the last provisioning ID for this student from audit logs
    const response = await getSchoolProvisioningLogs(user.schoolId, {
      studentId,
      limit: 1,
      level: 'INFO',
      stage: 'PROVISIONING_START',
    });

    const lastLog = response.data[0];
    if (!lastLog || !lastLog.provisioningId) {
      appLogger.warn(`[Sync] No provisioning found for student ${studentId}`);
      return { ok: false, reason: 'No provisioning', perDeviceResults: [] };
    }

    // 2. Retry the provisioning
    appLogger.debug('[Sync] retry provisioning', { provisioningId: lastLog.provisioningId });
    const result = await retryProvisioning(lastLog.provisioningId, deviceIds);
    appLogger.debug('[Sync] retry result', result);

    return {
      ok: Boolean(result.ok),
      perDeviceResults: result.perDeviceResults || [],
    };
  } catch (err) {
    appLogger.error(`[Sync] Failed to sync student ${studentId}:`, err);
    return { ok: false, reason: 'Sync failed', perDeviceResults: [] };
  }
}

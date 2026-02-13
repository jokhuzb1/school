import { BACKEND_URL } from './constants';
import { assertSchoolScopedResponse, buildHttpApiError, fetchWithAuth } from './client';
import { SchoolDeviceInfo, WebhookInfo } from './school-types';

export async function fetchSchoolDevices(schoolId: string): Promise<SchoolDeviceInfo[]> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/devices`);
  await assertSchoolScopedResponse(res, 'Failed to fetch devices');
  return res.json();
}

export async function getWebhookInfo(schoolId: string): Promise<WebhookInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/webhook-info`);
  await assertSchoolScopedResponse(res, 'Failed to fetch webhook info');
  return res.json();
}

export async function rotateWebhookSecret(
  schoolId: string,
  direction: 'in' | 'out',
): Promise<{ ok: boolean; info: WebhookInfo }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/webhook/rotate`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
  await assertSchoolScopedResponse(res, 'Failed to rotate webhook secret');
  return res.json();
}

export async function testWebhookEndpoint(
  schoolId: string,
  direction: 'in' | 'out',
): Promise<{ ok: boolean; direction: 'in' | 'out'; method: string; path: string; testedAt: string }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/webhook/test`, {
    method: 'POST',
    body: JSON.stringify({ direction }),
  });
  await assertSchoolScopedResponse(res, 'Failed to test webhook endpoint');
  return res.json();
}

export async function createSchoolDevice(
  schoolId: string,
  payload: { name: string; deviceId: string; type?: string; location?: string },
): Promise<SchoolDeviceInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/schools/${schoolId}/devices`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to create backend device', 'POST');
  return res.json();
}

export async function updateSchoolDevice(
  id: string,
  payload: Partial<Pick<SchoolDeviceInfo, 'name' | 'deviceId' | 'type' | 'location' | 'isActive' | 'lastSeenAt'>>,
): Promise<SchoolDeviceInfo> {
  const res = await fetchWithAuth(`${BACKEND_URL}/devices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to update backend device', 'PUT');
  return res.json();
}

export async function getDeviceWebhookHealth(
  id: string,
): Promise<{ ok: boolean; deviceId: string; lastWebhookEventAt: string | null; lastSeenAt: string | null }> {
  const res = await fetchWithAuth(`${BACKEND_URL}/devices/${id}/webhook-health`);
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to fetch webhook health');
  return res.json();
}

export async function deleteSchoolDevice(id: string): Promise<boolean> {
  const res = await fetchWithAuth(`${BACKEND_URL}/devices/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw await buildHttpApiError(res, 'Failed to delete backend device', 'DELETE');
  return true;
}

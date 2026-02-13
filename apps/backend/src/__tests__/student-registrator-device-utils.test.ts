import { describe, expect, it } from 'vitest';
import {
  isDeviceCredentialsExpired,
  normalizeDeviceId,
  resolveLocalDeviceForBackend,
  resolveLocalDeviceByBackendId,
} from '../../apps/student-registrator/src/utils/deviceResolver';
import {
  buildImportRunMetrics,
  formatImportRunMetrics,
  normalizeAndDedupeDeviceImportCandidates,
} from '../../apps/student-registrator/src/features/device-import/deviceImportShared';
import {
  deriveBackendPresenceStatus,
  getDeviceSelectionStatusLabel,
} from '../../apps/student-registrator/src/utils/deviceStatus';

describe('student-registrator device helpers', () => {
  it('resolves local devices by backendId and external deviceId', () => {
    const backend = [
      { id: 'b-1', name: 'Gate A', deviceId: ' DEV-001 ' },
      { id: 'b-2', name: 'Gate B', deviceId: 'DEV-002' },
    ];
    const local = [
      { id: 'l-1', backendId: 'b-1', host: '1', port: 80, username: 'u', password: 'p' },
      { id: 'l-2', deviceId: 'dev-002', host: '1', port: 80, username: 'u', password: 'p' },
    ];

    expect(normalizeDeviceId(' DEV-ABC ')).toBe('dev-abc');
    expect(resolveLocalDeviceByBackendId('b-1', backend, local).reason).toBe('backend_id_match');
    expect(resolveLocalDeviceByBackendId('b-2', backend, local).reason).toBe('external_device_id_match');
    expect(resolveLocalDeviceForBackend(backend[1], []).reason).toBe('local_credentials_not_found');
  });

  it('detects credentials expiration safely', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isDeviceCredentialsExpired({ credentialsExpiresAt: past } as never)).toBe(true);
    expect(isDeviceCredentialsExpired({ credentialsExpiresAt: future } as never)).toBe(false);
    expect(isDeviceCredentialsExpired({ credentialsExpiresAt: 'not-a-date' } as never)).toBe(false);
  });

  it('normalizes and dedupes import candidates', () => {
    const deduped = normalizeAndDedupeDeviceImportCandidates([
      { employeeNo: '100', name: 'Ali Valiev', gender: 'male', numOfFace: 0 },
      { employeeNo: '100', name: 'Ali Valiev', gender: 'male', numOfFace: 1 },
      { employeeNo: '200', name: 'Laylo Karimova', gender: 'female', numOfFace: 1 },
    ]);

    expect(deduped.totalRaw).toBe(3);
    expect(deduped.uniqueCount).toBe(2);
    expect(deduped.duplicateCount).toBe(1);
    const first = deduped.normalized.find((item) => item.employeeNo === '100');
    expect(first?.hasFace).toBe(true);
    expect(first?.lastName).toBe('Ali');
  });

  it('formats import run metrics and device status labels', () => {
    const metrics = buildImportRunMetrics({
      total: 10,
      duplicates: 2,
      success: 8,
      failed: 2,
      synced: 5,
      faceCandidates: 6,
      faceSuccess: 5,
      faceFailed: 1,
    });
    expect(formatImportRunMetrics(metrics)).toContain('jami: 10');
    expect(getDeviceSelectionStatusLabel('no_credentials')).toBe("Sozlanmagan");

    const nowIso = new Date().toISOString();
    const staleIso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(
      deriveBackendPresenceStatus({ id: 'b', name: 'n', lastSeenAt: nowIso }, { id: 'l' } as never),
    ).toBe('online');
    expect(
      deriveBackendPresenceStatus({ id: 'b', name: 'n', lastSeenAt: staleIso }, { id: 'l' } as never),
    ).toBe('offline');
    expect(
      deriveBackendPresenceStatus({ id: 'b', name: 'n', lastSeenAt: nowIso }, null),
    ).toBe('no_credentials');
  });
});

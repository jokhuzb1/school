import { splitPersonName } from '../../utils/name';

export type RawDeviceImportCandidate = {
  employeeNo: string;
  name: string;
  gender?: string;
  numOfFace?: number;
  sourceBackendId?: string;
};

export type NormalizedDeviceImportCandidate = {
  employeeNo: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  hasFace: boolean;
  sourceBackendId?: string;
};

export type DeviceImportDedupeResult = {
  normalized: NormalizedDeviceImportCandidate[];
  totalRaw: number;
  uniqueCount: number;
  duplicateCount: number;
};

type ImportRunMetricsParams = {
  total?: number;
  duplicates?: number;
  success?: number;
  failed?: number;
  synced?: number;
  faceCandidates?: number;
  faceSuccess?: number;
  faceFailed?: number;
};

export type ImportRunMetrics = Required<ImportRunMetricsParams>;

function toNormalizedGender(input?: string): 'male' | 'female' {
  const lower = String(input || '').trim().toLowerCase();
  return lower.startsWith('f') ? 'female' : 'male';
}

function choosePreferredCandidate(
  current: RawDeviceImportCandidate,
  incoming: RawDeviceImportCandidate,
): RawDeviceImportCandidate {
  const currentHasFace = (current.numOfFace || 0) > 0;
  const incomingHasFace = (incoming.numOfFace || 0) > 0;
  if (!currentHasFace && incomingHasFace) return incoming;
  if (currentHasFace && !incomingHasFace) return current;

  const currentNameLen = String(current.name || '').trim().length;
  const incomingNameLen = String(incoming.name || '').trim().length;
  if (incomingNameLen > currentNameLen) return incoming;
  return current;
}

function buildCandidateKey(candidate: RawDeviceImportCandidate): string {
  const employeeNo = String(candidate.employeeNo || '').trim().toLowerCase();
  if (employeeNo) return `employee:${employeeNo}`;
  return `name:${String(candidate.name || '').trim().toLowerCase()}`;
}

export function normalizeAndDedupeDeviceImportCandidates(
  candidates: RawDeviceImportCandidate[],
): DeviceImportDedupeResult {
  const byKey = new Map<string, RawDeviceImportCandidate>();
  let duplicateCount = 0;

  for (const candidate of candidates) {
    const key = buildCandidateKey(candidate);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    duplicateCount += 1;
    byKey.set(key, choosePreferredCandidate(existing, candidate));
  }

  const normalized: NormalizedDeviceImportCandidate[] = Array.from(byKey.values()).map((item) => {
    const parsedName = splitPersonName(item.name || '');
    return {
      employeeNo: String(item.employeeNo || '').trim(),
      name: String(item.name || '').trim(),
      firstName: parsedName.firstName,
      lastName: parsedName.lastName,
      gender: toNormalizedGender(item.gender),
      hasFace: (item.numOfFace || 0) > 0,
      sourceBackendId: item.sourceBackendId,
    };
  });

  return {
    normalized,
    totalRaw: candidates.length,
    uniqueCount: normalized.length,
    duplicateCount,
  };
}

export function buildImportRunMetrics(params: ImportRunMetricsParams): ImportRunMetrics {
  return {
    total: params.total || 0,
    duplicates: params.duplicates || 0,
    success: params.success || 0,
    failed: params.failed || 0,
    synced: params.synced || 0,
    faceCandidates: params.faceCandidates || 0,
    faceSuccess: params.faceSuccess || 0,
    faceFailed: params.faceFailed || 0,
  };
}

export function formatImportRunMetrics(metrics: ImportRunMetrics): string {
  return [
    `jami: ${metrics.total}`,
    `dublikat: ${metrics.duplicates}`,
    `success: ${metrics.success}`,
    `failed: ${metrics.failed}`,
    `sync: ${metrics.synced}`,
    `face: ${metrics.faceSuccess}/${metrics.faceCandidates} (xato: ${metrics.faceFailed})`,
  ].join(' | ');
}

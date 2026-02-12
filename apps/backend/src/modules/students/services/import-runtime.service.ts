type ImportJobStatus = "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED";

export type ImportRuntimeJob = {
  id: string;
  schoolId: string;
  status: ImportJobStatus;
  retryCount: number;
  lastError: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  totalRows: number;
  processed: number;
  success: number;
  failed: number;
  synced: number;
};

type ImportMetrics = {
  totalRuns: number;
  totalSuccess: number;
  totalFailed: number;
  totalSynced: number;
  totalLatencyMs: number;
  retryRuns: number;
};

const jobs = new Map<string, ImportRuntimeJob>();
const idempotentResults = new Map<string, any>();
const locks = new Set<string>();
const metricsBySchool = new Map<string, ImportMetrics>();

function idemKey(schoolId: string, key: string): string {
  return `${schoolId}:${key}`;
}

function lockKey(schoolId: string, employeeNo: string): string {
  return `${schoolId}:${employeeNo}`;
}

function metricsForSchool(schoolId: string): ImportMetrics {
  const existing = metricsBySchool.get(schoolId);
  if (existing) return existing;
  const created: ImportMetrics = {
    totalRuns: 0,
    totalSuccess: 0,
    totalFailed: 0,
    totalSynced: 0,
    totalLatencyMs: 0,
    retryRuns: 0,
  };
  metricsBySchool.set(schoolId, created);
  return created;
}

export function createImportJob(params: {
  id: string;
  schoolId: string;
  totalRows: number;
}): ImportRuntimeJob {
  const job: ImportRuntimeJob = {
    id: params.id,
    schoolId: params.schoolId,
    status: "PENDING",
    retryCount: 0,
    lastError: null,
    startedAt: new Date(),
    finishedAt: null,
    totalRows: params.totalRows,
    processed: 0,
    success: 0,
    failed: 0,
    synced: 0,
  };
  jobs.set(job.id, job);
  return job;
}

export function getImportJob(jobId: string): ImportRuntimeJob | null {
  return jobs.get(jobId) || null;
}

export function updateImportJob(
  jobId: string,
  patch: Partial<ImportRuntimeJob>,
): ImportRuntimeJob | null {
  const current = jobs.get(jobId);
  if (!current) return null;
  const updated: ImportRuntimeJob = {
    ...current,
    ...patch,
  };
  jobs.set(jobId, updated);
  return updated;
}

export function incrementImportJobRetry(jobId: string): ImportRuntimeJob | null {
  const current = jobs.get(jobId);
  if (!current) return null;
  const updated = {
    ...current,
    retryCount: current.retryCount + 1,
    status: "PENDING" as const,
    lastError: null,
  };
  jobs.set(jobId, updated);
  return updated;
}

export function recordImportMetrics(params: {
  schoolId: string;
  success: number;
  failed: number;
  synced: number;
  latencyMs: number;
  isRetry: boolean;
}) {
  const metrics = metricsForSchool(params.schoolId);
  metrics.totalRuns += 1;
  metrics.totalSuccess += params.success;
  metrics.totalFailed += params.failed;
  metrics.totalSynced += params.synced;
  metrics.totalLatencyMs += Math.max(0, params.latencyMs);
  if (params.isRetry) {
    metrics.retryRuns += 1;
  }
}

export function getImportMetrics(schoolId: string) {
  const metrics = metricsForSchool(schoolId);
  const total = Math.max(1, metrics.totalRuns);
  const processed = metrics.totalSuccess + metrics.totalFailed;
  return {
    totalRuns: metrics.totalRuns,
    totalSuccess: metrics.totalSuccess,
    totalFailed: metrics.totalFailed,
    totalSynced: metrics.totalSynced,
    successRate: processed > 0 ? metrics.totalSuccess / processed : 0,
    retryRate: metrics.retryRuns / total,
    meanLatencyMs: metrics.totalLatencyMs / total,
  };
}

export function getIdempotentResult(schoolId: string, key: string): any | null {
  if (!key.trim()) return null;
  return idempotentResults.get(idemKey(schoolId, key)) || null;
}

export function setIdempotentResult(schoolId: string, key: string, value: any) {
  if (!key.trim()) return;
  idempotentResults.set(idemKey(schoolId, key), value);
}

export function acquireImportLocks(
  schoolId: string,
  employeeNos: string[],
): { ok: boolean; conflicts: string[] } {
  const keys = employeeNos.map((employeeNo) => lockKey(schoolId, employeeNo));
  const conflicts = keys.filter((key) => locks.has(key));
  if (conflicts.length > 0) {
    return {
      ok: false,
      conflicts: conflicts.map((key) => key.split(":").slice(1).join(":")),
    };
  }
  keys.forEach((key) => locks.add(key));
  return { ok: true, conflicts: [] };
}

export function releaseImportLocks(schoolId: string, employeeNos: string[]) {
  employeeNos
    .map((employeeNo) => lockKey(schoolId, employeeNo))
    .forEach((key) => locks.delete(key));
}

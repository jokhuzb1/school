type OperationName =
  | "device.create"
  | "device.update"
  | "device.delete"
  | "webhook.rotate"
  | "webhook.test";

type OperationCounter = {
  total: number;
  success: number;
  failed: number;
  totalDurationMs: number;
};

const counters: Record<OperationName, OperationCounter> = {
  "device.create": { total: 0, success: 0, failed: 0, totalDurationMs: 0 },
  "device.update": { total: 0, success: 0, failed: 0, totalDurationMs: 0 },
  "device.delete": { total: 0, success: 0, failed: 0, totalDurationMs: 0 },
  "webhook.rotate": { total: 0, success: 0, failed: 0, totalDurationMs: 0 },
  "webhook.test": { total: 0, success: 0, failed: 0, totalDurationMs: 0 },
};

export function recordDeviceOperation(
  op: OperationName,
  ok: boolean,
  durationMs: number,
) {
  const bucket = counters[op];
  bucket.total += 1;
  if (ok) bucket.success += 1;
  else bucket.failed += 1;
  bucket.totalDurationMs += Math.max(0, Math.round(durationMs));
}

export function getDeviceOperationMetrics() {
  const result: Record<
    string,
    OperationCounter & { avgDurationMs: number; successRate: number }
  > = {};

  for (const key of Object.keys(counters) as OperationName[]) {
    const c = counters[key];
    const avgDurationMs = c.total > 0 ? Math.round(c.totalDurationMs / c.total) : 0;
    const successRate = c.total > 0 ? Number((c.success / c.total).toFixed(4)) : 0;
    result[key] = { ...c, avgDurationMs, successRate };
  }

  return {
    generatedAt: new Date().toISOString(),
    operations: result,
  };
}


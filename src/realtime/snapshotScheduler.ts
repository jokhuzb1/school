import prisma from "../prisma";
import {
  emitClassSnapshot,
  emitSchoolSnapshot,
  getActiveClassKeys,
} from "./snapshotBus";
import { computeClassSnapshot, computeSchoolSnapshot } from "./snapshot.service";

type Logger = {
  info?: (message: string, ...args: unknown[]) => void;
  warn?: (message: string, ...args: unknown[]) => void;
  error?: (message: string, ...args: unknown[]) => void;
};

export type SnapshotSchedulerOptions = {
  debounceMs?: number;
  intervalMs?: number;
  logger?: Logger;
};

const DEFAULT_DEBOUNCE_MS = 1500;
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;

const dirtySchools = new Set<string>();
const debounceTimers = new Map<string, NodeJS.Timeout>();
const inFlight = new Set<string>();
const dirtyClasses = new Set<string>();
const classDebounceTimers = new Map<string, NodeJS.Timeout>();
const classInFlight = new Set<string>();

let configuredDebounceMs = DEFAULT_DEBOUNCE_MS;
let configuredIntervalMs = DEFAULT_INTERVAL_MS;
let configuredLogger: Logger = console;
let schedulerStarted = false;

async function flushSchoolSnapshots(
  schoolId: string,
  includeWeekly = false,
) {
  if (inFlight.has(schoolId)) return;
  inFlight.add(schoolId);

  try {
    const [startedSnapshot, activeSnapshot] = await Promise.all([
      computeSchoolSnapshot(schoolId, "started", { includeWeekly }),
      computeSchoolSnapshot(schoolId, "active", { includeWeekly }),
    ]);
    if (startedSnapshot) emitSchoolSnapshot(startedSnapshot);
    if (activeSnapshot) emitSchoolSnapshot(activeSnapshot);
  } catch (err) {
    configuredLogger.error?.("snapshot flush failed", err);
  } finally {
    inFlight.delete(schoolId);
    dirtySchools.delete(schoolId);
  }
}

const buildClassKey = (schoolId: string, classId: string) =>
  `${schoolId}:${classId}`;

const parseClassKey = (key: string): { schoolId: string; classId: string } => {
  const [schoolId, classId] = key.split(":");
  return { schoolId, classId };
};

async function flushClassSnapshots(key: string, includeWeekly = false) {
  if (classInFlight.has(key)) return;
  classInFlight.add(key);

  try {
    const { schoolId, classId } = parseClassKey(key);
    const [startedSnapshot, activeSnapshot] = await Promise.all([
      computeClassSnapshot(schoolId, classId, "started", { includeWeekly }),
      computeClassSnapshot(schoolId, classId, "active", { includeWeekly }),
    ]);
    if (startedSnapshot) emitClassSnapshot(startedSnapshot);
    if (activeSnapshot) emitClassSnapshot(activeSnapshot);
  } catch (err) {
    configuredLogger.error?.("class snapshot flush failed", err);
  } finally {
    classInFlight.delete(key);
    dirtyClasses.delete(key);
  }
}

function scheduleDebounce(schoolId: string) {
  if (debounceTimers.has(schoolId)) return;
  const timer = setTimeout(() => {
    debounceTimers.delete(schoolId);
    void flushSchoolSnapshots(schoolId);
  }, configuredDebounceMs);
  debounceTimers.set(schoolId, timer);
}

function scheduleClassDebounce(key: string) {
  if (classDebounceTimers.has(key)) return;
  const timer = setTimeout(() => {
    classDebounceTimers.delete(key);
    void flushClassSnapshots(key);
  }, configuredDebounceMs);
  classDebounceTimers.set(key, timer);
}

export function markSchoolDirty(schoolId: string) {
  dirtySchools.add(schoolId);
  scheduleDebounce(schoolId);
}

export function markClassDirty(schoolId: string, classId: string) {
  const key = buildClassKey(schoolId, classId);
  dirtyClasses.add(key);
  scheduleClassDebounce(key);
}

export function startSnapshotScheduler(options: SnapshotSchedulerOptions = {}) {
  if (schedulerStarted) return;
  schedulerStarted = true;

  configuredDebounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS;
  configuredIntervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  configuredLogger = options.logger ?? console;

  const interval = setInterval(async () => {
    try {
      const schools = await prisma.school.findMany({ select: { id: true } });
      await Promise.all(
        schools.map((school) => flushSchoolSnapshots(school.id, false)),
      );

      const activeClassKeys = getActiveClassKeys();
      await Promise.all(
        activeClassKeys.map((key) => flushClassSnapshots(key, false)),
      );
    } catch (err) {
      configuredLogger.error?.("snapshot fallback failed", err);
    }
  }, configuredIntervalMs);

  interval.unref?.();
}

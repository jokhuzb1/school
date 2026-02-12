import { redactSensitiveData, redactSensitiveString } from '../../utils/redact';
import { BACKEND_URL, FETCH_TIMEOUT_MS } from './constants';

const API_DEBUG_STORAGE_KEY = 'registrator_api_debug_entries';
const API_DEBUG_LIMIT = 150;

type ApiDebugLevel = 'info' | 'warn' | 'error';

export type ApiRequestContext = 'auth' | 'api';
export type ApiErrorCode = 'NETWORK_ERROR' | 'REQUEST_TIMEOUT' | 'HTTP_ERROR' | 'INVALID_RESPONSE';

export interface ApiDebugEntry {
  id: string;
  at: string;
  level: ApiDebugLevel;
  context: ApiRequestContext;
  method: string;
  url: string;
  message: string;
  backendUrl: string;
  clientOrigin: string | null;
  status?: number;
  durationMs?: number;
  online: boolean | null;
}

export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly method: string;
  readonly url: string;
  readonly debugId: string;
  readonly status?: number;

  constructor(params: {
    message: string;
    code: ApiErrorCode;
    method: string;
    url: string;
    debugId: string;
    status?: number;
  }) {
    super(params.message);
    this.name = 'ApiRequestError';
    this.code = params.code;
    this.method = params.method;
    this.url = params.url;
    this.debugId = params.debugId;
    this.status = params.status;
  }
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Unknown error';
}

function getOnlineState(): boolean | null {
  if (typeof navigator === 'undefined') return null;
  return navigator.onLine;
}

function getClientOrigin(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.location.origin || null;
  } catch (error: unknown) {
    void error;
    return null;
  }
}

function createDebugId(): string {
  return `dbg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function readStoredApiDebugEntries(): ApiDebugEntry[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(API_DEBUG_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ApiDebugEntry[]) : [];
  } catch (error: unknown) {
    void error;
    return [];
  }
}

function writeStoredApiDebugEntries(entries: ApiDebugEntry[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(API_DEBUG_STORAGE_KEY, JSON.stringify(entries));
  } catch (error: unknown) {
    void error;
    // Ignore storage failures on locked-down environments.
  }
}

export function pushApiDebugEntry(
  input: Omit<ApiDebugEntry, 'id' | 'at' | 'backendUrl' | 'online' | 'clientOrigin'>,
): string {
  const entry: ApiDebugEntry = {
    ...input,
    url: redactSensitiveString(input.url),
    message: redactSensitiveString(input.message),
    id: createDebugId(),
    at: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    clientOrigin: getClientOrigin(),
    online: getOnlineState(),
  };
  const current = readStoredApiDebugEntries();
  const next = [...current, entry].slice(-API_DEBUG_LIMIT);
  writeStoredApiDebugEntries(next);
  return entry.id;
}

export function getApiDebugEntries(limit = 40): ApiDebugEntry[] {
  const entries = readStoredApiDebugEntries();
  if (limit <= 0) return [];
  return entries.slice(-limit);
}

export function getApiDebugReport(limit = 40): string {
  const entries = redactSensitiveData(getApiDebugEntries(limit));
  return JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      backendUrl: BACKEND_URL,
      timeoutMs: FETCH_TIMEOUT_MS,
      entries,
    },
    null,
    2,
  );
}

export function clearApiDebugEntries(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(API_DEBUG_STORAGE_KEY);
}

export function formatApiErrorMessage(error: unknown, fallback = 'Xatolik yuz berdi'): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

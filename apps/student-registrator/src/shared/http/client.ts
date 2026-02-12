import { appLogger } from '../../utils/logger';
import { BACKEND_URL, FETCH_TIMEOUT_MS, FRONTEND_CONTRACT_VERSION, VERBOSE_NETWORK_DEBUG } from './constants';
import { ApiRequestContext, ApiRequestError, pushApiDebugEntry, toErrorMessage } from './debug';
import { AuthUser, getAuthToken, setAuth, logout } from './session';

function normalizeHeaders(input?: HeadersInit): Record<string, string> {
  if (!input) return {};
  if (input instanceof Headers) {
    const fromHeaders: Record<string, string> = {};
    input.forEach((value, key) => {
      fromHeaders[key] = value;
    });
    return fromHeaders;
  }
  if (Array.isArray(input)) {
    return Object.fromEntries(input);
  }
  return { ...input };
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === lower);
}

async function request(
  url: string,
  options: RequestInit,
  context: ApiRequestContext,
  withAuth: boolean,
): Promise<Response> {
  const token = getAuthToken();
  const headers = normalizeHeaders(options.headers);

  if (options.body && !(options.body instanceof FormData) && !hasHeader(headers, 'Content-Type')) {
    headers['Content-Type'] = 'application/json';
  }

  if (withAuth && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  headers['X-Client-Contract-Version'] = FRONTEND_CONTRACT_VERSION;
  const method = (options.method || 'GET').toUpperCase();
  const startedAt = Date.now();
  const controller = options.signal ? null : new AbortController();
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS) : null;

  appLogger.debug('[API] request', { method, url, context });

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller?.signal,
    });

    const durationMs = Date.now() - startedAt;
    appLogger.debug('[API] response', { method, url, status: res.status, ok: res.ok, durationMs });

    if (!res.ok || VERBOSE_NETWORK_DEBUG) {
      pushApiDebugEntry({
        level: res.ok ? 'info' : 'warn',
        context,
        method,
        url,
        status: res.status,
        durationMs,
        message: res.ok ? 'Request OK' : `HTTP ${res.status}`,
      });
    }

    return res;
  } catch (error: unknown) {
    const durationMs = Date.now() - startedAt;
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    const debugId = pushApiDebugEntry({
      level: 'error',
      context,
      method,
      url,
      durationMs,
      message: `${timedOut ? 'Timeout' : 'Network error'}: ${toErrorMessage(error)}`,
    });

    throw new ApiRequestError({
      message: timedOut
        ? `Server javobi kechikdi (${FETCH_TIMEOUT_MS}ms). [debug:${debugId}]`
        : `Server bilan bog'lanib bo'lmadi. URL va internetni tekshiring. [debug:${debugId}]`,
      code: timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      method,
      url,
      debugId,
    });
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const url = `${BACKEND_URL}/auth/login`;
  appLogger.debug('[Auth] login attempt', { email, backendUrl: BACKEND_URL });

  const res = await request(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    'auth',
    false,
  );

  if (!res.ok) {
    throw await buildHttpApiError(res, 'Login failed', 'POST', 'auth');
  }

  const data = await res.json().catch((error: unknown) => {
    const debugId = pushApiDebugEntry({
      level: 'error',
      context: 'auth',
      method: 'POST',
      url,
      status: res.status,
      message: `Invalid login response JSON: ${toErrorMessage(error)}`,
    });

    throw new ApiRequestError({
      message: `Serverdan noto'g'ri login javobi keldi. [debug:${debugId}]`,
      code: 'INVALID_RESPONSE',
      method: 'POST',
      url,
      status: res.status,
      debugId,
    });
  });

  setAuth(data.token, data.user);
  return data;
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  return request(url, options, 'api', true);
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text().catch(() => '');
  if (!text) return fallback;

  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.message)) {
      const arrMessage = parsed.message
        .filter((item: unknown) => typeof item === 'string')
        .join(', ')
        .trim();
      if (arrMessage) return arrMessage;
    }
    if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error.trim();
    if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message.trim();
    if (typeof parsed === 'string' && parsed.trim()) return parsed.trim();
  } catch (error: unknown) {
    void error;
    // keep raw text
  }

  return text;
}

export async function buildHttpApiError(
  res: Response,
  fallback: string,
  method = 'GET',
  context: ApiRequestContext = 'api',
): Promise<ApiRequestError> {
  const message = await readErrorMessage(res, fallback);
  const debugId = pushApiDebugEntry({
    level: 'warn',
    context,
    method,
    url: res.url || `${BACKEND_URL}/unknown`,
    status: res.status,
    message,
  });

  return new ApiRequestError({
    message: `${message} (status ${res.status}) [debug:${debugId}]`,
    code: 'HTTP_ERROR',
    method,
    url: res.url || `${BACKEND_URL}/unknown`,
    status: res.status,
    debugId,
  });
}

export async function assertSchoolScopedResponse(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;

  if (res.status === 404) {
    logout();
    const debugId = pushApiDebugEntry({
      level: 'warn',
      context: 'api',
      method: 'GET',
      url: res.url || `${BACKEND_URL}/unknown`,
      status: res.status,
      message: 'School not found for current session',
    });

    throw new ApiRequestError({
      message: `Sessiya eskirgan: maktab topilmadi. Qayta login qiling. [debug:${debugId}]`,
      code: 'HTTP_ERROR',
      method: 'GET',
      url: res.url || `${BACKEND_URL}/unknown`,
      status: 404,
      debugId,
    });
  }

  throw await buildHttpApiError(res, fallback);
}

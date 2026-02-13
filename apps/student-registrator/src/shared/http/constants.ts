export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
export const FRONTEND_CONTRACT_VERSION = 'sr-frontend-v1';

const DEFAULT_FETCH_TIMEOUT_MS = 20_000;
const parsedFetchTimeout = Number(import.meta.env.VITE_FETCH_TIMEOUT_MS || DEFAULT_FETCH_TIMEOUT_MS);

export const FETCH_TIMEOUT_MS =
  Number.isFinite(parsedFetchTimeout) && parsedFetchTimeout > 0
    ? parsedFetchTimeout
    : DEFAULT_FETCH_TIMEOUT_MS;

export const VERBOSE_NETWORK_DEBUG =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_NETWORK_DEBUG === 'true';

const DEBUG_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_NETWORK_DEBUG === 'true';

export const appLogger = {
  debug: (...args: unknown[]) => {
    if (DEBUG_ENABLED) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (DEBUG_ENABLED) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    if (DEBUG_ENABLED) console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

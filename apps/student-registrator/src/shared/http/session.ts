export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  schoolId: string | null;
}

const AUTH_TOKEN_KEY = 'registrator_auth_token';
const AUTH_USER_KEY = 'registrator_auth_user';

let authTokenMemory: string | null = null;
let authUserMemory: AuthUser | null = null;

function readSessionValue(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch (error: unknown) {
    void error;
    return null;
  }
}

function writeSessionValue(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch (error: unknown) {
    void error;
    // best effort only
  }
}

function clearSessionValue(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch (error: unknown) {
    void error;
    // best effort only
  }
}

function readLegacyLocalValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error: unknown) {
    void error;
    return null;
  }
}

function clearLegacyLocalValue(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error: unknown) {
    void error;
    // best effort only
  }
}

export function getAuthToken(): string | null {
  if (authTokenMemory) return authTokenMemory;
  const fromSession = readSessionValue(AUTH_TOKEN_KEY);
  if (fromSession) {
    authTokenMemory = fromSession;
    return fromSession;
  }

  const legacy = readLegacyLocalValue(AUTH_TOKEN_KEY);
  if (legacy) {
    authTokenMemory = legacy;
    writeSessionValue(AUTH_TOKEN_KEY, legacy);
    clearLegacyLocalValue(AUTH_TOKEN_KEY);
    return legacy;
  }

  return null;
}

export function getAuthUser(): AuthUser | null {
  if (authUserMemory) return authUserMemory;
  const data = readSessionValue(AUTH_USER_KEY) || readLegacyLocalValue(AUTH_USER_KEY);
  if (!data) return null;

  try {
    const parsed = JSON.parse(data) as AuthUser;
    authUserMemory = parsed;
    writeSessionValue(AUTH_USER_KEY, data);
    clearLegacyLocalValue(AUTH_USER_KEY);
    return parsed;
  } catch (error: unknown) {
    void error;
    return null;
  }
}

export function setAuth(token: string, user: AuthUser): void {
  authTokenMemory = token;
  authUserMemory = user;
  writeSessionValue(AUTH_TOKEN_KEY, token);
  writeSessionValue(AUTH_USER_KEY, JSON.stringify(user));
  clearLegacyLocalValue(AUTH_TOKEN_KEY);
  clearLegacyLocalValue(AUTH_USER_KEY);
}

export function logout(): void {
  authTokenMemory = null;
  authUserMemory = null;
  clearSessionValue(AUTH_TOKEN_KEY);
  clearSessionValue(AUTH_USER_KEY);
  clearLegacyLocalValue(AUTH_TOKEN_KEY);
  clearLegacyLocalValue(AUTH_USER_KEY);
}

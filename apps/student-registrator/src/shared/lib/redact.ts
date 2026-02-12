const SENSITIVE_KEYS = [
  'password',
  'token',
  'authorization',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'cookie',
  'faceimagebase64',
  'imagebase64',
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return SENSITIVE_KEYS.some((item) => normalized.includes(item));
}

export function redactSensitiveString(value: string): string {
  return value
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1***')
    .replace(/([?&](?:token|secret|apikey|api_key|password)=)[^&]*/gi, '$1***');
}

export function redactSensitiveData<T>(input: T): T {
  if (typeof input === 'string') {
    return redactSensitiveString(input) as T;
  }
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item)) as T;
  }
  if (input && typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        output[key] = '***';
      } else {
        output[key] = redactSensitiveData(value);
      }
    }
    return output as T;
  }
  return input;
}

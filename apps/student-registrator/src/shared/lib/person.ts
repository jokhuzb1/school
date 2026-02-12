export type NormalizedGender = 'male' | 'female' | 'unknown';

export function normalizeGenderValue(input?: string | null): NormalizedGender {
  const lower = String(input || '').trim().toLowerCase();
  if (!lower) return 'unknown';

  const maleTokens = ['m', 'male', 'erkak', 'o\'g\'il', 'boy'];
  const femaleTokens = ['f', 'female', 'ayol', 'qiz', 'girl'];

  if (maleTokens.some((token) => lower === token || lower.startsWith(`${token} `))) return 'male';
  if (femaleTokens.some((token) => lower === token || lower.startsWith(`${token} `))) return 'female';
  if (lower.startsWith('m')) return 'male';
  if (lower.startsWith('f')) return 'female';
  return 'unknown';
}

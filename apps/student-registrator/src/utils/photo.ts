export function buildBackendPhotoUrl(baseUrl: string, value?: string | null): string {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${baseUrl}${value.startsWith('/') ? '' : '/'}${value}`;
}

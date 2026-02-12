export function stripDataUrlPrefix(value: string): string {
  return String(value || '').split(',')[1] || String(value || '');
}

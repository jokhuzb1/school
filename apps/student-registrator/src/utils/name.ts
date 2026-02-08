export type SplitNameResult = {
  firstName: string;
  lastName: string;
};

export function splitPersonName(value: string): SplitNameResult {
  const cleaned = (value || '').trim();
  if (!cleaned) return { firstName: '', lastName: '' };

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: '',
    };
  }

  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(' '),
  };
}

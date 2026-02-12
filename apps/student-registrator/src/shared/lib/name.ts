export type SplitNameResult = {
  firstName: string;
  lastName: string;
};

export type SplitFullNameResult = {
  firstName: string;
  lastName: string;
  fatherName: string;
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

export function splitPersonNameWithFather(value: string): SplitFullNameResult {
  const cleaned = (value || '').trim();
  if (!cleaned) return { firstName: '', lastName: '', fatherName: '' };

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: '', fatherName: '' };
  }
  if (parts.length === 2) {
    return { lastName: parts[0], firstName: parts[1], fatherName: '' };
  }

  return {
    lastName: parts[0],
    firstName: parts[1],
    fatherName: parts.slice(2).join(' '),
  };
}

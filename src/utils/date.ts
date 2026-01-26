export function getLocalDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

export function getLocalDateOnly(date: Date): Date {
  const key = getLocalDateKey(date);
  return new Date(`${key}T00:00:00.000Z`);
}

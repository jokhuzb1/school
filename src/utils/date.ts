export function getLocalDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

export function getLocalDateOnly(date: Date): Date {
  const key = getLocalDateKey(date);
  return new Date(`${key}T00:00:00.000Z`);
}

export function getDateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

export function dateKeyToUtcDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDaysUtc(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getDateOnlyInZone(date: Date, timeZone: string): Date {
  const key = getDateKeyInZone(date, timeZone);
  return dateKeyToUtcDate(key);
}

export function getTimePartsInZone(
  date: Date,
  timeZone: string,
): { hours: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(date);
  const hours = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minutes = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return { hours, minutes };
}

// Vaqt filterlari uchun date range hisoblash
export type DateRangeType = 'today' | 'yesterday' | 'week' | 'month' | 'year' | 'custom';

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export function getDateRange(
  type: DateRangeType, 
  customStart?: string, 
  customEnd?: string
): DateRange {
  const now = new Date();
  const today = getLocalDateOnly(now);
  
  switch (type) {
    case 'today':
      return {
        startDate: today,
        endDate: today,
        label: 'Bugun',
      };
    
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: yesterday,
        endDate: yesterday,
        label: 'Kecha',
      };
    }
    
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 6);
      return {
        startDate: weekStart,
        endDate: today,
        label: 'Oxirgi 7 kun',
      };
    }
    
    case 'month': {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: getLocalDateOnly(monthStart),
        endDate: today,
        label: 'Shu oy',
      };
    }
    
    case 'year': {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return {
        startDate: getLocalDateOnly(yearStart),
        endDate: today,
        label: 'Shu yil',
      };
    }
    
    case 'custom': {
      if (customStart && customEnd) {
        return {
          startDate: getLocalDateOnly(new Date(customStart)),
          endDate: getLocalDateOnly(new Date(customEnd)),
          label: `${customStart} - ${customEnd}`,
        };
      }
      // Default to today if custom dates not provided
      return {
        startDate: today,
        endDate: today,
        label: 'Bugun',
      };
    }
    
    default:
      return {
        startDate: today,
        endDate: today,
        label: 'Bugun',
      };
  }
}

export function getDateRangeInZone(
  type: DateRangeType,
  timeZone: string,
  customStart?: string,
  customEnd?: string,
): DateRange {
  const now = new Date();
  const todayKey = getDateKeyInZone(now, timeZone);
  const today = dateKeyToUtcDate(todayKey);

  switch (type) {
    case 'today':
      return { startDate: today, endDate: today, label: 'Bugun' };

    case 'yesterday': {
      const yesterday = addDaysUtc(today, -1);
      return { startDate: yesterday, endDate: yesterday, label: 'Kecha' };
    }

    case 'week': {
      const weekStart = addDaysUtc(today, -6);
      return { startDate: weekStart, endDate: today, label: 'Oxirgi 7 kun' };
    }

    case 'month': {
      const [year, month] = todayKey.split("-").map(Number);
      const monthStart = new Date(Date.UTC(year, month - 1, 1));
      return { startDate: monthStart, endDate: today, label: 'Shu oy' };
    }

    case 'year': {
      const [year] = todayKey.split("-").map(Number);
      const yearStart = new Date(Date.UTC(year, 0, 1));
      return { startDate: yearStart, endDate: today, label: 'Shu yil' };
    }

    case 'custom': {
      if (customStart && customEnd) {
        return {
          startDate: dateKeyToUtcDate(customStart),
          endDate: dateKeyToUtcDate(customEnd),
          label: `${customStart} - ${customEnd}`,
        };
      }
      return { startDate: today, endDate: today, label: 'Bugun' };
    }

    default:
      return { startDate: today, endDate: today, label: 'Bugun' };
  }
}

// Vaqt oralig'idagi kunlar sonini hisoblash
export function getDaysInRange(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

// Vaqt oralig'idagi barcha kunlarni olish
export function getDatesInRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * "HH:mm" formatidagi vaqtga daqiqalar qo'shadi va "HH:mm" formatida qaytaradi.
 */
export function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

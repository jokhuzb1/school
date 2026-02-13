import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { PeriodType } from "@shared/types";

export type PresetPeriod = Exclude<PeriodType, "custom">;
export type DayRange = [Dayjs, Dayjs];

export const PRESET_PERIOD_OPTIONS: Array<{
  label: string;
  value: PresetPeriod;
}> = [
  { label: "Bugun", value: "today" },
  { label: "Kecha", value: "yesterday" },
  { label: "Oxirgi 7 kun", value: "week" },
  { label: "Shu oy", value: "month" },
  { label: "Shu yil", value: "year" },
];

function normalizeDay(date: Dayjs): Dayjs {
  return date.startOf("day");
}

export function normalizeDayRange(range: DayRange): DayRange {
  return [normalizeDay(range[0]), normalizeDay(range[1])];
}

export function getRangeForPeriod(
  period: PresetPeriod,
  baseDate: Dayjs = dayjs(),
): DayRange {
  const today = baseDate.startOf("day");

  if (period === "today") return [today, today];
  if (period === "yesterday") {
    const yesterday = today.subtract(1, "day");
    return [yesterday, yesterday];
  }
  if (period === "week") return [today.subtract(6, "day"), today];
  if (period === "month") return [today.startOf("month"), today];
  return [today.startOf("year"), today];
}

export function isSameDayRange(left: DayRange, right: DayRange): boolean {
  return (
    left[0].isSame(right[0], "day") &&
    left[1].isSame(right[1], "day")
  );
}

export function detectPeriodFromRange(
  range: DayRange,
  baseDate: Dayjs = dayjs(),
): PeriodType {
  const normalized = normalizeDayRange(range);

  for (const option of PRESET_PERIOD_OPTIONS) {
    const presetRange = getRangeForPeriod(option.value, baseDate);
    if (isSameDayRange(normalized, presetRange)) {
      return option.value;
    }
  }

  return "custom";
}

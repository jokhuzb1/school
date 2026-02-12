import type { PeriodType } from "@shared/types";

export const PERIOD_OPTIONS: Array<{ label: string; value: PeriodType }> = [
  { label: "Bugun", value: "today" },
  { label: "Kecha", value: "yesterday" },
  { label: "Hafta", value: "week" },
  { label: "Oy", value: "month" },
  { label: "Yil", value: "year" },
];

export const PERIOD_OPTIONS_WITH_CUSTOM: Array<{
  label: string;
  value: PeriodType;
}> = [...PERIOD_OPTIONS, { label: "Tanlash", value: "custom" }];

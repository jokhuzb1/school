import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { PeriodType } from "../../types";

export function isWithinPeriod(params: {
  date: string | Date | Dayjs;
  period: PeriodType;
  customRange?: [Dayjs, Dayjs] | null;
}): boolean {
  const { date, period, customRange } = params;
  const recordDate = dayjs(date);
  const today = dayjs().startOf("day");

  if (period === "today") return recordDate.isSame(today, "day");
  if (period === "yesterday")
    return recordDate.isSame(today.subtract(1, "day"), "day");
  if (period === "week") return recordDate.isAfter(today.subtract(7, "day"));
  if (period === "month") return recordDate.isSame(today, "month");
  if (period === "year") return recordDate.isSame(today, "year");
  if (period === "custom" && customRange) {
    return (
      recordDate.isAfter(customRange[0].subtract(1, "day")) &&
      recordDate.isBefore(customRange[1].add(1, "day"))
    );
  }

  return true;
}

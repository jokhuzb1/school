import React, { useMemo } from "react";
import { DatePicker, Segmented } from "antd";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import type { PeriodType } from "@shared/types";
import {
  PRESET_PERIOD_OPTIONS,
  detectPeriodFromRange,
  getRangeForPeriod,
  normalizeDayRange,
} from "../utils/periodRanges";

const { RangePicker } = DatePicker;

type DayRange = [Dayjs, Dayjs];

export interface PeriodDateFilterValue {
  period: PeriodType;
  customRange: DayRange | null;
}

interface PeriodDateFilterProps {
  value: PeriodDateFilterValue;
  onChange: (next: PeriodDateFilterValue) => void;
  size?: "small" | "middle" | "large";
  style?: React.CSSProperties;
  defaultPeriodOnClear?: Exclude<PeriodType, "custom">;
}

export function PeriodDateFilter({
  value,
  onChange,
  size = "middle",
  style,
  defaultPeriodOnClear = "today",
}: PeriodDateFilterProps) {
  const todayKey = dayjs().format("YYYY-MM-DD");
  const baseDate = useMemo(() => dayjs(todayKey), [todayKey]);

  const pickerValue = useMemo<DayRange>(() => {
    if (value.period === "custom" && value.customRange) {
      return normalizeDayRange(value.customRange);
    }
    if (value.period !== "custom") {
      return getRangeForPeriod(value.period, baseDate);
    }
    return getRangeForPeriod(defaultPeriodOnClear, baseDate);
  }, [
    value.period,
    value.customRange,
    baseDate,
    defaultPeriodOnClear,
  ]);

  const presets = useMemo(
    () =>
      PRESET_PERIOD_OPTIONS.map((option) => ({
        label: option.label,
        value: getRangeForPeriod(option.value, baseDate),
      })),
    [baseDate],
  );

  const segmentedValue = value.period === "custom" ? undefined : value.period;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <Segmented
        size={size}
        value={segmentedValue}
        options={PRESET_PERIOD_OPTIONS}
        onChange={(next) => {
          onChange({
            period: next as PeriodType,
            customRange: null,
          });
        }}
      />
      <RangePicker
        size={size}
        value={pickerValue}
        presets={presets}
        format="DD.MM.YYYY"
        style={style}
        onChange={(dates) => {
          if (!dates || !dates[0] || !dates[1]) {
            onChange({
              period: defaultPeriodOnClear,
              customRange: null,
            });
            return;
          }

          const normalized = normalizeDayRange([dates[0], dates[1]]);
          const detected = detectPeriodFromRange(normalized, baseDate);

          if (detected === "custom") {
            onChange({ period: "custom", customRange: normalized });
            return;
          }

          onChange({ period: detected, customRange: null });
        }}
      />
    </div>
  );
}

export default PeriodDateFilter;

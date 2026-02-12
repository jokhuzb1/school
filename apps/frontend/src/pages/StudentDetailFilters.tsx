import React from "react";
import { Badge, Select, Tag } from "antd";
import dayjs from "dayjs";
import { PeriodDateFilter } from "../shared/ui";
import type { AttendanceStatus, PeriodType } from "@shared/types";
import { ATTENDANCE_STATUS_OPTIONS, EFFECTIVE_STATUS_COLORS } from "../entities/attendance";

type StudentDetailFiltersProps = {
  selectedPeriod: PeriodType;
  customDateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  setSelectedPeriod: (period: PeriodType) => void;
  setCustomDateRange: (range: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
  statusFilter: AttendanceStatus | undefined;
  setStatusFilter: (status: AttendanceStatus | undefined) => void;
  filteredCount: number;
};

export const StudentDetailFilters: React.FC<StudentDetailFiltersProps> = ({
  selectedPeriod,
  customDateRange,
  setSelectedPeriod,
  setCustomDateRange,
  statusFilter,
  setStatusFilter,
  filteredCount,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
      marginBottom: 16,
      padding: "0 4px",
    }}
  >
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#fff",
        padding: "4px 8px",
        borderRadius: 8,
        border: "1px solid #f0f0f0",
      }}
    >
      <PeriodDateFilter
        size="middle"
        defaultPeriodOnClear="month"
        style={{ width: 250, borderRadius: 8 }}
        value={{ period: selectedPeriod, customRange: customDateRange }}
        onChange={({ period, customRange }) => {
          setSelectedPeriod(period);
          setCustomDateRange(customRange);
        }}
      />
    </div>

    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: "#fff",
        padding: "4px 12px",
        borderRadius: 8,
        border: "1px solid #f0f0f0",
      }}
    >
      <Badge status={statusFilter ? (EFFECTIVE_STATUS_COLORS[statusFilter] as any) : "default"} />
      <Select
        placeholder="Barcha holatlar"
        value={statusFilter}
        onChange={(value) => setStatusFilter(value)}
        style={{ width: 150 }}
        allowClear
        variant="borderless"
        options={ATTENDANCE_STATUS_OPTIONS}
      />
    </div>

    <div style={{ marginLeft: "auto" }}>
      <Tag color="success" bordered={false} style={{ borderRadius: 4 }}>
        Jami: {filteredCount} yozuv
      </Tag>
    </div>
  </div>
);

import React from "react";
import { Select, Segmented, Tag, Typography } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { AttendanceScope, Class, DashboardStats, PeriodType } from "@shared/types";
import { PeriodDateFilter } from "../shared/ui";

const { Text } = Typography;

type DashboardFiltersProps = {
  selectedPeriod: PeriodType;
  customDateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  setSelectedPeriod: (period: PeriodType) => void;
  setCustomDateRange: (range: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
  isToday: boolean;
  attendanceScope: AttendanceScope;
  setAttendanceScope: (scope: AttendanceScope) => void;
  selectedClassId: string | undefined;
  setSelectedClassId: (classId: string | undefined) => void;
  classes: Class[];
  stats: DashboardStats;
};

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  selectedPeriod,
  customDateRange,
  setSelectedPeriod,
  setCustomDateRange,
  isToday,
  attendanceScope,
  setAttendanceScope,
  selectedClassId,
  setSelectedClassId,
  classes,
  stats,
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
    <PeriodDateFilter
      size="middle"
      style={{ width: 250, borderRadius: 8 }}
      value={{ period: selectedPeriod, customRange: customDateRange }}
      onChange={({ period, customRange }) => {
        setSelectedPeriod(period);
        setCustomDateRange(customRange);
      }}
    />

    {isToday && (
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
        <Text type="secondary" style={{ fontSize: 12 }}>
          Ko'rinish:
        </Text>
        <Segmented
          size="middle"
          value={attendanceScope}
          onChange={(value) => setAttendanceScope(value as AttendanceScope)}
          options={[
            { label: "Boshlangan", value: "started" },
            { label: "Faol", value: "active" },
          ]}
          style={{ background: "transparent" }}
        />
      </div>
    )}

    <div style={{ width: 1, height: 20, background: "#e8e8e8", margin: "0 4px" }} />

    <Select
      placeholder="Barcha sinflar"
      allowClear
      style={{ width: 160 }}
      value={selectedClassId}
      onChange={(value) => setSelectedClassId(value)}
      options={classes.map((c) => ({ value: c.id, label: c.name }))}
      size="middle"
      suffixIcon={<TeamOutlined />}
    />

    {stats?.periodLabel && selectedPeriod !== "today" && (
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <Tag color="blue" bordered={false} style={{ borderRadius: 4, padding: "2px 8px" }}>
          {stats.periodLabel}
        </Tag>
        {stats.daysCount && stats.daysCount > 1 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            ({stats.daysCount} kunlik ma'lumot)
          </Text>
        )}
      </div>
    )}
  </div>
);

import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DownloadOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Button, Input, Select } from "antd";
import type { PeriodType } from "@shared/types";
import dayjs from "dayjs";
import { PeriodDateFilter, StatGroup, StatItem } from "../shared/ui";
import { STATUS_COLORS, EFFECTIVE_STATUS_OPTIONS } from "../entities/attendance";
import { getRangeForPeriod } from "../shared/utils/periodRanges";

type Stats = {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

type Props = {
  stats: Stats;
  selectedPeriod: PeriodType;
  customDateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  setSelectedPeriod: (p: PeriodType) => void;
  setCustomDateRange: (range: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
  setDateRange: (range: [dayjs.Dayjs, dayjs.Dayjs]) => void;
  searchText: string;
  setSearchText: (value: string) => void;
  classFilter?: string;
  setClassFilter: (value: string | undefined) => void;
  statusFilter?: string;
  setStatusFilter: (value: string | undefined) => void;
  classOptions: Array<{ label: string; value: string }>;
  onExport: () => void;
  isSchoolAdmin: boolean;
  selectedCount: number;
  bulkLoading: boolean;
  onBulkExcuse: () => void;
};

export function AttendanceFiltersBar(props: Props) {
  const {
    stats,
    selectedPeriod,
    customDateRange,
    setSelectedPeriod,
    setCustomDateRange,
    setDateRange,
    searchText,
    setSearchText,
    classFilter,
    setClassFilter,
    statusFilter,
    setStatusFilter,
    classOptions,
    onExport,
    isSchoolAdmin,
    selectedCount,
    bulkLoading,
    onBulkExcuse,
  } = props;

  return (
    <>
      <StatGroup>
        <StatItem icon={<TeamOutlined />} label="Jami" value={stats.total} color="#1890ff" />
        <StatItem icon={<CheckCircleOutlined />} label="Kelgan" value={stats.present} color={STATUS_COLORS.PRESENT} />
        <StatItem icon={<ClockCircleOutlined />} label="Kech qoldi" value={stats.late} color={STATUS_COLORS.LATE} />
        <StatItem icon={<CloseCircleOutlined />} label="Yo'q" value={stats.absent} color={STATUS_COLORS.ABSENT} />
        {stats.excused > 0 && (
          <StatItem icon={<CalendarOutlined />} label="Sababli" value={stats.excused} color={STATUS_COLORS.EXCUSED} />
        )}
      </StatGroup>

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
            if (period === "custom" && customRange) {
              setDateRange(customRange);
              return;
            }
            if (period !== "custom") {
              setDateRange(getRangeForPeriod(period));
            }
          }}
        />

        <div style={{ width: 1, height: 20, background: "#e8e8e8", margin: "0 4px" }} />

        <Input
          placeholder="O'quvchi nomi..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 180, borderRadius: 8 }}
          allowClear
        />

        <Select
          placeholder="Sinf"
          value={classFilter}
          onChange={setClassFilter}
          style={{ width: 120 }}
          allowClear
          options={classOptions}
          suffixIcon={<TeamOutlined />}
        />

        <Select
          placeholder="Holat"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 120 }}
          allowClear
          options={EFFECTIVE_STATUS_OPTIONS}
        />

        <Button icon={<DownloadOutlined />} onClick={onExport} style={{ borderRadius: 8 }}>
          Eksport
        </Button>

        {isSchoolAdmin && selectedCount > 0 && (
          <Button type="primary" loading={bulkLoading} style={{ borderRadius: 8 }} onClick={onBulkExcuse}>
            {selectedCount} tani Sababli qilish
          </Button>
        )}
      </div>
    </>
  );
}

import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Button, Input, Select, Tag } from "antd";
import type { PeriodType, Class } from "@shared/types";
import dayjs from "dayjs";
import { Divider, PageHeader, PeriodDateFilter, StatItem } from "../shared/ui";
import { EFFECTIVE_STATUS_META, STATUS_COLORS } from "../entities/attendance";
import { StudentImportControls } from "./StudentImportControls";

type Stats = {
  total: number;
  present: number;
  late: number;
  absent: number;
  pendingEarly?: number;
  pendingLate?: number;
};

type Props = {
  selectedPeriod: PeriodType;
  customDateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  setSelectedPeriod: (value: PeriodType) => void;
  setCustomDateRange: (value: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
  setPage: (value: number) => void;
  periodLabel?: string;
  stats: Stats;
  isSingleDay: boolean;
  searchInput: string;
  setSearchInput: (v: string) => void;
  onSearchDebounced: (v: string) => void;
  classFilter?: string;
  setClassFilter: (v: string | undefined) => void;
  classes: Class[];
  canCreateStudent: boolean;
  onAdd: () => void;
  allowCreateMissingClass: boolean;
  setAllowCreateMissingClass: (value: boolean) => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDownloadTemplate: () => Promise<void>;
  onExport: () => Promise<void>;
};

export function StudentsHeader(props: Props) {
  const {
    selectedPeriod,
    customDateRange,
    setSelectedPeriod,
    setCustomDateRange,
    setPage,
    periodLabel,
    stats,
    isSingleDay,
    searchInput,
    setSearchInput,
    onSearchDebounced,
    classFilter,
    setClassFilter,
    classes,
    canCreateStudent,
    onAdd,
    allowCreateMissingClass,
    setAllowCreateMissingClass,
    onImport,
    onDownloadTemplate,
    onExport,
  } = props;

  return (
    <PageHeader>
      <PeriodDateFilter
        size="small"
        style={{ width: 230 }}
        value={{ period: selectedPeriod, customRange: customDateRange }}
        onChange={({ period, customRange }) => {
          setSelectedPeriod(period);
          setCustomDateRange(customRange);
          setPage(1);
        }}
      />
      {periodLabel && selectedPeriod !== "today" && <Tag color="blue">{periodLabel}</Tag>}
      <Divider />
      <StatItem icon={<TeamOutlined />} value={stats.total} label="jami" color="#1890ff" tooltip="Jami o'quvchilar" />
      <Divider />
      <StatItem icon={<CheckCircleOutlined />} value={stats.present} label={isSingleDay ? "kelgan" : "kelgan (jami)"} color={STATUS_COLORS.PRESENT} />
      <StatItem icon={<ClockCircleOutlined />} value={stats.late} label={isSingleDay ? "kech qoldi" : "kech (jami)"} color={STATUS_COLORS.LATE} />
      <StatItem icon={<CloseCircleOutlined />} value={stats.absent} label={isSingleDay ? "kelmadi" : "yo'q (jami)"} color={STATUS_COLORS.ABSENT} />
      {isSingleDay && (stats.pendingLate || 0) > 0 && (
        <StatItem icon={<ClockCircleOutlined />} value={stats.pendingLate || 0} label="kechikmoqda" color={EFFECTIVE_STATUS_META.PENDING_LATE.color} />
      )}
      {isSingleDay && (stats.pendingEarly || 0) > 0 && (
        <StatItem icon={<CloseCircleOutlined />} value={stats.pendingEarly || 0} label="hali kelmagan" color={EFFECTIVE_STATUS_META.PENDING_EARLY.color} />
      )}
      <Divider />
      <Input
        placeholder="Qidirish..."
        prefix={<SearchOutlined />}
        value={searchInput}
        onChange={(e) => {
          const value = e.target.value;
          setSearchInput(value);
          onSearchDebounced(value);
        }}
        style={{ width: 160 }}
        allowClear
        size="small"
      />
      <Select
        placeholder="Sinf"
        value={classFilter}
        onChange={setClassFilter}
        style={{ width: 100 }}
        allowClear
        size="small"
        options={classes.map((c) => ({ label: c.name, value: c.id }))}
      />
      {canCreateStudent && (
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={onAdd}>
          Qo'shish
        </Button>
      )}
      <StudentImportControls
        allowCreateMissingClass={allowCreateMissingClass}
        setAllowCreateMissingClass={setAllowCreateMissingClass}
        onImport={onImport}
        onDownloadTemplate={onDownloadTemplate}
        onExport={onExport}
      />
    </PageHeader>
  );
}

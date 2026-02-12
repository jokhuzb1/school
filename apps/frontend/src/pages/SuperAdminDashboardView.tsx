import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  LoginOutlined,
  LogoutOutlined,
  SyncOutlined,
  TeamOutlined,
  WarningOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import { Badge, Card, Empty, List, Popover, Segmented, Table, Tag, Typography } from "antd";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, PeriodDateFilter, StatGroup, StatItem } from "../shared/ui";
import { EFFECTIVE_STATUS_META, STATUS_COLORS } from "../entities/attendance";
import dayjs from "dayjs";
import type { AttendanceScope, PeriodType } from "@shared/types";
import type { ColumnsType } from "antd/es/table";
import type { RealtimeEvent, SchoolStats } from "./superAdminTypes";

const { Text } = Typography;

type Totals = {
  totalSchools: number;
  totalStudents: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  excusedToday?: number;
  pendingEarlyCount?: number;
  latePendingCount?: number;
  currentlyInSchool: number;
  attendancePercent: number;
};

type Props = {
  totals: Totals;
  sortedSchools: SchoolStats[];
  weeklyStats: { date: string; dayName: string; present: number; late: number; absent: number }[];
  realtimeEvents: RealtimeEvent[];
  problemSchools: SchoolStats[];
  isConnected: boolean;
  isToday: boolean;
  selectedPeriod: PeriodType;
  customDateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  attendanceScope: AttendanceScope;
  columns: ColumnsType<SchoolStats>;
  onPeriodChange: (period: PeriodType, customRange: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
  onScopeChange: (scope: AttendanceScope) => void;
  onOpenSchool: (schoolId: string, schoolName?: string) => void;
};

export function SuperAdminDashboardView(props: Props) {
  const {
    totals,
    sortedSchools,
    weeklyStats,
    realtimeEvents,
    problemSchools,
    isConnected,
    isToday,
    selectedPeriod,
    customDateRange,
    attendanceScope,
    columns,
    onPeriodChange,
    onScopeChange,
    onOpenSchool,
  } = props;

  return (
    <div>
      <PageHeader>
        <StatGroup>
          <StatItem icon={<BankOutlined />} label="maktab" value={totals.totalSchools} color="#722ed1" tooltip="Jami maktablar" />
          <StatItem icon={<TeamOutlined />} label="o'quvchi" value={totals.totalStudents} color="#1890ff" tooltip="Jami o'quvchilar" />
          <StatItem icon={<CheckCircleOutlined />} label="kelgan %" value={`${totals.attendancePercent}%`} color={STATUS_COLORS.PRESENT} tooltip="Kelganlar foizi" />
          <StatItem icon={<CheckCircleOutlined />} label="kelgan" value={totals.presentToday} color={STATUS_COLORS.PRESENT} tooltip="Kelganlar" />
          <StatItem icon={<ClockCircleOutlined />} label="kech qoldi" value={totals.lateToday} color={STATUS_COLORS.LATE} tooltip="Kech qoldi (scan bilan)" />
          <StatItem icon={<CloseCircleOutlined />} label="kelmadi" value={totals.absentToday} color={STATUS_COLORS.ABSENT} tooltip="Kelmadi" />
          {(totals.excusedToday || 0) > 0 && (
            <StatItem icon={<FileTextOutlined />} label="sababli" value={totals.excusedToday || 0} color={STATUS_COLORS.EXCUSED} tooltip="Sababli" />
          )}
          {(totals.latePendingCount || 0) > 0 && (
            <StatItem icon={<ClockCircleOutlined />} label="kechikmoqda" value={totals.latePendingCount || 0} color={EFFECTIVE_STATUS_META.PENDING_LATE.color} tooltip="Dars boshlangan, cutoff o'tmagan" />
          )}
          {(totals.pendingEarlyCount || 0) > 0 && (
            <StatItem icon={<CloseCircleOutlined />} label="hali kelmagan" value={totals.pendingEarlyCount || 0} color={EFFECTIVE_STATUS_META.PENDING_EARLY.color} tooltip="Dars hali boshlanmagan" />
          )}
          {problemSchools.length > 0 && (
            <StatItem icon={<WarningOutlined />} label="muammo" value={problemSchools.length} color={STATUS_COLORS.ABSENT} tooltip="Muammoli maktablar" highlight onClick={() => {}} />
          )}
        </StatGroup>
      </PageHeader>

      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <PeriodDateFilter
          size="middle"
          style={{ width: 250, borderRadius: 8 }}
          value={{ period: selectedPeriod, customRange: customDateRange }}
          onChange={({ period, customRange }) => onPeriodChange(period, customRange)}
        />

        {isToday && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", padding: "4px 8px", borderRadius: 8, border: "1px solid #f0f0f0" }}>
            <Text type="secondary" style={{ fontSize: 12 }}>Ko'rinish:</Text>
            <Segmented
              size="middle"
              value={attendanceScope}
              onChange={(value) => onScopeChange(value as AttendanceScope)}
              options={[{ label: "Boshlangan", value: "started" }, { label: "Faol", value: "active" }]}
              style={{ background: "transparent" }}
            />
          </div>
        )}

        {problemSchools.length > 0 && (
          <div style={{ marginLeft: "auto" }}>
            <Popover
              title={<span style={{ color: STATUS_COLORS.ABSENT }}><WarningOutlined /> Muammoli maktablar ({problemSchools.length})</span>}
              content={
                <div style={{ maxWidth: 280 }}>
                  <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                    Davomat 80% dan past bo'lgan maktablar:
                  </Text>
                  {problemSchools.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => onOpenSchool(s.id, s.name)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", marginBottom: 4, background: "#fff2f0", borderRadius: 4, cursor: "pointer", borderLeft: `3px solid ${STATUS_COLORS.ABSENT}` }}
                    >
                      <Text style={{ fontSize: 12 }}>{s.name}</Text>
                      <Tag color="error" style={{ margin: 0 }}>{s.attendancePercent}%</Tag>
                    </div>
                  ))}
                </div>
              }
              trigger="hover"
              placement="bottomRight"
            >
              <Tag color="error" style={{ cursor: "pointer", padding: "4px 12px", borderRadius: 6 }}>
                <WarningOutlined /> {problemSchools.length} ta muammoli maktab
              </Tag>
            </Popover>
          </div>
        )}
      </div>

      <Card title="Maktablar reytingi" size="small" style={{ marginBottom: 12 }}>
        <Table
          dataSource={sortedSchools}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          onRow={(record) => ({ onClick: () => onOpenSchool(record.id, record.name), style: { cursor: "pointer" } })}
        />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 12 }}>
        <Card title="Haftalik trend" size="small" styles={{ body: { height: 200 } }}>
          {weeklyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="present" stroke={STATUS_COLORS.PRESENT} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kelgan" />
                <Line type="monotone" dataKey="late" stroke={STATUS_COLORS.LATE} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kech qoldi" />
                <Line type="monotone" dataKey="absent" stroke={STATUS_COLORS.ABSENT} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kelmadi" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="Ma'lumot yo'q" />
          )}
        </Card>

        <Card
          title={<div style={{ display: "flex", alignItems: "center", gap: 8 }}>{isConnected && <Badge count={realtimeEvents.length} style={{ backgroundColor: STATUS_COLORS.PRESENT }} overflowCount={99} />}</div>}
          size="small"
          styles={{ body: { height: 200, overflow: "auto", padding: 0 } }}
          extra={isConnected ? <Tag color="success" style={{ margin: 0 }}><SyncOutlined spin /></Tag> : <Tag color="error" style={{ margin: 0 }} />}
        >
          {realtimeEvents.length > 0 ? (
            <List
              size="small"
              dataSource={realtimeEvents}
              renderItem={(event) => (
                <List.Item
                  style={{ padding: "6px 12px", cursor: "pointer", borderLeft: `3px solid ${event.eventType === "IN" ? STATUS_COLORS.PRESENT : STATUS_COLORS.ABSENT}`, background: event.eventType === "IN" ? "#f6ffed" : "#fff2f0" }}
                  onClick={() => onOpenSchool(event.schoolId, event.schoolName)}
                >
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong style={{ fontSize: 12 }}>
                        {event.eventType === "IN" ? <LoginOutlined style={{ color: STATUS_COLORS.PRESENT, marginRight: 4 }} /> : <LogoutOutlined style={{ color: STATUS_COLORS.ABSENT, marginRight: 4 }} />}
                        {event.studentName}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>{dayjs(event.timestamp).format("HH:mm:ss")}</Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {event.schoolName || "Maktab"}
                        {event.className && ` - ${event.className}`}
                      </Text>
                      <Tag color={event.eventType === "IN" ? "success" : "error"} style={{ margin: 0, fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
                        {event.eventType === "IN" ? "KIRDI" : "CHIQDI"}
                      </Tag>
                    </div>
                  </div>
                </List.Item>
              )}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
              {isConnected ? (
                <>
                  <SyncOutlined spin style={{ fontSize: 24, color: "#1890ff" }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Eventlarni kutmoqda...</Text>
                </>
              ) : (
                <>
                  <WifiOutlined style={{ fontSize: 24, color: STATUS_COLORS.ABSENT }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Ulanish yo'q</Text>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

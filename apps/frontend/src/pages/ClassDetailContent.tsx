import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Popconfirm,
  Row,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import dayjs from "dayjs";
import { Divider, PageHeader, StatItem } from "../shared/ui";
import { getAssetUrl } from "@shared/config";
import { EFFECTIVE_STATUS_OPTIONS, STATUS_COLORS } from "../entities/attendance";
import type { Class, EffectiveAttendanceStatus, Student } from "@shared/types";

const { Text, Title } = Typography;

const STATUS_CONFIG: Record<EffectiveAttendanceStatus, { color: string; bg: string; text: string }> = {
  PRESENT: { color: "#52c41a", bg: "#f6ffed", text: "Kelgan" },
  LATE: { color: "#faad14", bg: "#fffbe6", text: "Kech qoldi" },
  ABSENT: { color: "#ff4d4f", bg: "#fff2f0", text: "Yo'q" },
  EXCUSED: { color: "#722ed1", bg: "#f9f0ff", text: "Sababli" },
  PENDING_EARLY: { color: "#8c8c8c", bg: "#fafafa", text: "Hali kelmagan" },
  PENDING_LATE: { color: "#fa8c16", bg: "#fff7e6", text: "Kechikmoqda" },
};

type Props = {
  classData: Class;
  stats: any;
  isConnected: boolean;
  dateFilter: string;
  setDateFilter: (v: string) => void;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  pieData: Array<{ name: string; value: number; color: string }>;
  recentEvents: any[];
  schoolId?: string;
  navigateToStudent: (studentId: string) => void;
  filteredStudents: Array<Student & { effectiveStatus: EffectiveAttendanceStatus }>;
  statusFilter?: string;
  setStatusFilter: (v: string | undefined) => void;
  weeklyStats: any[];
};

export function ClassDetailContent(props: Props) {
  const {
    classData,
    stats,
    isConnected,
    dateFilter,
    setDateFilter,
    onBack,
    onEdit,
    onDelete,
    pieData,
    recentEvents,
    filteredStudents,
    statusFilter,
    setStatusFilter,
    weeklyStats,
    navigateToStudent,
  } = props;

  return (
    <div>
      <PageHeader>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack} size="small">
          Orqaga
        </Button>
        <Divider />
        <Space>
          <TeamOutlined style={{ color: "#1890ff", fontSize: 18 }} />
          <Title level={4} style={{ margin: 0 }}>{classData.name}</Title>
          <Text type="secondary">({classData.gradeLevel}-sinf)</Text>
        </Space>
        <Divider />
        <Tooltip title={isConnected ? "Jonli ulangan" : "Oflayn"}>
          <Badge status={isConnected ? "success" : "error"} />
        </Tooltip>
        <Divider />
        <StatItem icon={<UserOutlined />} value={stats.total} label="o'quvchi" color="#1890ff" />
        <StatItem icon={<CheckCircleOutlined />} value={stats.present} label="kelgan" color={STATUS_COLORS.PRESENT} />
        <StatItem icon={<ClockCircleOutlined />} value={stats.late} label="kech" color={STATUS_COLORS.LATE} />
        <StatItem icon={<CloseCircleOutlined />} value={stats.absent} label="yo'q" color={STATUS_COLORS.ABSENT} />
        <Divider />
        <Select
          value={dateFilter}
          onChange={setDateFilter}
          style={{ width: 130 }}
          size="small"
          options={[{ value: "today", label: "Bugun" }, { value: "yesterday", label: "Kecha" }, { value: "week", label: "Bu hafta" }, { value: "month", label: "Bu oy" }]}
        />
        <Tooltip title="Tahrirlash">
          <Button size="small" icon={<EditOutlined />} onClick={onEdit} />
        </Tooltip>
        <Popconfirm title="Sinfni o'chirish?" description="Barcha ma'lumotlar o'chiriladi!" onConfirm={onDelete} okText="Ha" cancelText="Yo'q">
          <Tooltip title="O'chirish">
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Tooltip>
        </Popconfirm>
      </PageHeader>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={8}>
          <Card title={<Space><CalendarOutlined /><span>Bugungi davomat</span></Space>} size="small" styles={{ body: { height: 280 } }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
            <div style={{ padding: 12, background: "#fafafa", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Dars boshlanishi:</Text>
                <Text strong>{classData.startTime || "-"}</Text>
              </div>
              {classData.endTime && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <Text type="secondary">Dars tugashi:</Text>
                  <Text strong>{classData.endTime}</Text>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={8}>
          <Card title="Oxirgi faoliyat" size="small" styles={{ body: { height: 280, overflowY: "auto", padding: "8px 12px" } }}>
            {recentEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {recentEvents.map((event) => {
                  const eventType = event.eventType === "IN" ? "IN" : "OUT";
                  const isIn = eventType === "IN";
                  const bg = isIn ? "#f6ffed" : "#fff2f0";
                  const color = isIn ? STATUS_COLORS.PRESENT : STATUS_COLORS.ABSENT;
                  return (
                    <div
                      key={event.id}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: bg, borderRadius: 4, borderLeft: `3px solid ${color}`, cursor: "pointer" }}
                      onClick={() => navigateToStudent(event.student.id)}
                    >
                      <Avatar src={getAssetUrl(event.student.photoUrl)} icon={<UserOutlined />} size="small" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 12 }} ellipsis>{event.student.name}</Text>
                      </div>
                      <Tag color={isIn ? "success" : "error"} style={{ margin: 0, fontSize: 10 }}>
                        {dayjs(event.timestamp).format("HH:mm")}
                      </Tag>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Empty description="Faoliyat yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={`O'quvchilar (${filteredStudents.length})`}
            size="small"
            styles={{ body: { height: 280, overflowY: "auto", padding: "8px 12px" } }}
            extra={
              <Select
                placeholder="Holat"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                allowClear
                size="small"
                options={EFFECTIVE_STATUS_OPTIONS.filter((opt) => {
                  if (opt.value === "ABSENT") return stats.absent > 0;
                  if (opt.value === "PENDING_LATE") return stats.pendingLate > 0;
                  if (opt.value === "PENDING_EARLY") return stats.pendingEarly > 0;
                  return true;
                })}
              />
            }
          >
            {filteredStudents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredStudents.map((student) => {
                  const config = STATUS_CONFIG[student.effectiveStatus];
                  const time = student.todayFirstScan ? dayjs(student.todayFirstScan).format("HH:mm") : null;
                  return (
                    <div
                      key={student.id}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 8px", background: config.bg, borderRadius: 4, borderLeft: `3px solid ${config.color}`, cursor: "pointer" }}
                      onClick={() => navigateToStudent(student.id)}
                    >
                      <Avatar src={getAssetUrl(student.photoUrl)} icon={<UserOutlined />} size="small" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 12 }} ellipsis>{student.name}</Text>
                      </div>
                      {time && <Tag color="default" style={{ margin: 0, fontSize: 10 }}>{time}</Tag>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Empty description="O'quvchi yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card title="Haftalik davomat" size="small" styles={{ body: { height: 200 } }}>
            {weeklyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Line type="monotone" dataKey="present" stroke={STATUS_COLORS.PRESENT} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kelgan" />
                  <Line type="monotone" dataKey="late" stroke={STATUS_COLORS.LATE} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kech qoldi" />
                  <Line type="monotone" dataKey="absent" stroke={STATUS_COLORS.ABSENT} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kelmadi" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

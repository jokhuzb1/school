import React, { useEffect, useState, useCallback } from "react";
import {
  Card,
  Row,
  Col,
  Avatar,
  Typography,
  Table,
  Tag,
  Badge,
  Spin,
  Empty,
  Tooltip,
  DatePicker,
  Select,
  Space,
  Modal,
  Button,
  Calendar,
} from "antd";
import {
  UserOutlined,
  LoginOutlined,
  LogoutOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useParams } from "react-router-dom";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { studentsService } from "../services/students";
import { getAssetUrl } from "../config";
import { useHeaderMeta } from "../shared/ui";
import type {
  Student,
  DailyAttendance,
  AttendanceStatus,
  AttendanceEvent,
  PeriodType,
  EffectiveAttendanceStatus,
} from "../types";
import dayjs, { Dayjs } from "dayjs";
import { Segmented } from "antd";
import {
  ATTENDANCE_STATUS_OPTIONS,
  EFFECTIVE_STATUS_COLORS,
  EFFECTIVE_STATUS_LABELS,
  EVENT_TYPE_BG,
  EVENT_TYPE_COLOR,
  EVENT_TYPE_TAG,
  getAttendanceStatsForStudentDetail,
  STATUS_COLORS,
} from "../entities/attendance";
import { PERIOD_OPTIONS } from "../shared/constants/periodOptions";
import { isWithinPeriod } from "../shared/utils/dateFilters";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Vaqt filterlari
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month");
  const [customDateRange, setCustomDateRange] = useState<
    [dayjs.Dayjs, dayjs.Dayjs] | null
  >(null);
  const [statusFilter, setStatusFilter] = useState<
    AttendanceStatus | undefined
  >();

  const [selectedRecord, setSelectedRecord] = useState<DailyAttendance | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);

  // Filterlangan ma'lumotlarni hisoblash
  const filteredAttendance = attendance.filter((a) => {
    const statusMatch = statusFilter ? a.status === statusFilter : true;
    const periodMatch = isWithinPeriod({
      date: a.date,
      period: selectedPeriod,
      customRange: customDateRange,
    });
    return statusMatch && periodMatch;
  });

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [studentData, attendanceData, eventsData] = await Promise.all([
        studentsService.getById(id),
        studentsService.getAttendance(id),
        studentsService.getEvents(id),
      ]);
      setStudent(studentData);
      setAttendance(attendanceData);
      setEvents(eventsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  }, [id, setLastUpdated]);

  // Eventlarni kun bo'yicha guruhlash
  const getEventsForDate = (date: string) => {
    const dateStr = dayjs(date).format("YYYY-MM-DD");
    return events.filter(
      (e) => dayjs(e.timestamp).format("YYYY-MM-DD") === dateStr,
    );
  };

  // SSE for real-time updates - filter by this student
  const { isConnected } = useAttendanceSSE(student?.schoolId || null, {
    onEvent: (event) => {
      // Only refresh if event is for this student
      if (event?.studentId === id) {
        fetchData();
      }
    },
    enabled: !!student?.schoolId,
  });

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    loadInitial();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    await fetchData();
    setLastUpdated(new Date());
  }, [fetchData, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!student) {
    return <Empty description="O'quvchi topilmadi" />;
  }

  // Calculate stats including excused and average late time
  const lateRecords = attendance.filter((a) => a.status === "LATE");
  const avgLateMinutes =
    lateRecords.length > 0
      ? Math.round(
          lateRecords.reduce((sum, a) => sum + (a.lateMinutes || 0), 0) /
            lateRecords.length,
        )
      : 0;

  const counts = getAttendanceStatsForStudentDetail(attendance);
  const stats = {
    ...counts,
    late: lateRecords.length,
    avgLateMinutes,
  };

  // Kalendar uchun
  const attendanceMap = new Map(
    attendance.map((a) => [dayjs(a.date).format("YYYY-MM-DD"), a]),
  );

  const dateCellRender = (date: Dayjs) => {
    const key = date.format("YYYY-MM-DD");
    const record = attendanceMap.get(key);
    if (!record) return null;
    return <Badge color={EFFECTIVE_STATUS_COLORS[record.status]} />;
  };

  // Haftalik data tayyorlash (oxirgi 7 kun)
  const weeklyData = Array.from({ length: 7 }).map((_, idx) => {
    const date = dayjs().subtract(6 - idx, "day");
    const dateStr = date.format("YYYY-MM-DD");
    const record = attendance.find((a) => dayjs(a.date).format("YYYY-MM-DD") === dateStr);
    
    return {
      date: dateStr,
      dayName: date.format("dd"),
      present: record && record.status === "PRESENT" ? 1 : 0,
      late: record && record.status === "LATE" ? 1 : 0,
      absent: record && record.status === "ABSENT" ? 1 : 0,
      excused: record && record.status === "EXCUSED" ? 1 : 0,
    };
  });

  // Jami maktabda bo'lgan vaqtni hisoblash

  // Vaqtni soat:daqiqa formatiga o'girish
  const formatDuration = (minutes: number) => {
    if (!minutes) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours} soat ${mins} daqiqa`;
    }
    return `${mins} daqiqa`;
  };

  const columns = [
    {
      title: "Sana",
      dataIndex: "date",
      key: "date",
      render: (d: string) => dayjs(d).format("DD MMM, YYYY"),
    },
    {
      title: "Holat",
      dataIndex: "status",
      key: "status",
      render: (s: EffectiveAttendanceStatus, record: DailyAttendance) => (
        <Space>
          <Tag color={EFFECTIVE_STATUS_COLORS[s]}>
            {EFFECTIVE_STATUS_LABELS[s]}
          </Tag>
          {record.currentlyInSchool && (
            <Tag icon={<LoginOutlined />} color="purple">
              Maktabda
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Kirdi",
      dataIndex: "firstScanTime",
      key: "arrived",
      render: (t: string) =>
        t ? (
          <>
            <LoginOutlined style={{ color: "#52c41a", marginRight: 4 }} />
            {dayjs(t).format("HH:mm")}
          </>
        ) : (
          "-"
        ),
    },
    {
      title: "Chiqdi",
      dataIndex: "lastOutTime",
      key: "left",
      render: (t: string) =>
        t ? (
          <>
            <LogoutOutlined style={{ color: "#1890ff", marginRight: 4 }} />
            {dayjs(t).format("HH:mm")}
          </>
        ) : (
          "-"
        ),
    },
    {
      title: "Maktabda",
      dataIndex: "totalTimeOnPremises",
      key: "timeInSchool",
      render: (m: number | null) =>
        m ? (
          <>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            {formatDuration(m)}
          </>
        ) : (
          "-"
        ),
    },
    {
      title: "Kechikish",
      dataIndex: "lateMinutes",
      key: "late",
      render: (m: number | null) =>
        m ? <Tag color="orange">{m} daqiqa</Tag> : "-",
    },
    {
      title: "Izoh",
      dataIndex: "notes",
      key: "notes",
      render: (n: string) => n || "-",
    },
  ];

  return (
    <div>
      {/* Kompakt Header: Student Info + Statistikalar */}
      <Card
        size="small"
        style={{
          marginBottom: 16,
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
          border: "1px solid #f0f0f0",
        }}
      >
        <Row
          gutter={16}
          align="middle"
          wrap={false}
          style={{ overflowX: "auto", padding: "4px 0" }}
        >
          {/* Avatar va Ism */}
          <Col flex="none">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                paddingLeft: 8,
              }}
            >
              <Avatar
                size={56}
                src={getAssetUrl(student.photoUrl)}
                icon={<UserOutlined />}
                style={{
                  border: "2px solid #1890ff",
                }}
              />
              <div>
                <Title level={4} style={{ margin: 0, color: "#262626" }}>
                  {student.name}
                </Title>
                <Space size={8} style={{ marginTop: 4 }}>
                  <Tag
                    color="blue"
                    bordered={false}
                    style={{ borderRadius: 4 }}
                  >
                    {student.class?.name || "Sinf yo'q"}
                  </Tag>
                  <Tooltip
                    title={isConnected ? "Jonli ulangan" : "Oflayn"}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Badge status={isConnected ? "success" : "error"} />
                    </div>
                  </Tooltip>
                </Space>
              </div>
            </div>
          </Col>

          {/* Divider */}
          <Col flex="none">
            <div
              style={{
                width: 1,
                height: 48,
                background: "#f0f0f0",
                margin: "0 12px",
              }}
            />
          </Col>

          {/* Statistikalar */}
          <Col flex="auto">
            <div
              style={{
                display: "flex",
                gap: 24,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 22, fontWeight: 700, color: "#262626" }}
                >
                  {stats.total}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Jami kun
                </Text>
              </div>

              <div style={{ width: 1, height: 24, background: "#f0f0f0" }} />

              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.PRESENT }}
                >
                  {stats.present}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Kelgan
                </Text>
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.LATE }}
                >
                  {stats.late}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Kech qoldi
                </Text>
              </div>

              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.ABSENT }}
                >
                  {stats.absent}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Kelmadi
                </Text>
              </div>

              {(stats.excused || 0) > 0 && (
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.EXCUSED }}
                  >
                    {stats.excused}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Sababli
                  </Text>
                </div>
              )}
            </div>
          </Col>

          {/* Qo'shimcha info */}
          <Col flex="none" style={{ paddingRight: 8 }}>
            <Tooltip
              title={`ID: ${student.deviceStudentId || "-"} | Ota-onasi: ${student.parentName || "-"} (${student.parentPhone || "-"})`}
            >
              <Button
                type="default"
                shape="circle"
                icon={<ExclamationCircleOutlined />}
              />
            </Tooltip>
          </Col>
        </Row>
      </Card>

      {/* Filterlar satri */}
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
          <CalendarOutlined style={{ color: "#8c8c8c" }} />
          <Segmented
            size="middle"
            value={selectedPeriod}
            onChange={(value) => {
              setSelectedPeriod(value as PeriodType);
              if (value !== "custom") setCustomDateRange(null);
            }}
            options={PERIOD_OPTIONS}
            style={{ background: "transparent" }}
          />
        </div>

        {/* Custom date range picker */}
        {(selectedPeriod === "custom" || customDateRange) && (
          <RangePicker
            size="middle"
            value={customDateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setCustomDateRange([dates[0], dates[1]]);
                setSelectedPeriod("custom");
              } else {
                setCustomDateRange(null);
                setSelectedPeriod("month");
              }
            }}
            format="DD.MM.YYYY"
            style={{ width: 240, borderRadius: 8 }}
          />
        )}

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
          <Badge
            status={
              statusFilter
                ? (EFFECTIVE_STATUS_COLORS[statusFilter] as any)
                : "default"
            }
          />
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
            Jami: {filteredAttendance.length} yozuv
          </Tag>
        </div>
      </div>

      {/* Chart va Loglar - Tablet/Desktop yonma-yon */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {/* Pie Chart */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="Davomat taqsimoti"
            size="small"
            styles={{ body: { height: 240 } }}
          >
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Kelgan",
                        value: stats.present,
                        color: STATUS_COLORS.PRESENT,
                      },
                      {
                        name: "Kech qoldi",
                        value: stats.late,
                        color: STATUS_COLORS.LATE,
                      },
                      {
                        name: "Kelmadi",
                        value: stats.absent,
                        color: STATUS_COLORS.ABSENT,
                      },
                      {
                        name: "Sababli",
                        value: stats.excused,
                        color: STATUS_COLORS.EXCUSED,
                      },
                    ].filter((d) => d.value > 0)}
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      {
                        name: "Kelgan",
                        value: stats.present,
                        color: STATUS_COLORS.PRESENT,
                      },
                      {
                        name: "Kech qoldi",
                        value: stats.late,
                        color: STATUS_COLORS.LATE,
                      },
                      {
                        name: "Kelmadi",
                        value: stats.absent,
                        color: STATUS_COLORS.ABSENT,
                      },
                      {
                        name: "Sababli",
                        value: stats.excused,
                        color: STATUS_COLORS.EXCUSED,
                      },
                    ]
                      .filter((d) => d.value > 0)
                      .map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Empty
                  description="Ma'lumot yo'q"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Card>
        </Col>

        {/* Oxirgi Kirdi-Chiqdilar */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="Oxirgi faoliyat"
            size="small"
            styles={{ body: { height: 240, overflowY: "auto" } }}
          >
            {events.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {events.slice(0, 8).map((event) => {
                  const isIn = event.eventType === "IN";
                  const eventType = isIn ? "IN" : "OUT";
                  const eventTag = EVENT_TYPE_TAG[eventType];

                  return (
                    <div
                      key={event.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "6px 8px",
                        background: EVENT_TYPE_BG[eventType],
                        borderRadius: 4,
                        borderLeft: `3px solid ${EVENT_TYPE_COLOR[eventType]}`,
                      }}
                    >
                      <Tag
                        icon={eventTag.icon}
                        color={eventTag.color}
                        style={{ margin: 0, fontSize: 11, padding: "0 6px" }}
                      >
                        {eventTag.text}
                      </Tag>
                      <Text strong style={{ fontSize: 13 }}>
                        {dayjs(event.timestamp).format("HH:mm")}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(event.timestamp).format("DD/MM")}
                      </Text>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Empty
                  description="Ma'lumot yo'q"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Card>
        </Col>

        {/* Kalendar - Desktop'da yonma-yon, Tablet/Mobile'da toggle */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>Kalendar</span>
              </Space>
            }
            size="small"
            styles={{ body: { height: 320, padding: 0, overflow: "hidden" } }}
            extra={
              <Space size={4} style={{ fontSize: 10 }}>
                <Badge color="green" text="K" />
                <Badge color="orange" text="Ke" />
                <Badge color="red" text="Yo" />
              </Space>
            }
          >
            <div
              style={{
                transform: "scale(0.9)",
                transformOrigin: "top left",
                width: "111%",
                padding: "0 8px",
              }}
            >
              <Calendar
                fullscreen={false}
                cellRender={dateCellRender}
                onSelect={(date) => {
                  setCustomDateRange([date, date]);
                  setSelectedPeriod("custom");
                }}
                value={
                  selectedPeriod === "custom" && customDateRange
                    ? customDateRange[0]
                    : dayjs()
                }
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Haftalik davomat dinamikasi */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        <Col xs={24}>
          <Card
            title="Haftalik davomat dinamikasi (oxirgi 7 kun)"
            size="small"
            styles={{ body: { height: 200 } }}
          >
            <div style={{ height: 180 }}>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dayName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} ticks={[0, 1]} />
                    <RechartsTooltip />
                    <Line
                      type="monotone"
                      dataKey="present"
                      stroke={STATUS_COLORS.PRESENT}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Kelgan"
                    />
                    <Line
                      type="monotone"
                      dataKey="late"
                      stroke={STATUS_COLORS.LATE}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Kech qoldi"
                    />
                    <Line
                      type="monotone"
                      dataKey="absent"
                      stroke={STATUS_COLORS.ABSENT}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                      name="Kelmadi"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Empty
                    description="Ma'lumot yo'q"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        title="Davomat Tarixi"
        size="small"
        style={{ borderRadius: 8, border: "1px solid #f0f0f0" }}
      >
        <Table
          dataSource={filteredAttendance}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedRecord(record);
              setModalOpen(true);
            },
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      {/* Kirdi-Chiqdi Modal */}
      <Modal
        title={
          selectedRecord && (
            <Space>
              <span>{dayjs(selectedRecord.date).format("DD MMMM, YYYY")}</span>
              <Tag color={EFFECTIVE_STATUS_COLORS[selectedRecord.status]}>
                {EFFECTIVE_STATUS_LABELS[selectedRecord.status]}
              </Tag>
              {selectedRecord.currentlyInSchool && (
                <Tag icon={<LoginOutlined />} color="purple">
                  Hozir maktabda
                </Tag>
              )}
            </Space>
          )
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={500}
      >
        {selectedRecord && (
          <div>
            {/* Kunlik statistika */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
                padding: 12,
                background: "#fafafa",
                borderRadius: 8,
              }}
            >
              <div>
                <Text type="secondary">Kirdi</Text>
                <div>
                  <Text strong>
                    {selectedRecord.firstScanTime
                      ? dayjs(selectedRecord.firstScanTime).format("HH:mm")
                      : "-"}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Chiqdi</Text>
                <div>
                  <Text strong>
                    {selectedRecord.lastOutTime
                      ? dayjs(selectedRecord.lastOutTime).format("HH:mm")
                      : "-"}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary">Maktabda</Text>
                <div>
                  <Text strong>
                    {formatDuration(selectedRecord.totalTimeOnPremises || 0)}
                  </Text>
                </div>
              </div>
              {selectedRecord.lateMinutes && selectedRecord.lateMinutes > 0 && (
                <div>
                  <Text type="secondary">Kechikish</Text>
                  <div>
                    <Tag color="orange">
                      {selectedRecord.lateMinutes} daqiqa
                    </Tag>
                  </div>
                </div>
              )}
            </div>

            {/* Kirdi-Chiqdi tarixi */}
            <Text strong style={{ display: "block", marginBottom: 8 }}>
              Kirdi-Chiqdi tarixi
            </Text>
            {(() => {
              const dayEvents = getEventsForDate(selectedRecord.date);
              if (dayEvents.length === 0) {
                return (
                  <Empty description="Bu kunda kirdi-chiqdi ma'lumoti yo'q" />
                );
              }
              return (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {dayEvents.map((event) => {
                    const isIn = event.eventType === "IN";
                    const eventType = isIn ? "IN" : "OUT";
                    const eventTag = EVENT_TYPE_TAG[eventType];

                    return (
                      <div
                        key={event.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 14px",
                          background: EVENT_TYPE_BG[eventType],
                          borderRadius: 8,
                          borderLeft: `4px solid ${EVENT_TYPE_COLOR[eventType]}`,
                        }}
                      >
                        <Tag
                          icon={eventTag.icon}
                          color={eventTag.color}
                          style={{ margin: 0 }}
                        >
                          {eventTag.text}
                        </Tag>
                        <Text strong style={{ fontSize: 16 }}>
                          {dayjs(event.timestamp).format("HH:mm:ss")}
                        </Text>
                        {event.device?.name && (
                          <Text type="secondary">{event.device.name}</Text>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default StudentDetail;

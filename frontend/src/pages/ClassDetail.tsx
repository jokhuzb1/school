import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Tag,
  Badge,
  Spin,
  Empty,
  Tooltip,
  Space,
  Avatar,
  Button,
  Select,
  Popconfirm,
  Modal,
  Form,
  Input,
  TimePicker,
  App,
} from "antd";
import {
  UserOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useParams, useNavigate } from "react-router-dom";
import { useSchool } from "../hooks/useSchool";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { classesService } from "../services/classes";
import { studentsService } from "../services/students";
import { schoolsService } from "../services/schools";
import { PageHeader, Divider } from "../components";
import { StatItem } from "../components/StatItem";
import { getAssetUrl } from "../config";
import type { Class, Student, School, AttendanceStatus } from "../types";
import dayjs from "dayjs";

const { Text, Title } = Typography;

// Status konfiguratsiyasi
type EffectiveStatus = AttendanceStatus | "PENDING";

const STATUS_CONFIG: Record<
  EffectiveStatus,
  { color: string; bg: string; text: string }
> = {
  PRESENT: { color: "#52c41a", bg: "#f6ffed", text: "Kelgan" },
  LATE: { color: "#faad14", bg: "#fffbe6", text: "Kech" },
  ABSENT: { color: "#ff4d4f", bg: "#fff2f0", text: "Kelmagan" },
  EXCUSED: { color: "#8c8c8c", bg: "#f5f5f5", text: "Sababli" },
  PENDING: { color: "#bfbfbf", bg: "#fafafa", text: "Kutilmoqda" },
};

// NOTE: getEffectiveStatus removed - now using todayEffectiveStatus from backend API

const ClassDetail: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const { schoolId } = useSchool();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [school, setSchool] = useState<School | null>(null);
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    if (!classId || !schoolId) return;
    try {
      // Parallel so'rovlar
      const [studentsData, classesData, schoolData] = await Promise.all([
        studentsService.getAll(schoolId, { classId }),
        classesService.getAll(schoolId),
        schoolsService.getById(schoolId),
      ]);

      setStudents(studentsData.data || []);
      setSchool(schoolData);

      // Class ma'lumotlarini topish
      const foundClass = classesData.find((c: Class) => c.id === classId);
      if (foundClass) {
        setClassData(foundClass);
      }

      // Haftalik statistika (placeholder - backend'dan olish kerak)
      const weekStart = dayjs().startOf("week");
      const weekData = [];
      for (let i = 0; i < 7; i++) {
        const date = weekStart.add(i, "day");
        const dayName = date.format("ddd");
        weekData.push({
          date: date.format("YYYY-MM-DD"),
          dayName,
          present: Math.floor(Math.random() * 20) + 10,
          late: Math.floor(Math.random() * 5),
          absent: Math.floor(Math.random() * 5),
        });
      }
      setWeeklyStats(weekData);

      // Recent events - o'quvchilarning bugungi kirdi-chiqdi loglari
      const events: any[] = [];
      (studentsData.data || []).forEach((student: Student) => {
        if (student.todayFirstScan) {
          events.push({
            id: `${student.id}-in`,
            student,
            eventType: "IN",
            timestamp: student.todayFirstScan,
          });
        }
      });
      // Vaqt bo'yicha tartiblash
      events.sort((a, b) => dayjs(b.timestamp).diff(dayjs(a.timestamp)));
      setRecentEvents(events.slice(0, 10));
    } catch (err) {
      console.error(err);
    }
  }, [classId, schoolId]);

  // SSE for real-time updates
  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: () => {
      fetchData();
    },
  });

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    loadInitial();
  }, [fetchData]);

  // Edit sinf
  const handleEdit = () => {
    if (!classData) return;
    form.setFieldsValue({
      name: classData.name,
      gradeLevel: classData.gradeLevel,
      startTime: classData.startTime
        ? dayjs(classData.startTime, "HH:mm")
        : null,
      endTime: classData.endTime ? dayjs(classData.endTime, "HH:mm") : null,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (values: any) => {
    if (!classId) return;
    try {
      await classesService.update(classId, {
        ...values,
        startTime: values.startTime?.format("HH:mm"),
        endTime: values.endTime?.format("HH:mm"),
      });
      message.success("Sinf yangilandi");
      setEditModalOpen(false);
      fetchData();
    } catch (err) {
      message.error("Xatolik yuz berdi");
    }
  };

  // Delete sinf
  const handleDelete = async () => {
    if (!classId) return;
    try {
      await classesService.delete(classId);
      message.success("Sinf o'chirildi");
      navigate(-1);
    } catch (err) {
      message.error("Xatolik yuz berdi");
    }
  };

  // Default cutoff minutes va class start time
  const absenceCutoffMinutes = school?.absenceCutoffMinutes || 180;
  const classStartTime = classData?.startTime;

  // O'quvchilarning effective statuslarini olish (backenddan keladi)
  const studentsWithEffectiveStatus = useMemo(() => {
    return students.map((student) => ({
      ...student,
      effectiveStatus:
        (student.todayEffectiveStatus as EffectiveStatus) || "PENDING",
    }));
  }, [students]);

  // Statistikalar
  const stats = useMemo(() => {
    const present = studentsWithEffectiveStatus.filter(
      (s) => s.effectiveStatus === "PRESENT",
    ).length;
    const late = studentsWithEffectiveStatus.filter(
      (s) => s.effectiveStatus === "LATE",
    ).length;
    const absent = studentsWithEffectiveStatus.filter(
      (s) => s.effectiveStatus === "ABSENT",
    ).length;
    const excused = studentsWithEffectiveStatus.filter(
      (s) => s.effectiveStatus === "EXCUSED",
    ).length;
    const pending = studentsWithEffectiveStatus.filter(
      (s) => s.effectiveStatus === "PENDING",
    ).length;

    const total = students.length;
    const attendancePercent =
      total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return {
      total,
      present,
      late,
      absent,
      excused,
      pending,
      attendancePercent,
    };
  }, [studentsWithEffectiveStatus, students.length]);

  // Filtrlangan o'quvchilar
  const filteredStudents = useMemo(() => {
    if (!statusFilter) return studentsWithEffectiveStatus;
    return studentsWithEffectiveStatus.filter(
      (s) => s.effectiveStatus === statusFilter,
    );
  }, [studentsWithEffectiveStatus, statusFilter]);

  // Pie chart data
  const pieData = useMemo(() => {
    return [
      {
        name: STATUS_CONFIG.PRESENT.text,
        value: stats.present,
        color: STATUS_CONFIG.PRESENT.color,
      },
      {
        name: STATUS_CONFIG.LATE.text,
        value: stats.late,
        color: STATUS_CONFIG.LATE.color,
      },
      {
        name: STATUS_CONFIG.ABSENT.text,
        value: stats.absent,
        color: STATUS_CONFIG.ABSENT.color,
      },
      {
        name: STATUS_CONFIG.PENDING.text,
        value: stats.pending,
        color: STATUS_CONFIG.PENDING.color,
      },
      {
        name: STATUS_CONFIG.EXCUSED.text,
        value: stats.excused,
        color: STATUS_CONFIG.EXCUSED.color,
      },
    ].filter((d) => d.value > 0);
  }, [stats]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!classData) {
    return <Empty description="Sinf topilmadi" />;
  }

  return (
    <div>
      {/* Kompakt Header */}
      <PageHeader>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
          size="small"
        >
          Orqaga
        </Button>
        <Divider />
        <Space>
          <TeamOutlined style={{ color: "#1890ff", fontSize: 18 }} />
          <Title level={4} style={{ margin: 0 }}>
            {classData.name}
          </Title>
          <Text type="secondary">({classData.gradeLevel}-sinf)</Text>
        </Space>
        <Divider />
        <Tooltip title={isConnected ? "Jonli ulangan" : "Oflayn"}>
          <Badge status={isConnected ? "success" : "error"} />
        </Tooltip>
        <Divider />
        <StatItem
          icon={<UserOutlined />}
          value={stats.total}
          label="o'quvchi"
          color="#1890ff"
          tooltip="Jami o'quvchilar"
        />
        <StatItem
          icon={<CheckCircleOutlined />}
          value={stats.present}
          label="kelgan"
          color="#52c41a"
          tooltip="Bugun kelganlar"
        />
        <StatItem
          icon={<ClockCircleOutlined />}
          value={stats.late}
          label="kech"
          color="#faad14"
          tooltip="Kech qolganlar"
        />
        <StatItem
          icon={<CloseCircleOutlined />}
          value={stats.absent}
          label="yo'q"
          color="#ff4d4f"
          tooltip="Kelmaganlar"
        />
        <Divider />
        <Select
          value={dateFilter}
          onChange={setDateFilter}
          style={{ width: 130 }}
          size="small"
          options={[
            { value: "today", label: "Bugun" },
            { value: "yesterday", label: "Kecha" },
            { value: "week", label: "Bu hafta" },
            { value: "month", label: "Bu oy" },
          ]}
        />
        <Tooltip title="Tahrirlash">
          <Button size="small" icon={<EditOutlined />} onClick={handleEdit} />
        </Tooltip>
        <Popconfirm
          title="Sinfni o'chirish?"
          description="Barcha ma'lumotlar o'chiriladi!"
          onConfirm={handleDelete}
          okText="Ha"
          cancelText="Yo'q"
        >
          <Tooltip title="O'chirish">
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Tooltip>
        </Popconfirm>
      </PageHeader>

      <Row gutter={[12, 12]}>
        {/* Davomat statistikasi */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title={
              <Space>
                <CalendarOutlined />
                <span>Bugungi davomat</span>
              </Space>
            }
            size="small"
            styles={{ body: { height: 280 } }}
          >
            {/* Pie Chart */}
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                description="Ma'lumot yo'q"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}

            {/* Dars vaqti */}
            <div
              style={{ padding: 12, background: "#fafafa", borderRadius: 8 }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text type="secondary">Dars boshlanishi:</Text>
                <Text strong>{classData.startTime || "-"}</Text>
              </div>
              {classData.endTime && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 4,
                  }}
                >
                  <Text type="secondary">Dars tugashi:</Text>
                  <Text strong>{classData.endTime}</Text>
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* Oxirgi faoliyat */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="Oxirgi faoliyat"
            size="small"
            styles={{
              body: { height: 280, overflowY: "auto", padding: "8px 12px" },
            }}
          >
            {recentEvents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {recentEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "5px 8px",
                      background:
                        event.eventType === "IN" ? "#f6ffed" : "#e6f7ff",
                      borderRadius: 4,
                      borderLeft: `3px solid ${event.eventType === "IN" ? "#52c41a" : "#1890ff"}`,
                      cursor: "pointer",
                    }}
                    onClick={() => navigate(`/students/${event.student.id}`)}
                  >
                    <Avatar
                      src={getAssetUrl(event.student.photoUrl)}
                      icon={<UserOutlined />}
                      size="small"
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 12 }} ellipsis>
                        {event.student.name}
                      </Text>
                    </div>
                    <Tag
                      color={
                        event.eventType === "IN" ? "success" : "processing"
                      }
                      style={{ margin: 0, fontSize: 10 }}
                    >
                      {dayjs(event.timestamp).format("HH:mm")}
                    </Tag>
                  </div>
                ))}
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
                  description="Faoliyat yo'q"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Card>
        </Col>

        {/* O'quvchilar ro'yxati - 3-ustun */}
        <Col xs={24} lg={8}>
          <Card
            title={`O'quvchilar (${filteredStudents.length})`}
            size="small"
            styles={{
              body: { height: 280, overflowY: "auto", padding: "8px 12px" },
            }}
            extra={
              <Select
                placeholder="Holat"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 120 }}
                allowClear
                size="small"
                options={[
                  { value: "PRESENT", label: STATUS_CONFIG.PRESENT.text },
                  { value: "LATE", label: STATUS_CONFIG.LATE.text },
                  { value: "ABSENT", label: STATUS_CONFIG.ABSENT.text },
                  { value: "PENDING", label: STATUS_CONFIG.PENDING.text },
                  { value: "EXCUSED", label: STATUS_CONFIG.EXCUSED.text },
                ].filter((opt) => {
                  // Faqat mavjud statuslarni ko'rsatish
                  if (opt.value === "ABSENT") return stats.absent > 0;
                  if (opt.value === "PENDING") return stats.pending > 0;
                  return true;
                })}
              />
            }
          >
            {filteredStudents.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {filteredStudents.map((student) => {
                  const config = STATUS_CONFIG[student.effectiveStatus];
                  const time = student.todayFirstScan
                    ? dayjs(student.todayFirstScan).format("HH:mm")
                    : null;

                  return (
                    <div
                      key={student.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 8px",
                        background: config.bg,
                        borderRadius: 4,
                        borderLeft: `3px solid ${config.color}`,
                        cursor: "pointer",
                      }}
                      onClick={() => navigate(`/students/${student.id}`)}
                    >
                      <Avatar
                        src={getAssetUrl(student.photoUrl)}
                        icon={<UserOutlined />}
                        size="small"
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong style={{ fontSize: 12 }} ellipsis>
                          {student.name}
                        </Text>
                      </div>
                      {time && (
                        <Tag
                          color="default"
                          style={{ margin: 0, fontSize: 10 }}
                        >
                          {time}
                        </Tag>
                      )}
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
                  description="O'quvchi yo'q"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Haftalik statistika */}
      <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
        <Col xs={24}>
          <Card
            title="Haftalik davomat"
            size="small"
            styles={{ body: { height: 200 } }}
          >
            {weeklyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip />
                  <Bar dataKey="present" fill="#52c41a" name="Kelgan" />
                  <Bar dataKey="late" fill="#faad14" name="Kech" />
                  <Bar dataKey="absent" fill="#ff4d4f" name="Kelmagan" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty
                description="Ma'lumot yo'q"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Edit Modal */}
      <Modal
        title="Sinfni tahrirlash"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => form.submit()}
        okText="Saqlash"
        cancelText="Bekor"
      >
        <Form form={form} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label="Sinf nomi"
            rules={[{ required: true, message: "Nomni kiriting" }]}
          >
            <Input placeholder="Masalan: 1A, 5B" />
          </Form.Item>
          <Form.Item
            name="gradeLevel"
            label="Sinf darajasi"
            rules={[{ required: true, message: "Darajani tanlang" }]}
          >
            <Select
              placeholder="Tanlang"
              options={[...Array(12)].map((_, i) => ({
                value: i + 1,
                label: `${i + 1}-sinf`,
              }))}
            />
          </Form.Item>
          <Form.Item
            name="startTime"
            label="Dars boshlanish vaqti"
            rules={[{ required: true, message: "Vaqtni tanlang" }]}
          >
            <TimePicker
              format="HH:mm"
              placeholder="08:00"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item name="endTime" label="Dars tugash vaqti">
            <TimePicker
              format="HH:mm"
              placeholder="14:00"
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ClassDetail;

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
import { UserOutlined, LoginOutlined, LogoutOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, CalendarOutlined } from "@ant-design/icons";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { useParams } from "react-router-dom";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { studentsService } from "../services/students";
import { getAssetUrl } from "../config";
import type { Student, DailyAttendance, AttendanceStatus, AttendanceEvent } from "../types";
import dayjs, { Dayjs } from "dayjs";

const { Title, Text } = Typography;

const statusColors: Record<AttendanceStatus, string> = {
  PRESENT: "green",
  LATE: "orange",
  ABSENT: "red",
  EXCUSED: "gray",
};

const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState<Dayjs | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | undefined>();
  const [selectedRecord, setSelectedRecord] = useState<DailyAttendance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  // Eventlarni kun bo'yicha guruhlash
  const getEventsForDate = (date: string) => {
    const dateStr = dayjs(date).format("YYYY-MM-DD");
    return events.filter((e) => dayjs(e.timestamp).format("YYYY-MM-DD") === dateStr);
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

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!student) {
    return <Empty description="Student not found" />;
  }

  // Calculate stats including excused and average late time
  const lateRecords = attendance.filter((a) => a.status === "LATE");
  const avgLateMinutes = lateRecords.length > 0
    ? Math.round(lateRecords.reduce((sum, a) => sum + (a.lateMinutes || 0), 0) / lateRecords.length)
    : 0;

  const stats = {
    total: attendance.length,
    present: attendance.filter((a) => a.status === "PRESENT").length,
    late: lateRecords.length,
    absent: attendance.filter((a) => a.status === "ABSENT").length,
    excused: attendance.filter((a) => a.status === "EXCUSED").length,
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
    return <Badge color={statusColors[record.status]} />;
  };

  // Jami maktabda bo'lgan vaqtni hisoblash
  const totalTimeInSchool = attendance.reduce((sum, a) => sum + (a.totalTimeOnPremises || 0), 0);
  const avgTimePerDay = stats.total > 0 ? Math.round(totalTimeInSchool / stats.total) : 0;

  // Vaqtni soat:daqiqa formatiga o'girish
  const formatDuration = (minutes: number) => {
    if (!minutes) return "-";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}s ${mins}d`;
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
      render: (s: AttendanceStatus, record: DailyAttendance) => (
        <Space>
          <Tag color={statusColors[s]}>{s}</Tag>
          {record.currentlyInSchool && <Tag icon={<LoginOutlined />} color="purple">Maktabda</Tag>}
        </Space>
      ),
    },
    {
      title: "Kirdi",
      dataIndex: "firstScanTime",
      key: "arrived",
      render: (t: string) => (t ? <><LoginOutlined style={{ color: '#52c41a', marginRight: 4 }} />{dayjs(t).format("HH:mm")}</> : "-"),
    },
    {
      title: "Chiqdi",
      dataIndex: "lastOutTime",
      key: "left",
      render: (t: string) => (t ? <><LogoutOutlined style={{ color: '#1890ff', marginRight: 4 }} />{dayjs(t).format("HH:mm")}</> : "-"),
    },
    {
      title: "Maktabda",
      dataIndex: "totalTimeOnPremises",
      key: "timeInSchool",
      render: (m: number | null) => (m ? <><ClockCircleOutlined style={{ marginRight: 4 }} />{formatDuration(m)}</> : "-"),
    },
    {
      title: "Kechikish",
      dataIndex: "lateMinutes",
      key: "late",
      render: (m: number | null) => (m ? <Tag color="orange">{m} daqiqa</Tag> : "-"),
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
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle" wrap={false} style={{ overflowX: 'auto' }}>
          {/* Avatar va Ism */}
          <Col flex="none">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar
                size={48}
                src={getAssetUrl(student.photoUrl)}
                icon={<UserOutlined />}
              />
              <div>
                <Title level={5} style={{ margin: 0 }}>{student.name}</Title>
                <Space size={4}>
                  <Tag color="blue">{student.class?.name || "Sinf yo'q"}</Tag>
                  <Tooltip title={isConnected ? 'Real-time ulangan' : 'Offline'}>
                    <Badge status={isConnected ? 'success' : 'error'} />
                  </Tooltip>
                </Space>
              </div>
            </div>
          </Col>
          
          {/* Divider */}
          <Col flex="none">
            <div style={{ width: 1, height: 40, background: '#f0f0f0', margin: '0 8px' }} />
          </Col>

          {/* Statistikalar */}
          <Col flex="auto">
            <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
              <Tooltip title="Jami kunlar">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600 }}>{stats.total}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>Jami</Text>
                </div>
              </Tooltip>
              <Tooltip title="Kelgan">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#52c41a' }}>{stats.present}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}><CheckCircleOutlined /> Kelgan</Text>
                </div>
              </Tooltip>
              <Tooltip title="Kech qolgan">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#faad14' }}>{stats.late}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}><ClockCircleOutlined /> Kech</Text>
                </div>
              </Tooltip>
              <Tooltip title="Kelmagan">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#ff4d4f' }}>{stats.absent}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}><CloseCircleOutlined /> Yo'q</Text>
                </div>
              </Tooltip>
              <Tooltip title="Sababli">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#8c8c8c' }}>{stats.excused}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}><ExclamationCircleOutlined /> Sababli</Text>
                </div>
              </Tooltip>
              <Tooltip title="O'rtacha maktabda vaqt">
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#722ed1' }}>{formatDuration(avgTimePerDay)}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>O'rtacha</Text>
                </div>
              </Tooltip>
              {stats.late > 0 && (
                <Tooltip title={`${stats.late} marta kech kelgan`}>
                  <Tag color="orange" style={{ margin: 0 }}>
                    ⏰ ~{stats.avgLateMinutes} daq kechikish
                  </Tag>
                </Tooltip>
              )}
            </div>
          </Col>

          {/* Qo'shimcha info */}
          <Col flex="none">
            <Tooltip title={`ID: ${student.deviceStudentId || '-'} | ${student.parentName || '-'}: ${student.parentPhone || '-'}`}>
              <Button type="text" size="small" icon={<UserOutlined />}>Info</Button>
            </Tooltip>
          </Col>
        </Row>
      </Card>

      {/* Chart va Loglar - Tablet/Desktop yonma-yon */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {/* Pie Chart */}
        <Col xs={24} sm={12} lg={8}>
          <Card title="Davomat taqsimoti" size="small" styles={{ body: { height: 240 } }}>
            {stats.total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Kelgan", value: stats.present, color: "#52c41a" },
                      { name: "Kech", value: stats.late, color: "#faad14" },
                      { name: "Kelmagan", value: stats.absent, color: "#ff4d4f" },
                      { name: "Sababli", value: stats.excused, color: "#8c8c8c" },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {[
                      { name: "Kelgan", value: stats.present, color: "#52c41a" },
                      { name: "Kech", value: stats.late, color: "#faad14" },
                      { name: "Kelmagan", value: stats.absent, color: "#ff4d4f" },
                      { name: "Sababli", value: stats.excused, color: "#8c8c8c" },
                    ].filter(d => d.value > 0).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              </div>
            )}
          </Card>
        </Col>
        
        {/* Oxirgi Kirdi-Chiqdilar */}
        <Col xs={24} sm={12} lg={8}>
          <Card title="Oxirgi faoliyat" size="small" styles={{ body: { height: 240, overflowY: 'auto' } }}>
            {events.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {events.slice(0, 8).map((event) => (
                  <div 
                    key={event.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 8,
                      padding: '6px 8px',
                      background: event.eventType === 'IN' ? '#f6ffed' : '#e6f7ff',
                      borderRadius: 4,
                      borderLeft: `3px solid ${event.eventType === 'IN' ? '#52c41a' : '#1890ff'}`,
                    }}
                  >
                    <Tag 
                      icon={event.eventType === "IN" ? <LoginOutlined /> : <LogoutOutlined />}
                      color={event.eventType === "IN" ? "success" : "processing"}
                      style={{ margin: 0, fontSize: 11, padding: '0 6px' }}
                    >
                      {event.eventType === "IN" ? "IN" : "OUT"}
                    </Tag>
                    <Text strong style={{ fontSize: 13 }}>{dayjs(event.timestamp).format("HH:mm")}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(event.timestamp).format("DD/MM")}
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
            styles={{ body: { height: 240, overflow: 'hidden' } }}
            extra={
              <Space size={4} style={{ fontSize: 10 }}>
                <Badge color="green" text="K" />
                <Badge color="orange" text="Ke" />
                <Badge color="red" text="Yo" />
              </Space>
            }
          >
            <div style={{ transform: 'scale(0.85)', transformOrigin: 'top left', width: '118%' }}>
              <Calendar fullscreen={false} cellRender={dateCellRender} />
            </div>
          </Card>
        </Col>
      </Row>

      <Card 
        title="Davomat Tarixi"
        extra={
          <Space>
            <DatePicker
              picker="month"
              placeholder="Oy tanlang"
              value={monthFilter}
              onChange={(date) => setMonthFilter(date)}
              allowClear
            />
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value)}
              style={{ width: 120 }}
              allowClear
              options={[
                { value: "PRESENT", label: "Kelgan" },
                { value: "LATE", label: "Kech" },
                { value: "ABSENT", label: "Kelmagan" },
                { value: "EXCUSED", label: "Excused" },
              ]}
            />
          </Space>
        }
      >
        <Table
          dataSource={attendance.filter((a) => {
            let match = true;
            if (monthFilter) {
              match = match && dayjs(a.date).isSame(monthFilter, 'month');
            }
            if (statusFilter) {
              match = match && a.status === statusFilter;
            }
            return match;
          })}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 20 }}
          onRow={(record) => ({
            onClick: () => {
              setSelectedRecord(record);
              setModalOpen(true);
            },
            style: { cursor: 'pointer' },
          })}
        />
      </Card>

      {/* Kirdi-Chiqdi Modal */}
      <Modal
        title={
          selectedRecord && (
            <Space>
              <span>{dayjs(selectedRecord.date).format("DD MMMM, YYYY")}</span>
              <Tag color={statusColors[selectedRecord.status]}>{selectedRecord.status}</Tag>
              {selectedRecord.currentlyInSchool && (
                <Tag icon={<LoginOutlined />} color="purple">Hozir maktabda</Tag>
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
            <div style={{ 
              display: 'flex', 
              gap: 16, 
              marginBottom: 16, 
              padding: 12, 
              background: '#fafafa', 
              borderRadius: 8 
            }}>
              <div>
                <Text type="secondary">Kirdi</Text>
                <div><Text strong>{selectedRecord.firstScanTime ? dayjs(selectedRecord.firstScanTime).format("HH:mm") : "-"}</Text></div>
              </div>
              <div>
                <Text type="secondary">Chiqdi</Text>
                <div><Text strong>{selectedRecord.lastOutTime ? dayjs(selectedRecord.lastOutTime).format("HH:mm") : "-"}</Text></div>
              </div>
              <div>
                <Text type="secondary">Maktabda</Text>
                <div><Text strong>{formatDuration(selectedRecord.totalTimeOnPremises || 0)}</Text></div>
              </div>
              {selectedRecord.lateMinutes && selectedRecord.lateMinutes > 0 && (
                <div>
                  <Text type="secondary">Kechikish</Text>
                  <div><Tag color="orange">{selectedRecord.lateMinutes} daqiqa</Tag></div>
                </div>
              )}
            </div>

            {/* Kirdi-Chiqdi tarixi */}
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Kirdi-Chiqdi tarixi</Text>
            {(() => {
              const dayEvents = getEventsForDate(selectedRecord.date);
              if (dayEvents.length === 0) {
                return <Empty description="Bu kunda kirdi-chiqdi ma'lumoti yo'q" />;
              }
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {dayEvents.map((event) => (
                    <div 
                      key={event.id} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: 12,
                        padding: '10px 14px',
                        background: event.eventType === 'IN' ? '#f6ffed' : '#e6f7ff',
                        borderRadius: 8,
                        borderLeft: `4px solid ${event.eventType === 'IN' ? '#52c41a' : '#1890ff'}`,
                      }}
                    >
                      <Tag 
                        icon={event.eventType === "IN" ? <LoginOutlined /> : <LogoutOutlined />}
                        color={event.eventType === "IN" ? "success" : "processing"}
                        style={{ margin: 0 }}
                      >
                        {event.eventType === "IN" ? "KIRDI" : "CHIQDI"}
                      </Tag>
                      <Text strong style={{ fontSize: 16 }}>{dayjs(event.timestamp).format("HH:mm:ss")}</Text>
                      {event.device?.name && (
                        <Text type="secondary">{event.device.name}</Text>
                      )}
                    </div>
                  ))}
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

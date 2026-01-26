import React, { useEffect, useState, useCallback } from "react";
import {
  Row,
  Col,
  Card,
  Tag,
  Spin,
  Empty,
  Badge,
  Tooltip,
  Typography,
  List,
  Progress,
  Select,
} from "antd";
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  LoginOutlined,
  LogoutOutlined,
  CalendarOutlined,
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
import { useSchool } from "../hooks/useSchool";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { dashboardService } from "../services/dashboard";
import { schoolsService } from "../services/schools";
import type { DashboardStats, AttendanceEvent, School, Class } from "../types";
import { classesService } from "../services/classes";
import dayjs from "dayjs";

const { Text } = Typography;

const COLORS = ["#52c41a", "#faad14", "#ff4d4f", "#8c8c8c"];

const Dashboard: React.FC = () => {
  const { schoolId } = useSchool();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);

  const fetchStats = useCallback(async () => {
    if (!schoolId) return;
    try {
      const statsData = await dashboardService.getStats(schoolId, selectedClassId);
      setStats(statsData);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [schoolId, selectedClassId]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // SSE for real-time updates
  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: (event) => {
      // Add new event to the top of the list
      setEvents((prev) =>
        [event as unknown as AttendanceEvent, ...prev].slice(0, 10),
      );
      // Refresh stats
      fetchStats();
    },
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!schoolId) return;
      setLoading(true);
      try {
        const [statsData, eventsData, schoolData, classesData] = await Promise.all([
          dashboardService.getStats(schoolId, selectedClassId),
          dashboardService.getRecentEvents(schoolId, 10),
          schoolsService.getById(schoolId),
          classesService.getAll(schoolId),
        ]);
        setStats(statsData);
        setEvents(eventsData);
        setSchool(schoolData);
        setClasses(classesData);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId, selectedClassId]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <Empty description="No data available" />;
  }

  const pieData = [
    { name: "Kelgan", value: stats.presentToday - stats.lateToday },
    { name: "Kech", value: stats.lateToday },
    { name: "Kelmagan", value: stats.absentToday },
  ].filter((d) => d.value > 0);

  return (
    <div>
      {/* Kompakt Header: Vaqt + Statistikalar */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Sinf filter */}
          <Select
            placeholder="Barcha sinflar"
            allowClear
            style={{ width: 130 }}
            value={selectedClassId}
            onChange={(value) => setSelectedClassId(value)}
            options={classes.map(c => ({ value: c.id, label: c.name }))}
            size="small"
          />

          <div style={{ width: 1, height: 24, background: "#e8e8e8" }} />

          {/* Vaqt */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ClockCircleOutlined style={{ fontSize: 16, color: "#1890ff" }} />
            <Text strong style={{ fontSize: 16 }}>
              {currentTime.format("HH:mm")}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {currentTime.format("DD MMM, ddd")}
            </Text>
            <Tooltip title={isConnected ? "Real-time ulangan" : "Offline"}>
              <Badge
                status={isConnected ? "success" : "error"}
                text={isConnected ? "Live" : ""}
              />
            </Tooltip>
          </div>

          <div style={{ width: 1, height: 24, background: "#e8e8e8" }} />

          {/* Statistikalar */}
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
              flex: 1,
            }}
          >
            <Tooltip title="Jami o'quvchilar">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TeamOutlined style={{ color: "#1890ff" }} />
                <Text strong style={{ fontSize: 16, color: "#1890ff" }}>
                  {stats.totalStudents}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  jami
                </Text>
              </div>
            </Tooltip>

            <Tooltip title={`Kelganlar (${stats.presentPercentage}%)`}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircleOutlined style={{ color: "#52c41a" }} />
                <Text strong style={{ fontSize: 16, color: "#52c41a" }}>
                  {stats.presentToday}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  kelgan
                </Text>
              </div>
            </Tooltip>

            <Tooltip title="Kech qolganlar">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ClockCircleOutlined style={{ color: "#faad14" }} />
                <Text strong style={{ fontSize: 16, color: "#faad14" }}>
                  {stats.lateToday}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  kech
                </Text>
              </div>
            </Tooltip>

            <Tooltip title="Kelmaganlar">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
                <Text strong style={{ fontSize: 16, color: "#ff4d4f" }}>
                  {stats.absentToday}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  yo'q
                </Text>
              </div>
            </Tooltip>

            {(stats.excusedToday || 0) > 0 && (
              <Tooltip title="Sababli">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FileTextOutlined style={{ color: "#8c8c8c" }} />
                  <Text strong style={{ fontSize: 16, color: "#8c8c8c" }}>
                    {stats.excusedToday}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    sababli
                  </Text>
                </div>
              </Tooltip>
            )}

            <div style={{ width: 1, height: 20, background: "#e8e8e8" }} />

            <Tooltip title="Hozir maktabda">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#f6f0ff",
                  padding: "4px 10px",
                  borderRadius: 6,
                }}
              >
                <LoginOutlined style={{ color: "#722ed1" }} />
                <Text strong style={{ fontSize: 16, color: "#722ed1" }}>
                  {stats.currentlyInSchool || 0}
                </Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  maktabda
                </Text>
              </div>
            </Tooltip>
          </div>
        </div>
      </Card>

      {/* Pie Chart, Oxirgi faoliyat, Sinf bo'yicha - 3 ustun */}
      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {/* Pie Chart */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="Davomat taqsimoti"
            size="small"
            styles={{ body: { height: 240 } }}
          >
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={40}
                    outerRadius={65}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
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

        {/* Oxirgi faoliyat */}
        <Col xs={24} sm={12} lg={8}>
          <Card
            title="Oxirgi faoliyat"
            size="small"
            styles={{
              body: { height: 240, overflowY: "auto", padding: "8px 12px" },
            }}
          >
            {events.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {events.slice(0, 8).map((event) => (
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
                    }}
                  >
                    <Tag
                      icon={
                        event.eventType === "IN" ? (
                          <LoginOutlined />
                        ) : (
                          <LogoutOutlined />
                        )
                      }
                      color={
                        event.eventType === "IN" ? "success" : "processing"
                      }
                      style={{ margin: 0, fontSize: 10, padding: "0 4px" }}
                    >
                      {event.eventType}
                    </Tag>
                    <Text strong style={{ fontSize: 12 }}>
                      {dayjs(event.timestamp).format("HH:mm")}
                    </Text>
                    <Text style={{ fontSize: 11, flex: 1 }} ellipsis>
                      {event.student?.name || "?"}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 10 }}>
                      {event.student?.class?.name || ""}
                    </Text>
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

        {/* Sinf bo'yicha */}
        <Col xs={24} lg={8}>
          <Card
            title="Sinf bo'yicha"
            size="small"
            styles={{ body: { height: 240, overflowY: "auto" } }}
          >
            {stats.classBreakdown && stats.classBreakdown.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {stats.classBreakdown.map((cls) => (
                  <div key={cls.classId}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 2,
                      }}
                    >
                      <Text strong style={{ fontSize: 12 }}>
                        {cls.className}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {cls.present}/{cls.total}
                        {cls.late > 0 && (
                          <Tag
                            color="orange"
                            style={{
                              marginLeft: 4,
                              fontSize: 10,
                              padding: "0 4px",
                            }}
                          >
                            {cls.late}
                          </Tag>
                        )}
                      </Text>
                    </div>
                    <Progress
                      percent={
                        cls.total > 0
                          ? Math.round((cls.present / cls.total) * 100)
                          : 0
                      }
                      size="small"
                      status={
                        cls.total > 0 && cls.present / cls.total < 0.8
                          ? "exception"
                          : "success"
                      }
                      showInfo={false}
                    />
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
                  description="Ma'lumot yo'q"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Haftalik davomat dinamikasi va Kelmagan alert */}
      <Row gutter={[12, 12]}>
        <Col
          xs={24}
          lg={
            stats.notYetArrivedCount && stats.notYetArrivedCount > 0 ? 16 : 24
          }
        >
          <Card
            title="Haftalik davomat dinamikasi"
            size="small"
            styles={{ body: { height: 200 } }}
          >
            {stats.weeklyStats && stats.weeklyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyStats}>
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

        {/* Kelmagan o'quvchilar */}
        {stats.notYetArrivedCount && stats.notYetArrivedCount > 0 && (
          <Col xs={24} lg={8}>
            <Card
              title={
                <span>
                  <WarningOutlined style={{ color: "#faad14" }} /> Hali kelmagan
                  ({stats.notYetArrivedCount})
                </span>
              }
              size="small"
              styles={{ body: { height: 200, overflowY: "auto" } }}
            >
              <List
                size="small"
                dataSource={stats.notYetArrived?.slice(0, 8)}
                renderItem={(item) => (
                  <List.Item style={{ padding: "4px 0", fontSize: 12 }}>
                    <Text style={{ fontSize: 12 }}>{item.name}</Text>
                    <Tag style={{ fontSize: 10, marginLeft: "auto" }}>
                      {item.className}
                    </Tag>
                  </List.Item>
                )}
              />
              {stats.notYetArrivedCount > 8 && (
                <Text type="secondary" style={{ fontSize: 11 }}>
                  ...va yana {stats.notYetArrivedCount - 8} ta
                </Text>
              )}
            </Card>
          </Col>
        )}
      </Row>

      {/* Rules Footer */}
      {school && (
        <Card size="small" style={{ marginTop: 16, background: "#fafafa" }}>
          <div
            style={{
              display: "flex",
              gap: 24,
              flexWrap: "wrap",
              color: "#666",
            }}
          >
            <Text type="secondary">
              ⏰ <strong>Kech qolish:</strong> sinf boshlanishidan{" "}
              {school.lateThresholdMinutes} daqiqa keyin
            </Text>
            <Text type="secondary">
              ❌ <strong>Kelmagan:</strong> {school.absenceCutoffTime} gacha
              scan qilmasa
            </Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;

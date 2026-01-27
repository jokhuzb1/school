import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  Select,
  Space,
  Calendar,
  Segmented,
  DatePicker,
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
  SyncOutlined,
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
import type { PeriodType } from "../types";
import { schoolsService } from "../services/schools";
import type { DashboardStats, AttendanceEvent, School, Class } from "../types";
import { classesService } from "../services/classes";
import dayjs from "dayjs";
import debounce from "lodash/debounce";

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Vaqt filterlari opsiyalari
const PERIOD_OPTIONS = [
  { label: "Bugun", value: "today" },
  { label: "Kecha", value: "yesterday" },
  { label: "Hafta", value: "week" },
  { label: "Oy", value: "month" },
  { label: "Yil", value: "year" },
];

const PIE_COLORS: Record<string, string> = {
  Kelgan: "#52c41a",
  Kech: "#faad14",
  Kelmagan: "#ff4d4f",
  Sababli: "#8c8c8c",
  "Hali kelmagan": "#d9d9d9",
};

const Dashboard: React.FC = () => {
  const { schoolId } = useSchool();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(
    undefined,
  );
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Vaqt filterlari
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customDateRange, setCustomDateRange] = useState<
    [dayjs.Dayjs, dayjs.Dayjs] | null
  >(null);

  // Ref to track pending events for batch processing
  const pendingEventsRef = useRef<{ inCount: number; outCount: number }>({
    inCount: 0,
    outCount: 0,
  });

  // Bugunmi tekshirish (SSE va real-time uchun)
  const isToday = selectedPeriod === "today";

  const fetchStats = useCallback(async () => {
    if (!schoolId) return;
    try {
      const filters: any = { period: selectedPeriod };
      if (selectedClassId) filters.classId = selectedClassId;
      if (selectedPeriod === "custom" && customDateRange) {
        filters.startDate = customDateRange[0].format("YYYY-MM-DD");
        filters.endDate = customDateRange[1].format("YYYY-MM-DD");
      }

      const statsData = await dashboardService.getStats(schoolId, filters);
      setStats(statsData);
      setLastUpdate(new Date());
      // Reset pending counts after full refresh
      pendingEventsRef.current = { inCount: 0, outCount: 0 };
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [schoolId, selectedClassId, selectedPeriod, customDateRange]);

  // OPTIMIZATION: Debounced fetch - faqat 5 sekundda bir marta API chaqiriladi
  const debouncedFetchStats = useMemo(
    () =>
      debounce(
        () => {
          fetchStats();
        },
        5000,
        { leading: false, trailing: true },
      ),
    [fetchStats],
  );

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // OPTIMIZED: SSE event handler with local state update (faqat bugun uchun)
  const handleSSEEvent = useCallback(
    (event: any) => {
      // Faqat bugun tanlangan bo'lsa real-time yangilash
      if (!isToday) return;

      const typedEvent = event as unknown as AttendanceEvent;

      // Add new event to the top of the list
      setEvents((prev) => [typedEvent, ...prev].slice(0, 10));

      // LOCAL STATE UPDATE - tezkor UI yangilanishi, API kutmasdan
      setStats((prevStats) => {
        if (!prevStats) return prevStats;

        const isIn = event.eventType === "IN";

        // Update currentlyInSchool counter
        const newCurrentlyInSchool = isIn
          ? (prevStats.currentlyInSchool || 0) + 1
          : Math.max(0, (prevStats.currentlyInSchool || 0) - 1);

        // Track for potential corrections after full refresh
        if (isIn) {
          pendingEventsRef.current.inCount++;
        } else {
          pendingEventsRef.current.outCount++;
        }

        return {
          ...prevStats,
          currentlyInSchool: newCurrentlyInSchool,
        };
      });

      // Debounced full refresh - batches multiple events
      debouncedFetchStats();
    },
    [debouncedFetchStats, isToday],
  );

  // SSE for real-time updates (faqat bugun uchun faol)
  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: handleSSEEvent,
    enabled: isToday,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!schoolId) return;
      setLoading(true);
      try {
        const filters: any = { period: selectedPeriod };
        if (selectedClassId) filters.classId = selectedClassId;
        if (selectedPeriod === "custom" && customDateRange) {
          filters.startDate = customDateRange[0].format("YYYY-MM-DD");
          filters.endDate = customDateRange[1].format("YYYY-MM-DD");
        }

        const [statsData, eventsData, schoolData, classesData] =
          await Promise.all([
            dashboardService.getStats(schoolId, filters),
            isToday
              ? dashboardService.getRecentEvents(schoolId, 10)
              : Promise.resolve([]),
            schoolsService.getById(schoolId),
            classesService.getAll(schoolId),
          ]);
        setStats(statsData);
        setEvents(eventsData);
        setSchool(schoolData);
        setClasses(classesData);
        setLastUpdate(new Date());
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId, selectedClassId, selectedPeriod, customDateRange, isToday]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <Empty description="Ma'lumot mavjud emas" />;
  }

  const pieData = [
    { name: "Kelgan", value: stats.presentToday - stats.lateToday },
    { name: "Kech", value: stats.lateToday },
    { name: "Kelmagan", value: stats.absentToday },
    { name: "Sababli", value: stats.excusedToday || 0 },
    { name: "Hali kelmagan", value: stats.notYetArrivedCount || 0 },
  ].filter((d) => d.value > 0);

  return (
    <div>
      {/* Kompakt Header: Vaqt + Statistikalar */}
      <Card
        size="small"
        style={{
          marginBottom: 12,
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          {/* Vaqt va Live status */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ClockCircleOutlined style={{ fontSize: 18, color: "#1890ff" }} />
              <Text strong style={{ fontSize: 18 }}>
                {currentTime.format("HH:mm")}
              </Text>
              <Text type="secondary" style={{ fontSize: 13, marginLeft: 4 }}>
                <CalendarOutlined style={{ marginRight: 6 }} />
                {currentTime.format("DD MMM, ddd")}
              </Text>
            </div>

            <div
              style={{
                width: 1,
                height: 24,
                background: "#f0f0f0",
                margin: "0 8px",
              }}
            />

            {isToday && (
              <Tooltip title={isConnected ? "Jonli ulangan" : "Oflayn"}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge
                    status={isConnected ? "success" : "error"}
                  />
                  {isConnected && (
                    <SyncOutlined
                      spin
                      style={{ color: "#52c41a", fontSize: 12 }}
                    />
                  )}
                </div>
              </Tooltip>
            )}

            {lastUpdate && (
              <Tooltip title="Oxirgi yangilanish">
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                  ({dayjs(lastUpdate).format("HH:mm:ss")})
                </Text>
              </Tooltip>
            )}
          </div>

          {/* Statistikalar */}
          <div
            style={{
              display: "flex",
              gap: 20,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <Tooltip title="Jami o'quvchilar">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <TeamOutlined style={{ color: "#1890ff", fontSize: 16 }} />
                <Text strong style={{ fontSize: 18, color: "#1890ff" }}>
                  {stats.totalStudents}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  jami
                </Text>
              </div>
            </Tooltip>

            <Tooltip title={`Kelganlar (${stats.presentPercentage}%)`}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircleOutlined
                  style={{ color: "#52c41a", fontSize: 16 }}
                />
                <Text strong style={{ fontSize: 18, color: "#52c41a" }}>
                  {stats.presentToday}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  kelgan
                </Text>
              </div>
            </Tooltip>

            <Tooltip title="Kech qolganlar">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <ClockCircleOutlined
                  style={{ color: "#faad14", fontSize: 16 }}
                />
                <Text strong style={{ fontSize: 18, color: "#faad14" }}>
                  {stats.lateToday}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  kech
                </Text>
              </div>
            </Tooltip>

            <Tooltip title="Kelmaganlar">
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <CloseCircleOutlined
                  style={{ color: "#ff4d4f", fontSize: 16 }}
                />
                <Text strong style={{ fontSize: 18, color: "#ff4d4f" }}>
                  {stats.absentToday}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  yo'q
                </Text>
              </div>
            </Tooltip>

            {(stats.excusedToday || 0) > 0 && (
              <Tooltip title="Sababli">
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <FileTextOutlined
                    style={{ color: "#8c8c8c", fontSize: 16 }}
                  />
                  <Text strong style={{ fontSize: 18, color: "#8c8c8c" }}>
                    {stats.excusedToday}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    sababli
                  </Text>
                </div>
              </Tooltip>
            )}

            <div
              style={{
                width: 1,
                height: 24,
                background: "#f0f0f0",
                margin: "0 4px",
              }}
            />

            <Tooltip title="Hozir maktabda">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#f6f0ff",
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: "1px solid #efdbff",
                }}
              >
                <LoginOutlined style={{ color: "#722ed1", fontSize: 16 }} />
                <Text strong style={{ fontSize: 18, color: "#722ed1" }}>
                  {stats.currentlyInSchool || 0}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  maktabda
                </Text>
              </div>
            </Tooltip>
          </div>
        </div>
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
                setSelectedPeriod("today");
              }
            }}
            format="DD.MM.YYYY"
            style={{ width: 240, borderRadius: 8 }}
          />
        )}

        <div
          style={{
            width: 1,
            height: 20,
            background: "#e8e8e8",
            margin: "0 4px",
          }}
        />

        {/* Sinf filter */}
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

        {/* Period label info */}
        {stats?.periodLabel && selectedPeriod !== "today" && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Tag
              color="blue"
              bordered={false}
              style={{ borderRadius: 4, padding: "2px 8px" }}
            >
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
                    {pieData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PIE_COLORS[entry.name] || "#d9d9d9"}
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
                      {event.eventType === "IN" ? "KIRDI" : "CHIQDI"}
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

        {/* Kalendar / Sinf bo'yicha */}
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
              <strong>Kech qolish:</strong> sinf boshlanishidan{" "}
              {school.lateThresholdMinutes} daqiqa keyin
            </Text>
            <Text type="secondary">
              <strong>Kelmagan:</strong> darsdan{" "}
              {school.absenceCutoffMinutes} daqiqa o'tgach avtomatik belgilanadi
              scan qilmasa
            </Text>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Dashboard;

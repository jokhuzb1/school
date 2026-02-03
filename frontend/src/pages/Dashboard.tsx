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
  Typography,
  List,
  Select,
  Space,
  Calendar,
  Segmented,
  DatePicker,
  Modal,
  Button,
} from "antd";
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
  LoginOutlined,
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
import { useSchool } from "../hooks/useSchool";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import {
  useSchoolSnapshotSSE,
  type SchoolSnapshotPayload,
} from "../hooks/useSchoolSnapshotSSE";
import {
  useClassSnapshotSSE,
  type ClassSnapshotPayload,
} from "../hooks/useClassSnapshotSSE";
import { dashboardService } from "../services/dashboard";
import type { PeriodType, AttendanceScope } from "../types";
import { schoolsService } from "../services/schools";
import type { DashboardStats, AttendanceEvent, School, Class } from "../types";
import { classesService } from "../services/classes";
import { PageHeader, StatItem, StatGroup, useHeaderMeta } from "../shared/ui";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import {
  EFFECTIVE_STATUS_META,
  EVENT_TYPE_BG,
  EVENT_TYPE_COLOR,
  EVENT_TYPE_TAG,
  STATUS_COLORS,
} from "../entities/attendance";

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
  Kelgan: STATUS_COLORS.PRESENT,
  "Kech qoldi": STATUS_COLORS.LATE,
  Kechikmoqda: EFFECTIVE_STATUS_META.PENDING_LATE.color,
  Kelmadi: STATUS_COLORS.ABSENT,
  Sababli: STATUS_COLORS.EXCUSED,
  "Hali kelmagan": EFFECTIVE_STATUS_META.PENDING_EARLY.color,
};
const AUTO_REFRESH_MS = 60000;

const Dashboard: React.FC = () => {
  const { schoolId } = useSchool();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRange, setHistoryRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(6, "day"),
    dayjs(),
  ]);
  const [historyEvents, setHistoryEvents] = useState<AttendanceEvent[]>([]);

  const getEventStudentLabel = (event: AttendanceEvent) => {
    const raw: any = event.rawPayload || {};
    const fromAccess = raw.AccessControllerEvent || raw.accessControllerEvent || raw;
    return (
      event.student?.name ||
      fromAccess?.name ||
      fromAccess?.employeeNoString ||
      event.studentId ||
      "?"
    );
  };
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(
    undefined,
  );
  // Vaqt filterlari
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customDateRange, setCustomDateRange] = useState<
    [dayjs.Dayjs, dayjs.Dayjs] | null
  >(null);
  const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>(
    "started",
  );
  const { setMeta, setRefresh, setLastUpdated } = useHeaderMeta();

  // Ref to track pending events for batch processing
  const pendingEventsRef = useRef<{ inCount: number; outCount: number }>({
    inCount: 0,
    outCount: 0,
  });

  // Bugunmi tekshirish (SSE va real-time uchun)
  const isToday = selectedPeriod === "today";
  const schoolSnapshotEnabled = isToday && !selectedClassId;
  const classSnapshotEnabled = isToday && !!selectedClassId;

  const fetchStats = useCallback(async () => {
    if (!schoolId) return;
    try {
      const filters: any = { period: selectedPeriod };
      if (selectedClassId) filters.classId = selectedClassId;
      if (selectedPeriod === "today") filters.scope = attendanceScope;
      if (selectedPeriod === "custom" && customDateRange) {
        filters.startDate = customDateRange[0].format("YYYY-MM-DD");
        filters.endDate = customDateRange[1].format("YYYY-MM-DD");
      }

      const statsData = await dashboardService.getStats(schoolId, filters);
      setStats(statsData);
      setLastUpdated(new Date());
      // Reset pending counts after full refresh
      pendingEventsRef.current = { inCount: 0, outCount: 0 };
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [
    schoolId,
    selectedClassId,
    selectedPeriod,
    customDateRange,
    attendanceScope,
    setLastUpdated,
  ]);

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

  // OPTIMIZED: SSE event handler with local state update (faqat bugun uchun)
  const handleSSEEvent = useCallback(
    (event: any) => {
      // Faqat bugun tanlangan bo'lsa real-time yangilash
      if (!isToday) return;

      const typedEvent = event as unknown as AttendanceEvent;
      const eventClassId = typedEvent.student?.classId;
      const matchesClass =
        !selectedClassId || (eventClassId && eventClassId === selectedClassId);

      if (matchesClass) {
        setEvents((prev) => [typedEvent, ...prev].slice(0, 10));
      }

      if (historyOpen) {
        const start = historyRange[0].startOf("day");
        const end = historyRange[1].endOf("day");
        const ts = dayjs(typedEvent.timestamp);
        if (ts.isAfter(start) && ts.isBefore(end)) {
          setHistoryEvents((prev) => [typedEvent, ...prev]);
        }
      }

      if (schoolSnapshotEnabled || classSnapshotEnabled) return;

      if (selectedClassId) {
        if (!matchesClass) return;
        debouncedFetchStats();
        return;
      }

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
    [
      debouncedFetchStats,
      isToday,
      selectedClassId,
      schoolSnapshotEnabled,
      classSnapshotEnabled,
      historyOpen,
      historyRange,
    ],
  );

  const handleSnapshot = useCallback(
    (snapshot: SchoolSnapshotPayload | ClassSnapshotPayload) => {
      if (snapshot.scope !== attendanceScope) return;
      setStats((prevStats) => {
        if (!snapshot?.stats) return prevStats;

        const totalStudents = snapshot.stats.totalStudents;
        const presentToday = snapshot.stats.present;
        const lateToday = snapshot.stats.late;
        const absentToday = snapshot.stats.absent;
        const excusedToday = snapshot.stats.excused;
        const currentlyInSchool = snapshot.stats.currentlyInSchool;
        const pendingEarlyCount = snapshot.stats.pendingEarly;
        const latePendingCount = snapshot.stats.pendingLate;
        const presentPercentage =
          totalStudents > 0
            ? Math.round(((presentToday + lateToday) / totalStudents) * 100)
            : 0;

        if (!prevStats) {
          return {
            period: "today",
            periodLabel: "Bugun",
            startDate: snapshot.timestamp,
            endDate: snapshot.timestamp,
            daysCount: 1,
            totalStudents,
            presentToday,
            lateToday,
            absentToday,
            excusedToday,
            presentPercentage,
            currentlyInSchool,
            pendingEarlyCount,
            latePendingCount,
            notYetArrivedCount: pendingEarlyCount + latePendingCount,
            weeklyStats: snapshot.weeklyStats || [],
          };
        }

        return {
          ...prevStats,
          totalStudents,
          presentToday,
          lateToday,
          absentToday,
          excusedToday,
          currentlyInSchool,
          pendingEarlyCount,
          latePendingCount,
          notYetArrivedCount: pendingEarlyCount + latePendingCount,
          presentPercentage,
          weeklyStats: snapshot.weeklyStats || prevStats.weeklyStats,
        };
      });
      setLastUpdated(new Date());
    },
    [attendanceScope, setLastUpdated],
  );

  // SSE for real-time updates (faqat bugun uchun faol)
  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: handleSSEEvent,
    enabled: isToday,
  });

  useSchoolSnapshotSSE(schoolId, {
    onSnapshot: handleSnapshot,
    enabled: schoolSnapshotEnabled,
  });

  useClassSnapshotSSE(schoolId, selectedClassId || null, {
    onSnapshot: handleSnapshot,
    enabled: classSnapshotEnabled,
  });

  const loadDashboard = useCallback(
    async (withLoading = true) => {
      if (!schoolId) return;
      if (withLoading) {
        setLoading(true);
      }
      try {
        const filters: any = { period: selectedPeriod };
        if (selectedClassId) filters.classId = selectedClassId;
        if (selectedPeriod === "today") filters.scope = attendanceScope;
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
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        if (withLoading) {
          setLoading(false);
        }
      }
    },
    [
      schoolId,
      selectedClassId,
      selectedPeriod,
      customDateRange,
      isToday,
      attendanceScope,
      setLastUpdated,
    ],
  );

  const loadHistory = useCallback(async () => {
    if (!schoolId) return;
    setHistoryLoading(true);
    try {
      const result = await dashboardService.getEventHistory(schoolId, {
        startDate: historyRange[0].format("YYYY-MM-DD"),
        endDate: historyRange[1].format("YYYY-MM-DD"),
        classId: selectedClassId,
        limit: 300,
      });
      setHistoryEvents(result.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [schoolId, historyRange, selectedClassId]);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => {
      fetchStats();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isToday, fetchStats]);

  useEffect(() => {
    setMeta({ showLiveStatus: isToday, isConnected });
    return () => setMeta({ showLiveStatus: false, isConnected: false });
  }, [isToday, isConnected, setMeta]);

  const handleRefresh = useCallback(async () => {
    await loadDashboard(false);
  }, [loadDashboard]);

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

  if (!stats) {
    return <Empty description="Ma'lumot mavjud emas" />;
  }

  const toNum = (value: any) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const totalStudents = toNum(stats.totalStudents);
  const presentToday = toNum(stats.presentToday);
  const lateToday = toNum(stats.lateToday);
  const absentToday = toNum(stats.absentToday);
  const excusedToday = toNum(stats.excusedToday);
  const pendingEarlyCount =
    stats.pendingEarlyCount !== undefined
      ? toNum(stats.pendingEarlyCount)
      : 0;
  const latePendingCount =
    stats.latePendingCount !== undefined ? toNum(stats.latePendingCount) : 0;
  const notYetArrivedCount =
    stats.notYetArrivedCount !== undefined
      ? toNum(stats.notYetArrivedCount)
      : pendingEarlyCount + latePendingCount ||
        Math.max(0, totalStudents - (presentToday + absentToday + excusedToday));

  const pieData = [
    { name: "Kelgan", value: presentToday },
    { name: "Kech qoldi", value: lateToday },
    { name: "Kechikmoqda", value: latePendingCount },
    { name: "Kelmadi", value: absentToday },
    { name: "Sababli", value: excusedToday },
    { name: "Hali kelmagan", value: pendingEarlyCount },
  ];
  const pieHasData = pieData.some((d) => d.value > 0);

  const weeklyData =
    stats.weeklyStats && stats.weeklyStats.length > 0
      ? stats.weeklyStats
      : Array.from({ length: 7 }).map((_, idx) => {
          const date = dayjs().subtract(6 - idx, "day");
          return {
            date: date.format("YYYY-MM-DD"),
            dayName: date.format("dd"),
            present: 0,
            late: 0,
            absent: 0,
          };
        });

  return (
    <div>
      {/* Kompakt Header: Vaqt + Statistikalar */}
      <PageHeader>
        <StatGroup>
          <StatItem
            icon={<TeamOutlined />}
            label="jami"
            value={stats.totalStudents}
            color="#1890ff"
            tooltip="Jami o'quvchilar"
          />
          <StatItem
            icon={<CheckCircleOutlined />}
            label="kelgan"
            value={stats.presentToday}
            color={STATUS_COLORS.PRESENT}
            tooltip={`Kelganlar (kelgan+kech) ${stats.presentPercentage}%`}
          />
          <StatItem
            icon={<ClockCircleOutlined />}
            label="kech qoldi"
            value={stats.lateToday}
            color={STATUS_COLORS.LATE}
            tooltip="Kech qolganlar (scan bilan)"
          />
          <StatItem
            icon={<CloseCircleOutlined />}
            label="kelmadi"
            value={stats.absentToday}
            color={STATUS_COLORS.ABSENT}
            tooltip="Kelmadi (cutoff o'tgan)"
          />
          {latePendingCount > 0 && (
            <StatItem
              icon={<ClockCircleOutlined />}
              label="kechikmoqda"
              value={latePendingCount}
              color={EFFECTIVE_STATUS_META.PENDING_LATE.color}
              tooltip="Dars boshlangan, cutoff o'tmagan"
            />
          )}
          {pendingEarlyCount > 0 && (
            <StatItem
              icon={<CloseCircleOutlined />}
              label="hali kelmagan"
              value={pendingEarlyCount}
              color={EFFECTIVE_STATUS_META.PENDING_EARLY.color}
              tooltip="Dars hali boshlanmagan"
            />
          )}
          {(stats.excusedToday || 0) > 0 && (
            <StatItem
              icon={<FileTextOutlined />}
              label="sababli"
              value={stats.excusedToday}
              color={STATUS_COLORS.EXCUSED}
              tooltip="Sababli"
            />
          )}
          <StatItem
            icon={<LoginOutlined />}
            label="maktabda"
            value={stats.currentlyInSchool || 0}
            color="#722ed1"
            tooltip="Hozir maktabda"
            highlight
          />
        </StatGroup>
      </PageHeader>

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
              onChange={(value) =>
                setAttendanceScope(value as AttendanceScope)
              }
              options={[
                { label: "Boshlangan", value: "started" },
                { label: "Faol", value: "active" },
              ]}
              style={{ background: "transparent" }}
            />
          </div>
        )}

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
            <div style={{ height: 220 }}>
              {pieHasData ? (
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
            </div>
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
            extra={
              <Button
                size="small"
                onClick={() => {
                  setHistoryOpen(true);
                  loadHistory();
                }}
              >
                Tarix
              </Button>
            }
          >
            {events.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {events.slice(0, 8).map((event) => {
                  const eventTag = EVENT_TYPE_TAG[event.eventType];

                  return (
                    <div
                      key={event.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "5px 8px",
                        background: EVENT_TYPE_BG[event.eventType],
                        borderRadius: 4,
                        borderLeft: `3px solid ${EVENT_TYPE_COLOR[event.eventType]}`,
                      }}
                    >
                      <Tag
                        icon={eventTag.icon}
                        color={eventTag.color}
                        style={{ margin: 0, fontSize: 10, padding: "0 4px" }}
                      >
                        {eventTag.text}
                      </Tag>
                      <Text strong style={{ fontSize: 12 }}>
                        {dayjs(event.timestamp).format("HH:mm")}
                      </Text>
                      <Text style={{ fontSize: 11, flex: 1 }} ellipsis>
                        {getEventStudentLabel(event)}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {event.student?.class?.name || ""}
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

      {/* Haftalik davomat dinamikasi va Kelmadi alert */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={notYetArrivedCount > 0 ? 16 : 24}>
          <Card
            title="Haftalik davomat dinamikasi"
            size="small"
            styles={{ body: { height: 200 } }}
          >
            <div style={{ height: 180 }}>
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="dayName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Line
                      type="monotone"
                      dataKey="present"
                      stroke={STATUS_COLORS.PRESENT}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      name="Kelgan"
                    />
                    <Line
                      type="monotone"
                      dataKey="late"
                      stroke={STATUS_COLORS.LATE}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
                      name="Kech qoldi"
                    />
                    <Line
                      type="monotone"
                      dataKey="absent"
                      stroke={STATUS_COLORS.ABSENT}
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      activeDot={{ r: 4 }}
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

        {/* Kelmadi o'quvchilar */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <span>
                <WarningOutlined style={{ color: "#faad14" }} /> Kutilayotganlar (
                {notYetArrivedCount}){" "}
                <Text type="secondary" style={{ fontSize: 11 }}>
                  Hali kelmagan: {pendingEarlyCount} · Kechikmoqda:{" "}
                  {latePendingCount}
                </Text>
              </span>
            }
            size="small"
            styles={{ body: { height: 200, overflowY: "auto" } }}
          >
            {notYetArrivedCount > 0 ? (
              <>
                <List
                  size="small"
                  dataSource={stats.notYetArrived?.slice(0, 8)}
                  renderItem={(item) => (
                    <List.Item style={{ padding: "4px 0", fontSize: 12 }}>
                      <Text style={{ fontSize: 12 }}>{item.name}</Text>
                      {item.pendingStatus === "PENDING_LATE" ? (
                        <Tag
                          color="gold"
                          style={{ fontSize: 10, marginLeft: "auto" }}
                        >
                          Kechikmoqda
                        </Tag>
                      ) : (
                        <Tag
                          color="default"
                          style={{ fontSize: 10, marginLeft: "auto" }}
                        >
                          Hali kelmagan
                        </Tag>
                      )}
                      <Tag style={{ fontSize: 10, marginLeft: 6 }}>
                        {item.className}
                      </Tag>
                    </List.Item>
                  )}
                />
                {notYetArrivedCount > 8 && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    ...va yana {notYetArrivedCount - 8} ta
                  </Text>
                )}
              </>
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
                  description="Hozircha yo'q"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              </div>
            )}
          </Card>
        </Col>
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
              <strong>Kelmadi:</strong> darsdan{" "}
              {school.absenceCutoffMinutes} daqiqa o'tgach avtomatik belgilanadi
              scan qilmasa
            </Text>
          </div>
        </Card>
      )}

      <Modal
        title="Faoliyat tarixi"
        open={historyOpen}
        onCancel={() => setHistoryOpen(false)}
        footer={[
          <Button key="refresh" onClick={loadHistory} loading={historyLoading}>
            Yangilash
          </Button>,
          <Button key="close" onClick={() => setHistoryOpen(false)}>
            Yopish
          </Button>,
        ]}
        width={640}
      >
        <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <RangePicker
            value={historyRange}
            onChange={(range) => {
              if (range && range[0] && range[1]) {
                setHistoryRange([range[0], range[1]]);
              }
            }}
            format="DD.MM.YYYY"
          />
          <Button onClick={loadHistory} loading={historyLoading}>
            Qidirish
          </Button>
        </div>
        {historyEvents.length > 0 ? (
          <List
            size="small"
            dataSource={historyEvents.slice(0, 200)}
            renderItem={(event) => {
              const eventTag = EVENT_TYPE_TAG[event.eventType];
              return (
                <List.Item>
                  <Space size={8}>
                    <Tag color={eventTag.color} style={{ margin: 0 }}>
                      {eventTag.text}
                    </Tag>
                    <Text strong style={{ fontSize: 12 }}>
                      {dayjs(event.timestamp).format("DD/MM HH:mm:ss")}
                    </Text>
                    <Text style={{ fontSize: 12 }}>
                      {getEventStudentLabel(event)}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {event.student?.class?.name || ""}
                    </Text>
                  </Space>
                </List.Item>
              );
            }}
          />
        ) : (
          <Empty description={historyLoading ? "Yuklanmoqda..." : "Ma'lumot yo'q"} />
        )}
      </Modal>
    </div>
  );
};

export default Dashboard;

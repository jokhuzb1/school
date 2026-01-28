import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  Tag,
  Spin,
  Empty,
  Typography,
  Table,
  Popover,
  Badge,
  List,
  Segmented,
  DatePicker,
} from "antd";
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  BankOutlined,
  CalendarOutlined,
  WarningOutlined,
  RightOutlined,
  WifiOutlined,
  SyncOutlined,
  LoginOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { dashboardService } from "../services/dashboard";
import type { PeriodType, AttendanceScope } from "../types";
import { useAdminSSE } from "../hooks/useAdminSSE";
import { PageHeader } from "../components/PageHeader";
import { StatItem, StatGroup } from "../components/StatItem";
import { StatusBar } from "../components";
import dayjs from "dayjs";
import debounce from "lodash/debounce";

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Vaqt filterlari opsiyalari
const PERIOD_OPTIONS = [
  { label: 'Bugun', value: 'today' },
  { label: 'Kecha', value: 'yesterday' },
  { label: 'Hafta', value: 'week' },
  { label: 'Oy', value: 'month' },
  { label: 'Yil', value: 'year' },
];
const AUTO_REFRESH_MS = 60000;

interface SchoolStats {
  id: string;
  name: string;
  address: string;
  totalStudents: number;
  totalClasses: number;
  totalDevices: number;
  presentToday: number;
  lateToday: number;
  absentToday: number;
  excusedToday?: number;
  pendingEarlyCount?: number;
  latePendingCount?: number;
  currentlyInSchool: number;
  attendancePercent: number;
}

interface AdminDashboardData {
  totals: {
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
  schools: SchoolStats[];
  recentEvents: any[];
  weeklyStats: { date: string; dayName: string; present: number; late: number; absent: number }[];
}

// Real vaqt event interfeysi
interface RealtimeEvent {
  id: string;
  schoolId: string;
  schoolName?: string;
  studentName?: string;
  eventType: 'IN' | 'OUT';
  timestamp: string;
  className?: string;
}

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Vaqt filterlari
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('today');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>('started');
  
  // Bugunmi tekshirish (SSE va real-time uchun)
  const isToday = selectedPeriod === 'today';

  const refreshData = useCallback(async (withLoading = false) => {
    if (withLoading) {
      setLoading(true);
    }
    try {
      const filters: any = { period: selectedPeriod };
      if (selectedPeriod === 'custom' && customDateRange) {
        filters.startDate = customDateRange[0].format('YYYY-MM-DD');
        filters.endDate = customDateRange[1].format('YYYY-MM-DD');
      }
      if (selectedPeriod === 'today') {
        filters.scope = attendanceScope;
      }
      const result = await dashboardService.getAdminStats(filters);
      setData(result);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Failed to refresh admin dashboard:", err);
    } finally {
      if (withLoading) {
        setLoading(false);
      }
    }
  }, [selectedPeriod, customDateRange, attendanceScope]);

  // Debounced fetch - har bir eventda emas, 5 sekundda bir marta
  const debouncedFetchData = useMemo(
    () =>
      debounce(() => {
        refreshData();
      }, 5000),
    [refreshData]
  );

  // SSE event handler - local state update + debounced API call (faqat bugun uchun)
  const handleAttendanceEvent = useCallback((event: any) => {
    // Faqat bugun tanlangan bo'lsa real-time yangilash
    if (!isToday) return;
    
    const newEvent: RealtimeEvent = {
      id: event.event?.id || Date.now().toString(),
      schoolId: event.schoolId,
      schoolName: event.schoolName,
      studentName: event.event?.student?.name || 'Noma\'lum',
      eventType: event.event?.eventType || 'IN',
      timestamp: event.event?.timestamp || new Date().toISOString(),
      className: event.event?.student?.class?.name,
    };

    // Add to realtime events (keep last 20)
    setRealtimeEvents(prev => [newEvent, ...prev].slice(0, 20));

    // Local state update - tezkor UI yangilanishi
    if (data && event.schoolId) {
      setData(prevData => {
        if (!prevData) return prevData;

        const updatedSchools = prevData.schools.map(school => {
          if (school.id === event.schoolId) {
            const isIn = event.event?.eventType === 'IN';
            return {
              ...school,
              currentlyInSchool: isIn 
                ? school.currentlyInSchool + 1 
                : Math.max(0, school.currentlyInSchool - 1),
            };
          }
          return school;
        });

        // Update totals
        const isIn = event.event?.eventType === 'IN';
        const updatedTotals = {
          ...prevData.totals,
          currentlyInSchool: isIn
            ? prevData.totals.currentlyInSchool + 1
            : Math.max(0, prevData.totals.currentlyInSchool - 1),
        };

        return {
          ...prevData,
          schools: updatedSchools,
          totals: updatedTotals,
        };
      });
    }

    // Debounced full refresh
    debouncedFetchData();
  }, [data, debouncedFetchData, isToday]);

  // SSE connection (faqat bugun uchun faol)
  const { isConnected } = useAdminSSE({
    onAttendanceEvent: handleAttendanceEvent,
    enabled: isToday,
  });

  useEffect(() => {
    refreshData(true);
    // Reset realtime events when period changes
    if (!isToday) {
      setRealtimeEvents([]);
    }
  }, [refreshData, isToday]);

  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => {
      refreshData();
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isToday, refreshData]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return <Empty description="Ma'lumot yo'q" />;
  }

  const { totals, schools, weeklyStats } = data;

  // Maktablarni davomat bo'yicha tartiblash (reytingg)
  const sortedSchools = [...schools].sort((a, b) => b.attendancePercent - a.attendancePercent);

  // Muammoli maktablar (davomat < 80% yoki qurilma muammosi)
  const problemSchools = schools.filter(s => s.attendancePercent < 80);

  // Holat aniqlash
  const getStatus = (percent: number) => {
    if (percent >= 90) return { color: "#52c41a", text: "Yaxshi", icon: "" };
    if (percent >= 75) return { color: "#faad14", text: "Normal", icon: "" };
    return { color: "#ff4d4f", text: "Muammo", icon: "" };
  };

  // Jadval ustunlari
  const columns = [
    {
      title: "#",
      key: "rank",
      width: 40,
      render: (_: any, __: any, index: number) => (
        <Text strong style={{ color: index < 3 ? "#1890ff" : "#8c8c8c" }}>{index + 1}</Text>
      ),
    },
    {
      title: "Maktab",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: SchoolStats) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{record.address || "Manzil kiritilmagan"}</Text>
        </div>
      ),
    },
    {
      title: "O'quvchilar",
      dataIndex: "totalStudents",
      key: "students",
      width: 100,
      render: (count: number) => (
        <div style={{ textAlign: "center" }}>
          <Text strong>{count}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 10 }}>o'quvchi</Text>
        </div>
      ),
    },
    {
      title: "Davomat",
      key: "attendance",
      width: 120,
      sorter: (a: SchoolStats, b: SchoolStats) =>
        a.attendancePercent - b.attendancePercent,
      render: (_: any, record: SchoolStats) => (
        <StatusBar
          total={record.totalStudents}
          present={record.presentToday}
          late={record.lateToday}
          absent={record.absentToday}
          pendingEarly={record.pendingEarlyCount || 0}
          pendingLate={record.latePendingCount || 0}
          excused={record.excusedToday || 0}
          height={10}
        />
      ),
    },
    {
      title: "Kelgan",
      key: "present",
      width: 80,
      render: (_: any, record: SchoolStats) => (
        <Tag color="success" style={{ margin: 0 }}>
          <CheckCircleOutlined /> {record.presentToday}
        </Tag>
      ),
    },
    {
      title: "Kech qoldi",
      dataIndex: "lateToday",
      key: "late",
      width: 70,
      render: (count: number) => count > 0 ? (
        <Tag color="warning" style={{ margin: 0 }}>
          <ClockCircleOutlined /> {count}
        </Tag>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: "Kelmadi",
      dataIndex: "absentToday",
      key: "absent",
      width: 70,
      render: (count: number) => count > 0 ? (
        <Tag color="error" style={{ margin: 0 }}>
          <CloseCircleOutlined /> {count}
        </Tag>
      ) : <Text type="secondary">-</Text>,
    },
    {
      title: "Holat",
      key: "status",
      width: 100,
      render: (_: any, record: SchoolStats) => {
        const status = getStatus(record.attendancePercent);
        const notPresent =
          record.totalStudents -
          (record.presentToday +
            record.lateToday +
            (record.excusedToday || 0));
        
        return (
          <Popover
            placement="left"
            title={
              <span style={{ color: status.color }}>
                {status.icon ? `${status.icon} ` : ""}{record.name} - {status.text}
              </span>
            }
            content={
              <div style={{ minWidth: 180 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Jami o'quvchilar:</Text>
                  <Text strong>{record.totalStudents}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kelganlar (jami):</Text>
                  <Text strong style={{ color: "#52c41a" }}>
                    {record.presentToday + record.lateToday} ({record.attendancePercent}%)
                  </Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kech qoldi:</Text>
                  <Text strong style={{ color: "#fa8c16" }}>{record.lateToday}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kechikmoqda:</Text>
                  <Text strong style={{ color: "#fadb14" }}>{record.latePendingCount || 0}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kelmadi:</Text>
                  <Text strong style={{ color: "#ff4d4f" }}>{record.absentToday}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Hali kelmagan:</Text>
                  <Text strong style={{ color: "#bfbfbf" }}>{record.pendingEarlyCount || 0}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Hozir maktabda:</Text>
                  <Text strong style={{ color: "#722ed1" }}>{record.currentlyInSchool}</Text>
                </div>
                <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8, marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {status.text === "Yaxshi" && "Kelganlar 90% dan yuqori - ajoyib!"}
                    {status.text === "Normal" && "Kelganlar 75-90% orasida - yaxshi"}
                    {status.text === "Muammo" && `Kelganlar 75% dan past - ${notPresent} o'quvchi kelmagan`}
                  </Text>
                </div>
              </div>
            }
            trigger="hover"
          >
            <div style={{ cursor: "pointer" }}>
              <Text style={{ color: status.color }}>
                {status.icon ? `${status.icon} ` : ""}{status.text}
              </Text>
            </div>
          </Popover>
        );
      },
    },
    {
      title: "",
      key: "action",
      width: 40,
      render: () => <RightOutlined style={{ color: "#bfbfbf" }} />,
    },
  ];

  return (
    <div>
      {/* Kompakt Header - Standart PageHeader uslubida */}
      <PageHeader 
        showTime 
        showLiveStatus={isToday} 
        isConnected={isConnected}
        extra={
          lastUpdate && (
            <Text type="secondary" style={{ fontSize: 10 }}>
              (yangilandi: {dayjs(lastUpdate).format("HH:mm:ss")})
            </Text>
          )
        }
      >
        <StatGroup>
          <StatItem
            icon={<BankOutlined />}
            label="maktab"
            value={totals.totalSchools}
            color="#722ed1"
            tooltip="Jami maktablar"
          />
          <StatItem
            icon={<TeamOutlined />}
            label="o'quvchi"
            value={totals.totalStudents}
            color="#1890ff"
            tooltip="Jami o'quvchilar"
          />
          <StatItem
            icon={<CheckCircleOutlined />}
            label="kelgan %"
            value={`${totals.attendancePercent}%`}
            color="#52c41a"
            tooltip="Kelganlar foizi"
          />
          <StatItem
            icon={<CheckCircleOutlined />}
            label="kelgan"
            value={totals.presentToday}
            color="#52c41a"
            tooltip="Kelganlar"
          />
          <StatItem
            icon={<ClockCircleOutlined />}
            label="kech qoldi"
            value={totals.lateToday}
            color="#fa8c16"
            tooltip="Kech qoldi (scan bilan)"
          />
          <StatItem
            icon={<CloseCircleOutlined />}
            label="kelmadi"
            value={totals.absentToday}
            color="#ff4d4f"
            tooltip="Kelmadi"
          />
          {(totals.excusedToday || 0) > 0 && (
            <StatItem
              icon={<FileTextOutlined />}
              label="sababli"
              value={totals.excusedToday || 0}
              color="#8c8c8c"
              tooltip="Sababli"
            />
          )}
          {(totals.latePendingCount || 0) > 0 && (
            <StatItem
              icon={<ClockCircleOutlined />}
              label="kechikmoqda"
              value={totals.latePendingCount || 0}
              color="#fadb14"
              tooltip="Dars boshlangan, cutoff o'tmagan"
            />
          )}
          {(totals.pendingEarlyCount || 0) > 0 && (
            <StatItem
              icon={<CloseCircleOutlined />}
              label="hali kelmagan"
              value={totals.pendingEarlyCount || 0}
              color="#bfbfbf"
              tooltip="Dars hali boshlanmagan"
            />
          )}
          {problemSchools.length > 0 && (
            <StatItem
              icon={<WarningOutlined />}
              label="muammo"
              value={problemSchools.length}
              color="#ff4d4f"
              tooltip="Muammoli maktablar"
              highlight
              onClick={() => {}} // Popover handle by own
            />
          )}
        </StatGroup>
      </PageHeader>

      {/* Filterlar satri */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
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
                if (value !== 'custom') setCustomDateRange(null);
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
          {(selectedPeriod === 'custom' || customDateRange) && (
            <RangePicker
              size="middle"
              value={customDateRange}
              onChange={(dates) => {
                if (dates && dates[0] && dates[1]) {
                  setCustomDateRange([dates[0], dates[1]]);
                  setSelectedPeriod('custom');
                } else {
                  setCustomDateRange(null);
                  setSelectedPeriod('today');
                }
              }}
              format="DD.MM.YYYY"
              style={{ width: 240, borderRadius: 8 }}
            />
          )}

          {problemSchools.length > 0 && (
            <div style={{ marginLeft: "auto" }}>
              <Popover
                title={<span style={{ color: "#ff4d4f" }}><WarningOutlined /> Muammoli maktablar ({problemSchools.length})</span>}
                content={
                  <div style={{ maxWidth: 280 }}>
                    <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                      Davomat 80% dan past bo'lgan maktablar:
                    </Text>
                    {problemSchools.map(s => (
                      <div 
                        key={s.id}
                        onClick={() => navigate(`/schools/${s.id}/dashboard`)}
                        style={{ 
                          display: "flex", 
                          justifyContent: "space-between", 
                          alignItems: "center",
                          padding: "6px 8px",
                          marginBottom: 4,
                          background: "#fff2f0",
                          borderRadius: 4,
                          cursor: "pointer",
                          borderLeft: "3px solid #ff4d4f"
                        }}
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

      {/* Maktablar reytingi jadvali */}
      <Card 
        title="Maktablar reytingi" 
        size="small" 
        style={{ marginBottom: 12 }}
      >
        <Table
          dataSource={sortedSchools}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={false}
          onRow={(record) => ({
            onClick: () => navigate(`/schools/${record.id}/dashboard`),
            style: { cursor: "pointer" },
          })}
        />
      </Card>

      {/* Haftalik trend va real vaqt eventlar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: 12 }}>
        {/* Haftalik trend */}
        <Card title="Haftalik trend" size="small" styles={{ body: { height: 200 } }}>
          {weeklyStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <RechartsTooltip />
                <Bar dataKey="present" fill="#52c41a" name="Kelgan" />
                <Bar dataKey="late" fill="#fa8c16" name="Kech qoldi" />
                <Bar dataKey="absent" fill="#ff4d4f" name="Kelmadi" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty description="Ma'lumot yo'q" />
          )}
        </Card>

        {/* Real vaqt eventlar paneli */}
        <Card 
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isConnected && (
                <Badge 
                  count={realtimeEvents.length} 
                  style={{ backgroundColor: '#52c41a' }} 
                  overflowCount={99}
                />
              )}
            </div>
          }
          size="small" 
          styles={{ body: { height: 200, overflow: "auto", padding: 0 } }}
          extra={
            isConnected ? (
              <Tag color="success" style={{ margin: 0 }}>
                <SyncOutlined spin />
              </Tag>
            ) : (
              <Tag color="error" style={{ margin: 0 }}></Tag>
            )
          }
        >
          {realtimeEvents.length > 0 ? (
            <List
              size="small"
              dataSource={realtimeEvents}
              renderItem={(event) => (
                <List.Item 
                  style={{ 
                    padding: "6px 12px",
                    cursor: "pointer",
                    borderLeft: `3px solid ${event.eventType === 'IN' ? '#52c41a' : '#ff4d4f'}`,
                    background: event.eventType === 'IN' ? '#f6ffed' : '#fff2f0',
                  }}
                  onClick={() => navigate(`/schools/${event.schoolId}/dashboard`)}
                >
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong style={{ fontSize: 12 }}>
                        {event.eventType === 'IN' ? (
                          <LoginOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                        ) : (
                          <LogoutOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                        )}
                        {event.studentName}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {dayjs(event.timestamp).format("HH:mm:ss")}
                      </Text>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                      <Text type="secondary" style={{ fontSize: 10 }}>
                        {event.schoolName || 'Maktab'}
                        {event.className && ` - ${event.className}`}
                      </Text>
                      <Tag 
                        color={event.eventType === 'IN' ? 'success' : 'error'} 
                        style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}
                      >
                        {event.eventType === 'IN' ? 'KIRDI' : 'CHIQDI'}
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
                  <WifiOutlined style={{ fontSize: 24, color: "#ff4d4f" }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>Ulanish yo'q</Text>
                </>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  Tag,
  Spin,
  Empty,
  Tooltip,
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
import type { PeriodType } from "../types";
import { useAdminSSE } from "../hooks/useAdminSSE";
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
  const [currentTime, setCurrentTime] = useState(dayjs());
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Vaqt filterlari
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('today');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  
  // Bugunmi tekshirish (SSE va real-time uchun)
  const isToday = selectedPeriod === 'today';

  // Debounced fetch - har bir eventda emas, 5 sekundda bir marta
  const debouncedFetchData = useMemo(
    () =>
      debounce(async () => {
        try {
          const filters: any = { period: selectedPeriod };
          if (selectedPeriod === 'custom' && customDateRange) {
            filters.startDate = customDateRange[0].format('YYYY-MM-DD');
            filters.endDate = customDateRange[1].format('YYYY-MM-DD');
          }
          const result = await dashboardService.getAdminStats(filters);
          setData(result);
          setLastUpdate(new Date());
        } catch (err) {
          console.error("Failed to refresh admin dashboard:", err);
        }
      }, 5000),
    [selectedPeriod, customDateRange]
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
  const { isConnected, connectionStats } = useAdminSSE({
    onAttendanceEvent: handleAttendanceEvent,
    enabled: isToday,
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const filters: any = { period: selectedPeriod };
        if (selectedPeriod === 'custom' && customDateRange) {
          filters.startDate = customDateRange[0].format('YYYY-MM-DD');
          filters.endDate = customDateRange[1].format('YYYY-MM-DD');
        }
        const result = await dashboardService.getAdminStats(filters);
        setData(result);
        setLastUpdate(new Date());
        // Reset realtime events when period changes
        if (!isToday) {
          setRealtimeEvents([]);
        }
      } catch (err) {
        console.error("Failed to load admin dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedPeriod, customDateRange, isToday]);

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
      dataIndex: "attendancePercent",
      key: "attendance",
      width: 120,
      sorter: (a: SchoolStats, b: SchoolStats) => a.attendancePercent - b.attendancePercent,
      render: (percent: number) => {
        const status = getStatus(percent);
        return (
          <div style={{ 
            background: `${status.color}15`, 
            padding: "4px 8px", 
            borderRadius: 4,
            textAlign: "center",
            border: `1px solid ${status.color}30`
          }}>
            <Text strong style={{ color: status.color, fontSize: 16 }}>{percent}%</Text>
          </div>
        );
      },
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
      title: "Kech",
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
      title: "Yo'q",
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
        const notPresent = record.totalStudents - record.presentToday;
        
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
                  <Text type="secondary">Kelganlar:</Text>
                  <Text strong style={{ color: "#52c41a" }}>{record.presentToday} ({record.attendancePercent}%)</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kech qolganlar:</Text>
                  <Text strong style={{ color: "#faad14" }}>{record.lateToday}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kelmaganlar:</Text>
                  <Text strong style={{ color: "#ff4d4f" }}>{record.absentToday}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Hozir maktabda:</Text>
                  <Text strong style={{ color: "#722ed1" }}>{record.currentlyInSchool}</Text>
                </div>
                <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 8, marginTop: 8 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {status.text === "Yaxshi" && "Davomat 90% dan yuqori - ajoyib!"}
                    {status.text === "Normal" && "Davomat 75-90% orasida - yaxshi"}
                    {status.text === "Muammo" && `Davomat 75% dan past - ${notPresent} o'quvchi kelmagan`}
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
      {/* Kompakt Header - School Admin uslubida */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {/* Vaqt filterlari */}
          <Segmented
            size="small"
            value={selectedPeriod}
            onChange={(value) => {
              setSelectedPeriod(value as PeriodType);
              if (value !== 'custom') setCustomDateRange(null);
            }}
            options={PERIOD_OPTIONS}
          />
          
          {/* Custom date range picker */}
          {selectedPeriod === 'custom' || customDateRange ? (
            <RangePicker
              size="small"
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
              style={{ width: 220 }}
            />
          ) : null}

          <div style={{ width: 1, height: 24, background: "#e8e8e8" }} />

          {/* Real vaqt ulanish holati (faqat bugun uchun) */}
          {isToday && (
            <Tooltip title={isConnected ? `Real vaqt ulanishi faol${connectionStats ? ` (${connectionStats.total} ulanish)` : ''}` : "Real vaqt ulanishi yo'q"}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 4,
                padding: "2px 8px",
                borderRadius: 4,
                background: isConnected ? "#f6ffed" : "#fff2f0",
                border: `1px solid ${isConnected ? "#b7eb8f" : "#ffccc7"}`
              }}>
                <Badge status={isConnected ? "success" : "error"} />
                <WifiOutlined style={{ color: isConnected ? "#52c41a" : "#ff4d4f", fontSize: 12 }} />
                {isConnected && <SyncOutlined spin style={{ color: "#52c41a", fontSize: 10 }} />}
              </div>
            </Tooltip>
          )}

          {/* Vaqt */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ClockCircleOutlined style={{ fontSize: 16, color: "#1890ff" }} />
            <Text strong style={{ fontSize: 16 }}>{currentTime.format("HH:mm")}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {currentTime.format("DD MMM, ddd")}
            </Text>
            {lastUpdate && (
              <Text type="secondary" style={{ fontSize: 10, marginLeft: 8 }}>
                (yangilandi: {dayjs(lastUpdate).format("HH:mm:ss")})
              </Text>
            )}
          </div>

          <div style={{ width: 1, height: 24, background: "#e8e8e8" }} />

          {/* Statistikalar */}
          <Tooltip title="Jami maktablar">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <BankOutlined style={{ color: "#722ed1" }} />
              <Text strong style={{ fontSize: 16, color: "#722ed1" }}>{totals.totalSchools}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>maktab</Text>
            </div>
          </Tooltip>

          <Tooltip title="Jami o'quvchilar">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <TeamOutlined style={{ color: "#1890ff" }} />
              <Text strong style={{ fontSize: 16, color: "#1890ff" }}>{totals.totalStudents}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>o'quvchi</Text>
            </div>
          </Tooltip>

          <Tooltip title={`Umumiy davomat`}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text strong style={{ fontSize: 16, color: "#52c41a" }}>{totals.attendancePercent}%</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>davomat</Text>
            </div>
          </Tooltip>

          <Tooltip title="Kelganlar">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircleOutlined style={{ color: "#52c41a" }} />
              <Text strong style={{ fontSize: 16, color: "#52c41a" }}>{totals.presentToday}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>kelgan</Text>
            </div>
          </Tooltip>

          <Tooltip title="Kech qolganlar">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ClockCircleOutlined style={{ color: "#faad14" }} />
              <Text strong style={{ fontSize: 16, color: "#faad14" }}>{totals.lateToday}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>kech</Text>
            </div>
          </Tooltip>

          <Tooltip title="Kelmaganlar">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CloseCircleOutlined style={{ color: "#ff4d4f" }} />
              <Text strong style={{ fontSize: 16, color: "#ff4d4f" }}>{totals.absentToday}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>yo'q</Text>
            </div>
          </Tooltip>

          {problemSchools.length > 0 && (
            <>
              <div style={{ width: 1, height: 20, background: "#e8e8e8" }} />
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
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: "block" }}>
                      Maktabni bosib batafsil ko'ring
                    </Text>
                  </div>
                }
                trigger="hover"
                placement="bottomRight"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff2f0", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>
                  <WarningOutlined style={{ color: "#ff4d4f" }} />
                  <Text strong style={{ fontSize: 16, color: "#ff4d4f" }}>{problemSchools.length}</Text>
                  <Text type="secondary" style={{ fontSize: 11 }}>muammo</Text>
                </div>
              </Popover>
            </>
          )}
        </div>
      </Card>

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
                <Bar dataKey="late" fill="#faad14" name="Kech" />
                <Bar dataKey="absent" fill="#ff4d4f" name="Kelmagan" />
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

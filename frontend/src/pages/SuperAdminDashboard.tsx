import React, { useEffect, useState } from "react";
import {
  Card,
  Tag,
  Spin,
  Empty,
  Tooltip,
  Typography,
  Table,
  Popover,
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
import dayjs from "dayjs";

const { Text } = Typography;

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

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(dayjs());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(dayjs()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await dashboardService.getAdminStats();
        setData(result);
      } catch (err) {
        console.error("Failed to load admin dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
    if (percent >= 90) return { color: "#52c41a", text: "Yaxshi", icon: "🟢" };
    if (percent >= 75) return { color: "#faad14", text: "Normal", icon: "🟡" };
    return { color: "#ff4d4f", text: "Muammo", icon: "🔴" };
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
                {status.icon} {record.name} - {status.text}
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
                {status.icon} {status.text}
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
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {/* Vaqt */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ClockCircleOutlined style={{ fontSize: 16, color: "#1890ff" }} />
            <Text strong style={{ fontSize: 16 }}>{currentTime.format("HH:mm")}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <CalendarOutlined style={{ marginRight: 4 }} />
              {currentTime.format("DD MMM, ddd")}
            </Text>
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
    </div>
  );
};

export default SuperAdminDashboard;

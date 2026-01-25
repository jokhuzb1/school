import React, { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Table, Tag, Spin, Empty } from "antd";
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend } from "recharts";
import { useSchool } from "../hooks/useSchool";
import { dashboardService } from "../services/dashboard";
import type { DashboardStats, AttendanceEvent } from "../types";
import dayjs from "dayjs";

const COLORS = ["#52c41a", "#faad14", "#ff4d4f"];

const Dashboard: React.FC = () => {
  const { schoolId } = useSchool();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!schoolId) return;
      setLoading(true);
      try {
        const [statsData, eventsData] = await Promise.all([
          dashboardService.getStats(schoolId),
          dashboardService.getRecentEvents(schoolId, 10),
        ]);
        setStats(statsData);
        setEvents(eventsData);
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [schoolId]);

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
    { name: "Present", value: stats.presentToday - stats.lateToday },
    { name: "Late", value: stats.lateToday },
    { name: "Absent", value: stats.absentToday },
  ].filter((d) => d.value > 0);

  const eventColumns = [
    {
      title: "Student",
      dataIndex: ["student", "name"],
      key: "student",
      render: (_: any, record: AttendanceEvent) =>
        record.student?.name || "Unknown",
    },
    {
      title: "Time",
      dataIndex: "timestamp",
      key: "time",
      render: (time: string) => dayjs(time).format("HH:mm"),
    },
    {
      title: "Type",
      dataIndex: "eventType",
      key: "type",
      render: (type: string) => (
        <Tag color={type === "IN" ? "green" : "blue"}>{type}</Tag>
      ),
    },
    {
      title: "Class",
      dataIndex: ["student", "class", "name"],
      key: "class",
      render: (_: any, record: AttendanceEvent) =>
        record.student?.class?.name || "-",
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Students"
              value={stats.totalStudents}
              prefix={<TeamOutlined style={{ color: "#1890ff" }} />}
              styles={{ content: { color: "#1890ff" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Present Today"
              value={stats.presentToday}
              suffix={`(${stats.presentPercentage}%)`}
              prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Late Today"
              value={stats.lateToday}
              prefix={<ClockCircleOutlined style={{ color: "#faad14" }} />}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Absent Today"
              value={stats.absentToday}
              prefix={<CloseCircleOutlined style={{ color: "#ff4d4f" }} />}
              styles={{ content: { color: "#ff4d4f" } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Attendance Distribution">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label
                  >
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="No attendance data" />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent Activity">
            <Table
              dataSource={events}
              columns={eventColumns}
              rowKey="id"
              pagination={false}
              size="small"
              locale={{ emptyText: "No recent activity" }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;

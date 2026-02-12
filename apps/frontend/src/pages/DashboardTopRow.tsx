import React from "react";
import { Button, Card, Calendar, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
} from "recharts";
import type { AttendanceEvent, PeriodType } from "@shared/types";
import {
  EVENT_TYPE_BG,
  EVENT_TYPE_COLOR,
  EVENT_TYPE_TAG,
} from "../entities/attendance";
import { getEventStudentLabel, PIE_COLORS } from "./dashboard.utils";

const { Text } = Typography;

type DashboardTopRowProps = {
  pieData: Array<{ name: string; value: number }>;
  pieHasData: boolean;
  events: AttendanceEvent[];
  onOpenHistory: () => void;
  navigateToStudent: (event: AttendanceEvent) => void;
  selectedPeriod: PeriodType;
  customDateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  setCustomDateRange: (range: [dayjs.Dayjs, dayjs.Dayjs]) => void;
  setSelectedPeriod: (period: PeriodType) => void;
};

export const DashboardTopRow: React.FC<DashboardTopRowProps> = ({
  pieData,
  pieHasData,
  events,
  onOpenHistory,
  navigateToStudent,
  selectedPeriod,
  customDateRange,
  setCustomDateRange,
  setSelectedPeriod,
}) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
    <Col xs={24} sm={12} lg={8}>
      <Card title="Davomat taqsimoti" size="small" styles={{ body: { height: 240 } }}>
        <div style={{ height: 220 }}>
          {pieHasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={40} outerRadius={65} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || "#d9d9d9"} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </div>
      </Card>
    </Col>

    <Col xs={24} sm={12} lg={8}>
      <Card
        title="Oxirgi faoliyat"
        size="small"
        styles={{ body: { height: 240, overflowY: "auto", padding: "8px 12px" } }}
        extra={
          <Button size="small" onClick={onOpenHistory}>
            Tarix
          </Button>
        }
      >
        {events.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {events.slice(0, 8).map((event) => {
              const eventTag = EVENT_TYPE_TAG[event.eventType];
              const studentId = event.student?.id || event.studentId;
              const isClickable = Boolean(studentId);
              return (
                <div
                  key={event.id}
                  role={isClickable ? "button" : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onClick={() => {
                    if (isClickable) navigateToStudent(event);
                  }}
                  onKeyDown={(e) => {
                    if (!isClickable) return;
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      navigateToStudent(event);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "5px 8px",
                    background: EVENT_TYPE_BG[event.eventType],
                    borderRadius: 4,
                    borderLeft: `3px solid ${EVENT_TYPE_COLOR[event.eventType]}`,
                    cursor: isClickable ? "pointer" : "default",
                  }}
                >
                  <Tag icon={eventTag.icon} color={eventTag.color} style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>
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
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Empty description="Faoliyat yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </Card>
    </Col>

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
        <div style={{ transform: "scale(0.9)", transformOrigin: "top left", width: "111%", padding: "0 8px" }}>
          <Calendar
            fullscreen={false}
            onSelect={(date) => {
              setCustomDateRange([date, date]);
              setSelectedPeriod("custom");
            }}
            value={selectedPeriod === "custom" && customDateRange ? customDateRange[0] : dayjs()}
          />
        </div>
      </Card>
    </Col>
  </Row>
);

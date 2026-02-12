import React from "react";
import { Badge, Calendar, Card, Col, Empty, Row, Space, Tag, Typography } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer } from "recharts";
import dayjs, { Dayjs } from "dayjs";
import type { AttendanceEvent, PeriodType } from "@shared/types";
import { EVENT_TYPE_BG, EVENT_TYPE_COLOR, EVENT_TYPE_TAG } from "../entities/attendance";
import { buildStudentPieData } from "./studentDetail.utils";

const { Text } = Typography;

type StudentDetailTopRowProps = {
  stats: { total: number; present: number; late: number; absent: number; excused: number };
  events: AttendanceEvent[];
  dateCellRender: (date: Dayjs) => React.ReactNode;
  selectedPeriod: PeriodType;
  customDateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  setCustomDateRange: (range: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
  setSelectedPeriod: (period: PeriodType) => void;
};

export const StudentDetailTopRow: React.FC<StudentDetailTopRowProps> = ({
  stats,
  events,
  dateCellRender,
  selectedPeriod,
  customDateRange,
  setCustomDateRange,
  setSelectedPeriod,
}) => {
  const pieData = buildStudentPieData(stats);

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
      <Col xs={24} sm={12} lg={8}>
        <Card title="Davomat taqsimoti" size="small" styles={{ body: { height: 240 } }}>
          {stats.total > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="45%" innerRadius={40} outerRadius={65} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
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
        </Card>
      </Col>

      <Col xs={24} sm={12} lg={8}>
        <Card title="Oxirgi faoliyat" size="small" styles={{ body: { height: 240, overflowY: "auto" } }}>
          {events.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {events.slice(0, 8).map((event) => {
                const isIn = event.eventType === "IN";
                const eventType = isIn ? "IN" : "OUT";
                const eventTag = EVENT_TYPE_TAG[eventType];

                return (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 8px",
                      background: EVENT_TYPE_BG[eventType],
                      borderRadius: 4,
                      borderLeft: `3px solid ${EVENT_TYPE_COLOR[eventType]}`,
                    }}
                  >
                    <Tag icon={eventTag.icon} color={eventTag.color} style={{ margin: 0, fontSize: 11, padding: "0 6px" }}>
                      {eventTag.text}
                    </Tag>
                    <Text strong style={{ fontSize: 13 }}>
                      {dayjs(event.timestamp).format("HH:mm")}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {dayjs(event.timestamp).format("DD/MM")}
                    </Text>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
          extra={
            <Space size={4} style={{ fontSize: 10 }}>
              <Badge color="green" text="K" />
              <Badge color="orange" text="Ke" />
              <Badge color="red" text="Yo" />
            </Space>
          }
        >
          <div style={{ transform: "scale(0.9)", transformOrigin: "top left", width: "111%", padding: "0 8px" }}>
            <Calendar
              fullscreen={false}
              cellRender={dateCellRender}
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
};

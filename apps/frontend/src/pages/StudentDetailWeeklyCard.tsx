import React from "react";
import { Card, Col, Empty, Row } from "antd";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { STATUS_COLORS } from "../entities/attendance";

type WeeklyDataItem = {
  date: string;
  dayName: string;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

type StudentDetailWeeklyCardProps = {
  weeklyData: WeeklyDataItem[];
};

export const StudentDetailWeeklyCard: React.FC<StudentDetailWeeklyCardProps> = ({ weeklyData }) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
    <Col xs={24}>
      <Card title="Haftalik davomat dinamikasi (oxirgi 7 kun)" size="small" styles={{ body: { height: 200 } }}>
        <div style={{ height: 180 }}>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} ticks={[0, 1]} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="present" stroke={STATUS_COLORS.PRESENT} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Kelgan" />
                <Line type="monotone" dataKey="late" stroke={STATUS_COLORS.LATE} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Kech qoldi" />
                <Line type="monotone" dataKey="absent" stroke={STATUS_COLORS.ABSENT} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} name="Kelmadi" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Empty description="Ma'lumot yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          )}
        </div>
      </Card>
    </Col>
  </Row>
);

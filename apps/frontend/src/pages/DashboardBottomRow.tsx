import React from "react";
import { Card, Col, Empty, List, Row, Tag, Typography } from "antd";
import { WarningOutlined } from "@ant-design/icons";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import type { DashboardStats } from "@shared/types";
import { STATUS_COLORS } from "../entities/attendance";

const { Text } = Typography;

type WeeklyDataItem = {
  date: string;
  dayName: string;
  present: number;
  late: number;
  absent: number;
};

type DashboardBottomRowProps = {
  weeklyData: WeeklyDataItem[];
  notYetArrivedCount: number;
  pendingEarlyCount: number;
  latePendingCount: number;
  stats: DashboardStats;
};

export const DashboardBottomRow: React.FC<DashboardBottomRowProps> = ({
  weeklyData,
  notYetArrivedCount,
  pendingEarlyCount,
  latePendingCount,
  stats,
}) => (
  <Row gutter={[12, 12]}>
    <Col xs={24} lg={notYetArrivedCount > 0 ? 16 : 24}>
      <Card title="Haftalik davomat dinamikasi" size="small" styles={{ body: { height: 200 } }}>
        <div style={{ height: 180 }}>
          {weeklyData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <RechartsTooltip />
                <Line type="monotone" dataKey="present" stroke={STATUS_COLORS.PRESENT} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kelgan" />
                <Line type="monotone" dataKey="late" stroke={STATUS_COLORS.LATE} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kech qoldi" />
                <Line type="monotone" dataKey="absent" stroke={STATUS_COLORS.ABSENT} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} name="Kelmadi" />
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

    <Col xs={24} lg={8}>
      <Card
        title={
          <span>
            <WarningOutlined style={{ color: "#faad14" }} /> Kutilayotganlar ({notYetArrivedCount}){" "}
            <Text type="secondary" style={{ fontSize: 11 }}>
              Hali kelmagan: {pendingEarlyCount} · Kechikmoqda: {latePendingCount}
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
                    <Tag color="gold" style={{ fontSize: 10, marginLeft: "auto" }}>
                      Kechikmoqda
                    </Tag>
                  ) : (
                    <Tag color="default" style={{ fontSize: 10, marginLeft: "auto" }}>
                      Hali kelmagan
                    </Tag>
                  )}
                  <Tag style={{ fontSize: 10, marginLeft: 6 }}>{item.className}</Tag>
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
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Empty description="Hozircha yo'q" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
      </Card>
    </Col>
  </Row>
);

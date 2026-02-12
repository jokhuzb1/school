import React from "react";
import { Avatar, Badge, Button, Card, Col, Row, Space, Tag, Tooltip, Typography } from "antd";
import { ExclamationCircleOutlined, UserOutlined } from "@ant-design/icons";
import { getAssetUrl } from "@shared/config";
import type { Student } from "@shared/types";
import { STATUS_COLORS } from "../entities/attendance";

const { Title, Text } = Typography;

type StudentDetailHeaderProps = {
  student: Student;
  isConnected: boolean;
  stats: { total: number; present: number; late: number; absent: number; excused: number };
};

export const StudentDetailHeader: React.FC<StudentDetailHeaderProps> = ({ student, isConnected, stats }) => (
  <Card
    size="small"
    style={{
      marginBottom: 16,
      borderRadius: 8,
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      border: "1px solid #f0f0f0",
    }}
  >
    <Row gutter={16} align="middle" wrap={false} style={{ overflowX: "auto", padding: "4px 0" }}>
      <Col flex="none">
        <div style={{ display: "flex", alignItems: "center", gap: 16, paddingLeft: 8 }}>
          <Avatar size={56} src={getAssetUrl(student.photoUrl)} icon={<UserOutlined />} style={{ border: "2px solid #1890ff" }} />
          <div>
            <Title level={4} style={{ margin: 0, color: "#262626" }}>
              {student.name}
            </Title>
            <Space size={8} style={{ marginTop: 4 }}>
              <Tag color="blue" bordered={false} style={{ borderRadius: 4 }}>
                {student.class?.name || "Sinf yo'q"}
              </Tag>
              <Tooltip title={isConnected ? "Jonli ulangan" : "Oflayn"}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Badge status={isConnected ? "success" : "error"} />
                </div>
              </Tooltip>
            </Space>
          </div>
        </div>
      </Col>

      <Col flex="none">
        <div style={{ width: 1, height: 48, background: "#f0f0f0", margin: "0 12px" }} />
      </Col>

      <Col flex="auto">
        <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#262626" }}>{stats.total}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Jami kun
            </Text>
          </div>

          <div style={{ width: 1, height: 24, background: "#f0f0f0" }} />

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.PRESENT }}>{stats.present}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Kelgan
            </Text>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.LATE }}>{stats.late}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Kech qoldi
            </Text>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.ABSENT }}>{stats.absent}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Kelmadi
            </Text>
          </div>

          {(stats.excused || 0) > 0 && (
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COLORS.EXCUSED }}>{stats.excused}</div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Sababli
              </Text>
            </div>
          )}
        </div>
      </Col>

      <Col flex="none" style={{ paddingRight: 8 }}>
        <Tooltip title={`ID: ${student.deviceStudentId || "-"} | Otasining ismi: ${student.fatherName || "-"} (${student.parentPhone || "-"})`}>
          <Button type="default" shape="circle" icon={<ExclamationCircleOutlined />} />
        </Tooltip>
      </Col>
    </Row>
  </Card>
);

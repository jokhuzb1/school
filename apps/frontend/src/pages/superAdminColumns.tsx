import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Popover, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { EFFECTIVE_STATUS_META, STATUS_COLORS, StatusBar } from "../entities/attendance";
import type { SchoolStats } from "./superAdminTypes";

const { Text } = Typography;

const getStatus = (percent: number) => {
  if (percent >= 90) return { color: STATUS_COLORS.PRESENT, text: "Yaxshi", icon: "" };
  if (percent >= 75) return { color: "#faad14", text: "Normal", icon: "" };
  return { color: STATUS_COLORS.ABSENT, text: "Muammo", icon: "" };
};

export function buildSuperAdminColumns(): ColumnsType<SchoolStats> {
  return [
    {
      title: "#",
      key: "rank",
      width: 40,
      render: (_unused: unknown, _record: SchoolStats, index: number) => (
        <Text strong style={{ color: index < 3 ? "#1890ff" : "#8c8c8c" }}>
          {index + 1}
        </Text>
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
          <Text type="secondary" style={{ fontSize: 11 }}>
            {record.address || "Manzil kiritilmagan"}
          </Text>
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
          <Text type="secondary" style={{ fontSize: 10 }}>
            o'quvchi
          </Text>
        </div>
      ),
    },
    {
      title: "Davomat",
      key: "attendance",
      width: 120,
      sorter: (a: SchoolStats, b: SchoolStats) => a.attendancePercent - b.attendancePercent,
      render: (_unused: unknown, record: SchoolStats) => (
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
      render: (_unused: unknown, record: SchoolStats) => (
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
      render: (count: number) =>
        count > 0 ? (
          <Tag color="warning" style={{ margin: 0 }}>
            <ClockCircleOutlined /> {count}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "Kelmadi",
      dataIndex: "absentToday",
      key: "absent",
      width: 70,
      render: (count: number) =>
        count > 0 ? (
          <Tag color="error" style={{ margin: 0 }}>
            <CloseCircleOutlined /> {count}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "Holat",
      key: "status",
      width: 100,
      render: (_unused: unknown, record: SchoolStats) => {
        const status = getStatus(record.attendancePercent);
        const notPresent =
          record.totalStudents - (record.presentToday + record.lateToday + (record.excusedToday || 0));
        return (
          <Popover
            placement="left"
            title={<span style={{ color: status.color }}>{record.name} - {status.text}</span>}
            content={
              <div style={{ minWidth: 180 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Jami o'quvchilar:</Text>
                  <Text strong>{record.totalStudents}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kelganlar (jami):</Text>
                  <Text strong style={{ color: STATUS_COLORS.PRESENT }}>
                    {record.presentToday + record.lateToday} ({record.attendancePercent}%)
                  </Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kech qoldi:</Text>
                  <Text strong style={{ color: STATUS_COLORS.LATE }}>{record.lateToday}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kechikmoqda:</Text>
                  <Text strong style={{ color: EFFECTIVE_STATUS_META.PENDING_LATE.color }}>
                    {record.latePendingCount || 0}
                  </Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Kelmadi:</Text>
                  <Text strong style={{ color: STATUS_COLORS.ABSENT }}>{record.absentToday}</Text>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Text type="secondary">Hali kelmagan:</Text>
                  <Text strong style={{ color: EFFECTIVE_STATUS_META.PENDING_EARLY.color }}>
                    {record.pendingEarlyCount || 0}
                  </Text>
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
              <Text style={{ color: status.color }}>{status.text}</Text>
            </div>
          </Popover>
        );
      },
    },
    {
      title: "",
      key: "action",
      width: 40,
      render: () => <RightOutlined style={{ color: EFFECTIVE_STATUS_META.PENDING_EARLY.color }} />,
    },
  ];
}

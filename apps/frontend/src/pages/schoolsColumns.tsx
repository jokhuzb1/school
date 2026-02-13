import {
  BankOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  PhoneOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { StatusBar } from "../entities/attendance";
import type { School } from "@shared/types";

const { Text } = Typography;

type Params = {
  onEdit: (record: School) => void;
  onDelete: (id: string) => void;
  onOpenSchool: (school: School) => void;
};

export function buildSchoolsColumns({
  onEdit,
  onDelete,
  onOpenSchool,
}: Params): ColumnsType<School> {
  return [
    {
      title: "Maktab",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: School) => (
        <div>
          <Space>
            <BankOutlined style={{ color: "#1890ff" }} />
            <Text strong>{name}</Text>
          </Space>
          {record.address && (
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                <EnvironmentOutlined /> {record.address}
              </Text>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "O'quvchilar",
      key: "students",
      width: 120,
      render: (_unused: unknown, record: School) => (
        <div style={{ textAlign: "center" }}>
          <Text strong style={{ color: "#1890ff" }}>
            {record._count?.students || 0}
          </Text>
          <br />
          <Text type="secondary" style={{ fontSize: 10 }}>
            o'quvchi
          </Text>
        </div>
      ),
    },
    {
      title: "Sinflar",
      key: "classes",
      width: 100,
      render: (_unused: unknown, record: School) => (
        <div style={{ textAlign: "center" }}>
          <Text strong>{record._count?.classes || 0}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 10 }}>
            sinf
          </Text>
        </div>
      ),
    },
    {
      title: "Davomat",
      key: "attendance",
      width: 160,
      render: (_unused: unknown, record: School) => {
        const stats = record.todayStats;
        const totalFromStats = stats
          ? (stats.present || 0) +
            (stats.late || 0) +
            (stats.absent || 0) +
            (stats.pendingEarly || 0) +
            (stats.pendingLate || 0) +
            (stats.excused || 0)
          : 0;
        const total = stats ? totalFromStats : record._count?.students || 0;
        return (
          <div>
            <StatusBar
              total={total}
              present={stats?.present || 0}
              late={stats?.late || 0}
              absent={stats?.absent || 0}
              pendingEarly={stats?.pendingEarly || 0}
              pendingLate={stats?.pendingLate || 0}
              excused={stats?.excused || 0}
              height={10}
            />
            <Space size={4} style={{ marginTop: 6 }}>
              <Tag color="success" style={{ fontSize: 10, padding: "0 4px", margin: 0 }}>
                <CheckCircleOutlined /> {stats?.present || 0}
              </Tag>
              <Tag color="warning" style={{ fontSize: 10, padding: "0 4px", margin: 0 }}>
                <ClockCircleOutlined /> {stats?.late || 0}
              </Tag>
              <Tag color="gold" style={{ fontSize: 10, padding: "0 4px", margin: 0 }}>
                <ClockCircleOutlined /> {stats?.pendingLate || 0}
              </Tag>
              <Tag color="default" style={{ fontSize: 10, padding: "0 4px", margin: 0 }}>
                <CloseCircleOutlined /> {stats?.pendingEarly || 0}
              </Tag>
              <Tag color="error" style={{ fontSize: 10, padding: "0 4px", margin: 0 }}>
                <CloseCircleOutlined /> {stats?.absent || 0}
              </Tag>
            </Space>
          </div>
        );
      },
    },
    {
      title: "Telefon",
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (p: string) =>
        p ? (
          <Space>
            <PhoneOutlined style={{ color: "#8c8c8c" }} />
            <Text>{p}</Text>
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "",
      key: "actions",
      width: 100,
      render: (_unused: unknown, record: School) => (
        <Space size={4}>
          <Tooltip title="Tahrirlash">
            <Button
              size="small"
              icon={<EditOutlined />}
              aria-label="Maktabni tahrirlash"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(record);
              }}
            />
          </Tooltip>
          <Popconfirm
            title="Maktabni o'chirish?"
            description="Barcha ma'lumotlar o'chiriladi!"
            onConfirm={() => onDelete(record.id)}
            okText="Ha"
            cancelText="Yo'q"
          >
            <Tooltip title="O'chirish">
              <Button
                size="small"
                icon={<DeleteOutlined />}
                aria-label="Maktabni o'chirish"
                danger
                onClick={(e) => e.stopPropagation()}
              />
            </Tooltip>
          </Popconfirm>
          <Tooltip title="Boshqaruv">
            <Button
              size="small"
              icon={<RightOutlined />}
              aria-label="Maktab boshqaruv sahifasi"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSchool(record);
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];
}

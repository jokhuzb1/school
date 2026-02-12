import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  EnvironmentOutlined,
  LoginOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Device } from "@shared/types";

const { Text } = Typography;

type Params = {
  canManage: boolean;
  onEdit: (record: Device) => void;
  onDelete: (id: string) => void;
};

export function buildDevicesColumns({
  canManage,
  onEdit,
  onDelete,
}: Params): ColumnsType<Device> {
  return [
    {
      title: "Nomi",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Device) => (
        <Space>
          <Text strong>{name}</Text>
          {record.location && (
            <Tooltip title={record.location}>
              <EnvironmentOutlined style={{ color: "#8c8c8c" }} aria-hidden="true" />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "Qurilma ID",
      dataIndex: "deviceId",
      key: "deviceId",
      render: (id: string) => (
        <Text copyable={{ text: id }} style={{ fontSize: 12 }}>
          {id}
        </Text>
      ),
    },
    {
      title: "Turi",
      dataIndex: "type",
      key: "type",
      width: 100,
      render: (t: string) => (
        <Tag
          icon={t === "ENTRANCE" ? <LoginOutlined /> : <LogoutOutlined />}
          color={t === "ENTRANCE" ? "success" : "processing"}
        >
          {t === "ENTRANCE" ? "Kirish" : "Chiqish"}
        </Tag>
      ),
    },
    {
      title: "Holat",
      key: "status",
      width: 100,
      render: (_unused: unknown, record: Device) => {
        const isOnline = record.lastSeenAt && dayjs().diff(dayjs(record.lastSeenAt), "hour") < 2;
        return (
          <Tag
            icon={isOnline ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
            color={isOnline ? "success" : "error"}
          >
            {isOnline ? "Onlayn" : "Oflayn"}
          </Tag>
        );
      },
    },
    {
      title: "Oxirgi faoliyat",
      dataIndex: "lastSeenAt",
      key: "lastSeen",
      render: (t: string) =>
        t ? (
          <Tooltip title={dayjs(t).format("DD MMM YYYY, HH:mm:ss")}>
            <Text type="secondary">{dayjs(t).format("DD MMM HH:mm")}</Text>
          </Tooltip>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    ...(canManage
      ? [
          {
            title: "",
            key: "actions",
            width: 80,
            render: (_unused: unknown, record: Device) => (
              <Space size={4}>
                <Tooltip title="Tahrirlash">
                  <Button
                    size="small"
                    icon={<EditOutlined />}
                    aria-label="Qurilmani tahrirlash"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(record);
                    }}
                  />
                </Tooltip>
                <Popconfirm
                  title="Qurilmani o'chirish?"
                  onConfirm={() => onDelete(record.id)}
                  okText="Ha"
                  cancelText="Yo'q"
                >
                  <Tooltip title="O'chirish">
                    <Button
                      size="small"
                      icon={<DeleteOutlined />}
                      aria-label="Qurilmani o'chirish"
                      danger
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Tooltip>
                </Popconfirm>
              </Space>
            ),
          },
        ]
      : []),
  ];
}

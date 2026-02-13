import {
  DeleteOutlined,
  EditOutlined,
  LinkOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { User } from "@entities/user";

const { Text } = Typography;

type Params = {
  onEdit: (user: User) => void;
  onAssign: (user: User) => void;
  onDelete: (id: string) => void;
};

export function buildUsersColumns({
  onEdit,
  onAssign,
  onDelete,
}: Params): ColumnsType<User> {
  return [
    {
      title: "Ism",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: User) => (
        <Space>
          {record.role === "TEACHER" ? (
            <UserOutlined style={{ color: "#1890ff" }} />
          ) : (
            <SafetyCertificateOutlined style={{ color: "#52c41a" }} />
          )}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string) => <Text type="secondary">{email}</Text>,
    },
    {
      title: "Rol",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "TEACHER" ? "blue" : "green"}>
          {role === "TEACHER" ? "O'qituvchi" : "Nazoratchi"}
        </Tag>
      ),
    },
    {
      title: "Amallar",
      key: "actions",
      width: 150,
      render: (_unused: unknown, record: User) => (
        <Space>
          <Tooltip title="Tahrirlash">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(record);
              }}
            />
          </Tooltip>
          {record.role === "TEACHER" && (
            <Tooltip title="Sinfga biriktirish">
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  onAssign(record);
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Rostdan o'chirmoqchimisiz?"
            onConfirm={(e) => {
              e?.stopPropagation();
              onDelete(record.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];
}


import { DeleteOutlined, GiftOutlined } from "@ant-design/icons";
import { Button, Popconfirm, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type { Holiday } from "@shared/types";

const { Text } = Typography;

export function buildHolidayColumns(
  handleDelete: (id: string) => void,
): ColumnsType<Holiday> {
  return [
    {
      title: "Sana",
      dataIndex: "date",
      key: "date",
      width: 140,
      render: (d: string) => {
        const date = dayjs(d);
        const isUpcoming = date.isAfter(dayjs());
        const isPast = date.isBefore(dayjs());
        const isToday = date.isSame(dayjs(), "day");

        return (
          <Space>
            <Text strong={isToday} type={isPast ? "secondary" : undefined}>
              {date.format("DD MMM, YYYY")}
            </Text>
            {isToday && <Tag color="green">Bugun</Tag>}
            {isUpcoming && !isToday && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                ({date.diff(dayjs(), "day")} kun)
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      title: "Nomi",
      dataIndex: "name",
      key: "name",
      render: (name: string) => (
        <Space>
          <GiftOutlined style={{ color: "#eb2f96" }} />
          <Text>{name}</Text>
        </Space>
      ),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_, record) => (
        <Popconfirm
          title="Bayramni o'chirish?"
          onConfirm={() => handleDelete(record.id)}
          okText="Ha"
          cancelText="Yo'q"
        >
          <Tooltip title="O'chirish">
            <Button size="small" icon={<DeleteOutlined />} danger />
          </Tooltip>
        </Popconfirm>
      ),
    },
  ];
}

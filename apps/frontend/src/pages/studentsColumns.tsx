import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Popconfirm, Progress, Space, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  getEffectiveStatusTagConfig,
  STATUS_COLORS,
} from "../entities/attendance";
import { getAssetUrl } from "@shared/config";
import type { Class, EffectiveAttendanceStatus, Student } from "@shared/types";

const { Text } = Typography;

type Params = {
  isSingleDay: boolean;
  canEditOrDeleteStudent: boolean;
  onOpen: (studentId: string) => void;
  onEdit: (student: Student) => void;
  onDelete: (studentId: string) => Promise<void>;
};

export function buildStudentsColumns(params: Params): ColumnsType<Student> {
  const { isSingleDay, canEditOrDeleteStudent, onOpen, onEdit, onDelete } = params;
  return [
    {
      title: "",
      dataIndex: "photoUrl",
      key: "photo",
      width: 50,
      render: (url: string) => <Avatar src={getAssetUrl(url)} icon={<UserOutlined />} size="small" />,
    },
    {
      title: "ID",
      dataIndex: "deviceStudentId",
      key: "id",
      width: 70,
      render: (id: string) => <Text type="secondary" style={{ fontSize: 11 }}>{id || "-"}</Text>,
    },
    {
      title: "Ism",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Sinf",
      dataIndex: "class",
      key: "class",
      width: 80,
      render: (cls: Class | undefined) =>
        cls?.name ? <Tag>{cls.name}</Tag> : <Text type="secondary">-</Text>,
    },
    ...(isSingleDay
      ? [
          {
            title: "Holat",
            key: "status",
            width: 140,
            render: (_unused: unknown, record: Student) => {
              const effectiveStatus = record.todayEffectiveStatus || record.todayStatus;
              if (!effectiveStatus) return <Tag color="default">-</Tag>;
              const config = getEffectiveStatusTagConfig(effectiveStatus as EffectiveAttendanceStatus);
              const time = record.todayFirstScan
                ? new Date(record.todayFirstScan).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
                : "";
              return (
                <Tag color={config.color} icon={config.icon}>
                  {config.text} {time && `(${time})`}
                </Tag>
              );
            },
          } as any,
        ]
      : [
          {
            title: "Davomat %",
            key: "attendancePercent",
            width: 120,
            sorter: (a: any, b: any) => (a.periodStats?.attendancePercent || 0) - (b.periodStats?.attendancePercent || 0),
            render: (_unused: unknown, record: any) => {
              const percent = record.periodStats?.attendancePercent || 0;
              return (
                <Progress
                  percent={percent}
                  size="small"
                  status={percent >= 80 ? "success" : percent >= 60 ? "normal" : "exception"}
                  format={(p) => `${p}%`}
                />
              );
            },
          },
          {
            title: <span style={{ color: STATUS_COLORS.PRESENT }}><CheckCircleOutlined /> Kelgan</span>,
            key: "present",
            width: 80,
            align: "center" as const,
            render: (_unused: unknown, record: any) => (
              <Text style={{ color: STATUS_COLORS.PRESENT }}>{record.periodStats?.presentCount || 0}</Text>
            ),
          },
          {
            title: <span style={{ color: STATUS_COLORS.LATE }}><ClockCircleOutlined /> Kech qoldi</span>,
            key: "late",
            width: 80,
            align: "center" as const,
            render: (_unused: unknown, record: any) => (
              <Text style={{ color: STATUS_COLORS.LATE }}>{record.periodStats?.lateCount || 0}</Text>
            ),
          },
          {
            title: <span style={{ color: STATUS_COLORS.ABSENT }}><CloseCircleOutlined /> Yo'q</span>,
            key: "absent",
            width: 80,
            align: "center" as const,
            render: (_unused: unknown, record: any) => (
              <Text style={{ color: STATUS_COLORS.ABSENT }}>{record.periodStats?.absentCount || 0}</Text>
            ),
          },
          {
            title: "Kunlar",
            key: "totalDays",
            width: 70,
            align: "center" as const,
            render: (_unused: unknown, record: any) => <Text type="secondary">{record.periodStats?.totalDays || 0}</Text>,
          },
        ]),
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_unused: unknown, record: Student) => (
        <Space size={4}>
          <Button size="small" onClick={(e) => { e.stopPropagation(); onOpen(record.id); }}>
            Ko'rish
          </Button>
          {canEditOrDeleteStudent && (
            <Button size="small" onClick={(e) => { e.stopPropagation(); onEdit(record); }}>
              Tahrir
            </Button>
          )}
          {canEditOrDeleteStudent && (
            <Popconfirm
              title="O'quvchini o'chirish?"
              description="Bu o'quvchining barcha ma'lumotlari o'chiriladi."
              onConfirm={() => onDelete(record.id)}
              okText="Ha"
              cancelText="Yo'q"
            >
              <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} style={{ display: "inline-block" }}>
                <Button size="small" danger icon={<DeleteOutlined />} aria-label="O'quvchini o'chirish" />
              </div>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
}

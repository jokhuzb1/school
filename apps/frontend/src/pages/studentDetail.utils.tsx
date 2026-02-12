import { ClockCircleOutlined, LoginOutlined, LogoutOutlined } from "@ant-design/icons";
import { Space, Tag } from "antd";
import dayjs from "dayjs";
import type { DailyAttendance, EffectiveAttendanceStatus } from "@shared/types";
import { EFFECTIVE_STATUS_COLORS, EFFECTIVE_STATUS_LABELS, STATUS_COLORS } from "../entities/attendance";

export const formatDuration = (minutes: number) => {
  if (!minutes) return "-";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours} soat ${mins} daqiqa`;
  return `${mins} daqiqa`;
};

export const buildStudentPieData = (stats: {
  present: number;
  late: number;
  absent: number;
  excused: number;
}) =>
  [
    { name: "Kelgan", value: stats.present, color: STATUS_COLORS.PRESENT },
    { name: "Kech qoldi", value: stats.late, color: STATUS_COLORS.LATE },
    { name: "Kelmadi", value: stats.absent, color: STATUS_COLORS.ABSENT },
    { name: "Sababli", value: stats.excused, color: STATUS_COLORS.EXCUSED },
  ].filter((d) => d.value > 0);

export const buildStudentWeeklyData = (attendance: DailyAttendance[]) =>
  Array.from({ length: 7 }).map((_, idx) => {
    const date = dayjs().subtract(6 - idx, "day");
    const dateStr = date.format("YYYY-MM-DD");
    const record = attendance.find((a) => dayjs(a.date).format("YYYY-MM-DD") === dateStr);
    return {
      date: dateStr,
      dayName: date.format("dd"),
      present: record && record.status === "PRESENT" ? 1 : 0,
      late: record && record.status === "LATE" ? 1 : 0,
      absent: record && record.status === "ABSENT" ? 1 : 0,
      excused: record && record.status === "EXCUSED" ? 1 : 0,
    };
  });

export const buildStudentAttendanceColumns = () => [
  {
    title: "Sana",
    dataIndex: "date",
    key: "date",
    render: (d: string) => dayjs(d).format("DD MMM, YYYY"),
  },
  {
    title: "Holat",
    dataIndex: "status",
    key: "status",
    render: (s: EffectiveAttendanceStatus, record: DailyAttendance) => (
      <Space>
        <Tag color={EFFECTIVE_STATUS_COLORS[s]}>{EFFECTIVE_STATUS_LABELS[s]}</Tag>
        {record.currentlyInSchool && (
          <Tag icon={<LoginOutlined />} color="purple">
            Maktabda
          </Tag>
        )}
      </Space>
    ),
  },
  {
    title: "Kirdi",
    dataIndex: "firstScanTime",
    key: "arrived",
    render: (t: string) =>
      t ? (
        <>
          <LoginOutlined style={{ color: "#52c41a", marginRight: 4 }} />
          {dayjs(t).format("HH:mm")}
        </>
      ) : (
        "-"
      ),
  },
  {
    title: "Chiqdi",
    dataIndex: "lastOutTime",
    key: "left",
    render: (t: string) =>
      t ? (
        <>
          <LogoutOutlined style={{ color: "#1890ff", marginRight: 4 }} />
          {dayjs(t).format("HH:mm")}
        </>
      ) : (
        "-"
      ),
  },
  {
    title: "Maktabda",
    dataIndex: "totalTimeOnPremises",
    key: "timeInSchool",
    render: (m: number | null) =>
      m ? (
        <>
          <ClockCircleOutlined style={{ marginRight: 4 }} />
          {formatDuration(m)}
        </>
      ) : (
        "-"
      ),
  },
  {
    title: "Kechikish",
    dataIndex: "lateMinutes",
    key: "late",
    render: (m: number | null) => (m ? <Tag color="orange">{m} daqiqa</Tag> : "-"),
  },
  {
    title: "Izoh",
    dataIndex: "notes",
    key: "notes",
    render: (n: string) => n || "-",
  },
];

import { Tag, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import type {
  AttendanceStatus,
  DailyAttendance,
  EffectiveAttendanceStatus,
} from "@shared/types";
import { getAssetUrl } from "@shared/config";
import {
  ATTENDANCE_STATUS_TAG,
  EFFECTIVE_STATUS_COLORS,
  EFFECTIVE_STATUS_LABELS,
} from "../entities/attendance";

type Params = {
  canEdit: boolean;
  isTeacher: boolean;
  onStatusChange: (record: DailyAttendance, status: AttendanceStatus) => void;
};

export function buildAttendanceColumns({
  canEdit,
  isTeacher,
  onStatusChange,
}: Params): ColumnsType<DailyAttendance> {
  return [
    {
      title: "Rasm",
      dataIndex: ["student", "photoUrl"],
      key: "photo",
      render: (url: string) =>
        url ? (
          <img
            src={getAssetUrl(url)}
            alt="o'quvchi"
            style={{ width: 40, height: 40, objectFit: "cover", borderRadius: "50%" }}
          />
        ) : null,
    },
    { title: "O'quvchi", dataIndex: ["student", "name"], key: "student" },
    { title: "Sinf", dataIndex: ["student", "class", "name"], key: "class" },
    {
      title: "Holat",
      dataIndex: "status",
      key: "status",
      render: (status: EffectiveAttendanceStatus, record: DailyAttendance) => {
        if (!canEdit) {
          return <Tag color={EFFECTIVE_STATUS_COLORS[status] || "default"}>{EFFECTIVE_STATUS_LABELS[status] || "-"}</Tag>;
        }
        const options = [
          { value: "PRESENT", label: <Tag color={ATTENDANCE_STATUS_TAG.PRESENT.color}>{ATTENDANCE_STATUS_TAG.PRESENT.text}</Tag>, disabled: isTeacher },
          { value: "LATE", label: <Tag color={ATTENDANCE_STATUS_TAG.LATE.color}>{ATTENDANCE_STATUS_TAG.LATE.text}</Tag>, disabled: isTeacher },
          { value: "ABSENT", label: <Tag color={ATTENDANCE_STATUS_TAG.ABSENT.color}>{ATTENDANCE_STATUS_TAG.ABSENT.text}</Tag>, disabled: isTeacher },
          { value: "EXCUSED", label: <Tag color={ATTENDANCE_STATUS_TAG.EXCUSED.color}>{ATTENDANCE_STATUS_TAG.EXCUSED.text}</Tag>, disabled: false },
        ];
        return (
          <Select
            value={status === "PENDING_EARLY" || status === "PENDING_LATE" ? undefined : status}
            placeholder="Kutilmoqda"
            size="small"
            style={{ width: 100 }}
            onChange={(val) => onStatusChange(record, val as AttendanceStatus)}
            options={options}
            allowClear={false}
          />
        );
      },
    },
    { title: "Izoh", dataIndex: "notes", key: "notes", render: (notes: string) => notes || "-" },
    { title: "Birinchi skan", dataIndex: "firstScanTime", key: "first", render: (t: string) => (t ? dayjs(t).format("HH:mm") : "-") },
    { title: "Oxirgi skan", dataIndex: "lastScanTime", key: "last", render: (t: string) => (t ? dayjs(t).format("HH:mm") : "-") },
    { title: "Kechikish", dataIndex: "lateMinutes", key: "late", render: (m: number | null) => (m ? `${m} daq` : "-") },
  ];
}

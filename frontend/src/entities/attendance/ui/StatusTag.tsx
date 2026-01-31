import React from "react";
import { Tag } from "antd";
import type { AttendanceStatus, EventType } from "../../../types";
import dayjs from "dayjs";
import {
  ATTENDANCE_STATUS_TAG,
  EVENT_TYPE_TAG,
  STATUS_COLORS,
} from "../../../shared/attendance";
import { getEventTagStyle, getStatusTagStyle } from "../../../shared/ui";

// Status konfiguratsiyasi (shared mapping)
const STATUS_CONFIG = ATTENDANCE_STATUS_TAG;

interface StatusTagProps {
  status: AttendanceStatus;
  showIcon?: boolean;
  time?: string | null;
  size?: "small" | "default";
}

/**
 * Davomat status tag'i - Standart dizayn
 */
const StatusTag: React.FC<StatusTagProps> = ({
  status,
  showIcon = true,
  time,
  size = "default",
}) => {
  const config = STATUS_CONFIG[status];
  if (!config) return <Tag>-</Tag>;

  const timeStr = time ? dayjs(time).format("HH:mm") : "";
  const style = getStatusTagStyle(size);

  return (
    <Tag color={config.color} icon={showIcon ? config.icon : undefined} style={style}>
      {config.text}
      {timeStr && ` (${timeStr})`}
    </Tag>
  );
};

// Event type konfiguratsiyasi (shared mapping)
const EVENT_CONFIG = EVENT_TYPE_TAG;

interface EventTagProps {
  eventType: EventType;
  showIcon?: boolean;
  size?: "small" | "default";
}

/**
 * Event type tag'i (IN/OUT)
 */
const EventTag: React.FC<EventTagProps> = ({
  eventType,
  showIcon = true,
  size = "default",
}) => {
  const config = EVENT_CONFIG[eventType];
  if (!config) return <Tag>-</Tag>;

  const style = getEventTagStyle(size);

  return (
    <Tag color={config.color} icon={showIcon ? config.icon : undefined} style={style}>
      {config.text}
    </Tag>
  );
};

// Status colors export (boshqa joylarda ishlatish uchun)
export const statusColors: Record<AttendanceStatus, string> = STATUS_COLORS;

export { StatusTag, EventTag, STATUS_CONFIG, EVENT_CONFIG };
export default StatusTag;

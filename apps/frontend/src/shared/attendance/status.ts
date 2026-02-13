import React, { type ReactNode } from "react";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import type {
  AttendanceStatus,
  EffectiveAttendanceStatus,
  EventType,
} from "@shared/types";

export const ATTENDANCE_STATUS_TAG: Record<
  AttendanceStatus,
  { color: string; text: string; icon: ReactNode }
> = {
  PRESENT: {
    color: "green",
    text: "Kelgan",
    icon: React.createElement(CheckCircleOutlined),
  },
  LATE: {
    color: "orange",
    text: "Kech qoldi",
    icon: React.createElement(ClockCircleOutlined),
  },
  ABSENT: {
    color: "red",
    text: "Kelmadi",
    icon: React.createElement(CloseCircleOutlined),
  },
  EXCUSED: {
    color: "gray",
    text: "Sababli",
    icon: React.createElement(ExclamationCircleOutlined),
  },
};

export const EFFECTIVE_STATUS_META: Record<
  EffectiveAttendanceStatus,
  { color: string; bg: string; text: string }
> = {
  PRESENT: { color: "#52c41a", bg: "#f6ffed", text: "Kelgan" },
  LATE: { color: "#fa8c16", bg: "#fff7e6", text: "Kech qoldi" },
  ABSENT: { color: "#ff4d4f", bg: "#fff2f0", text: "Kelmadi" },
  EXCUSED: { color: "#8c8c8c", bg: "#f5f5f5", text: "Sababli" },
  PENDING_EARLY: { color: "#bfbfbf", bg: "#fafafa", text: "Hali kelmagan" },
  PENDING_LATE: { color: "#fadb14", bg: "#fffbe6", text: "Kechikmoqda" },
};

export const EFFECTIVE_STATUS_COLORS = Object.fromEntries(
  Object.entries(EFFECTIVE_STATUS_META).map(([key, value]) => [
    key,
    value.color,
  ]),
) as Record<EffectiveAttendanceStatus, string>;

export const EFFECTIVE_STATUS_LABELS = Object.fromEntries(
  Object.entries(EFFECTIVE_STATUS_META).map(([key, value]) => [
    key,
    value.text,
  ]),
) as Record<EffectiveAttendanceStatus, string>;

export const EFFECTIVE_STATUS_TAG: Record<
  EffectiveAttendanceStatus,
  { color: string; text: string }
> = Object.fromEntries(
  Object.entries(EFFECTIVE_STATUS_META).map(([key, value]) => [
    key,
    { color: value.color, text: value.text },
  ]),
) as Record<EffectiveAttendanceStatus, { color: string; text: string }>;

export const EVENT_TYPE_TAG: Record<
  EventType,
  { color: string; text: string; icon: ReactNode }
> = {
  IN: {
    color: "success",
    text: "KIRDI",
    icon: React.createElement(LoginOutlined),
  },
  OUT: {
    color: "processing",
    text: "CHIQDI",
    icon: React.createElement(LogoutOutlined),
  },
};

export const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: "#52c41a",
  LATE: "#fa8c16",
  ABSENT: "#ff4d4f",
  EXCUSED: "#8c8c8c",
};

export const EVENT_TYPE_COLOR = {
  IN: STATUS_COLORS.PRESENT,
  OUT: "#1890ff",
} as const;

export const EVENT_TYPE_BG: Record<EventType, string> = {
  IN: "#f6ffed",
  OUT: "#e6f7ff",
};

export const STATUS_BAR_COLORS = {
  present: "#52c41a",
  late: "#fa8c16",
  absent: "#ff4d4f",
  pendingLate: "#fadb14",
  pendingEarly: "#d9d9d9",
  excused: "#8c8c8c",
} as const;

export const ATTENDANCE_STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
}> = [
  { value: "PRESENT", label: ATTENDANCE_STATUS_TAG.PRESENT.text },
  { value: "LATE", label: ATTENDANCE_STATUS_TAG.LATE.text },
  { value: "ABSENT", label: ATTENDANCE_STATUS_TAG.ABSENT.text },
  { value: "EXCUSED", label: ATTENDANCE_STATUS_TAG.EXCUSED.text },
];

export const EFFECTIVE_STATUS_OPTIONS: Array<{
  value: EffectiveAttendanceStatus;
  label: string;
}> = [
  { value: "PRESENT", label: EFFECTIVE_STATUS_META.PRESENT.text },
  { value: "LATE", label: EFFECTIVE_STATUS_META.LATE.text },
  { value: "ABSENT", label: EFFECTIVE_STATUS_META.ABSENT.text },
  { value: "PENDING_LATE", label: EFFECTIVE_STATUS_META.PENDING_LATE.text },
  { value: "PENDING_EARLY", label: EFFECTIVE_STATUS_META.PENDING_EARLY.text },
  { value: "EXCUSED", label: EFFECTIVE_STATUS_META.EXCUSED.text },
];

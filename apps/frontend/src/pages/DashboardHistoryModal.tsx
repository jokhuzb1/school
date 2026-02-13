import React from "react";
import { Button, DatePicker, Empty, List, Modal, Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
import type { AttendanceEvent } from "@shared/types";
import { EVENT_TYPE_TAG } from "../entities/attendance";
import { getEventStudentLabel } from "./dashboard.utils";

const { RangePicker } = DatePicker;
const { Text } = Typography;

type DashboardHistoryModalProps = {
  open: boolean;
  onClose: () => void;
  historyLoading: boolean;
  historyRange: [dayjs.Dayjs, dayjs.Dayjs];
  setHistoryRange: (range: [dayjs.Dayjs, dayjs.Dayjs]) => void;
  onSearch: () => void;
  historyEvents: AttendanceEvent[];
  navigateToStudent: (event: AttendanceEvent) => void;
};

export const DashboardHistoryModal: React.FC<DashboardHistoryModalProps> = ({
  open,
  onClose,
  historyLoading,
  historyRange,
  setHistoryRange,
  onSearch,
  historyEvents,
  navigateToStudent,
}) => (
  <Modal
    title="Faoliyat tarixi"
    open={open}
    onCancel={onClose}
    footer={[
      <Button key="refresh" onClick={onSearch} loading={historyLoading}>
        Yangilash
      </Button>,
      <Button key="close" onClick={onClose}>
        Yopish
      </Button>,
    ]}
    width={640}
  >
    <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
      <RangePicker
        value={historyRange}
        onChange={(range) => {
          if (range && range[0] && range[1]) setHistoryRange([range[0], range[1]]);
        }}
        format="DD.MM.YYYY"
      />
      <Button onClick={onSearch} loading={historyLoading}>
        Qidirish
      </Button>
    </div>
    {historyEvents.length > 0 ? (
      <List
        size="small"
        dataSource={historyEvents.slice(0, 200)}
        renderItem={(event) => {
          const eventTag = EVENT_TYPE_TAG[event.eventType];
          const studentId = event.student?.id || event.studentId;
          const isClickable = Boolean(studentId);
          return (
            <List.Item
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onClick={() => {
                if (isClickable) navigateToStudent(event);
              }}
              onKeyDown={(e) => {
                if (!isClickable) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  navigateToStudent(event);
                }
              }}
              style={{ cursor: isClickable ? "pointer" : "default" }}
            >
              <Space size={8}>
                <Tag color={eventTag.color} style={{ margin: 0 }}>
                  {eventTag.text}
                </Tag>
                <Text strong style={{ fontSize: 12 }}>
                  {dayjs(event.timestamp).format("DD/MM HH:mm:ss")}
                </Text>
                <Text style={{ fontSize: 12 }}>{getEventStudentLabel(event)}</Text>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  {event.student?.class?.name || ""}
                </Text>
              </Space>
            </List.Item>
          );
        }}
      />
    ) : (
      <Empty description={historyLoading ? "Yuklanmoqda..." : "Ma'lumot yo'q"} />
    )}
  </Modal>
);

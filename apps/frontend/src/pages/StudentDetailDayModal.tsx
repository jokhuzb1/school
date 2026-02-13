import React from "react";
import { Empty, Modal, Space, Tag, Typography } from "antd";
import { LoginOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { AttendanceEvent, DailyAttendance } from "@shared/types";
import { EFFECTIVE_STATUS_COLORS, EFFECTIVE_STATUS_LABELS, EVENT_TYPE_BG, EVENT_TYPE_COLOR, EVENT_TYPE_TAG } from "../entities/attendance";
import { formatDuration } from "./studentDetail.utils";

const { Text } = Typography;

type StudentDetailDayModalProps = {
  selectedRecord: DailyAttendance | null;
  open: boolean;
  onClose: () => void;
  getEventsForDate: (date: string) => AttendanceEvent[];
};

export const StudentDetailDayModal: React.FC<StudentDetailDayModalProps> = ({
  selectedRecord,
  open,
  onClose,
  getEventsForDate,
}) => (
  <Modal
    title={
      selectedRecord && (
        <Space>
          <span>{dayjs(selectedRecord.date).format("DD MMMM, YYYY")}</span>
          <Tag color={EFFECTIVE_STATUS_COLORS[selectedRecord.status]}>{EFFECTIVE_STATUS_LABELS[selectedRecord.status]}</Tag>
          {selectedRecord.currentlyInSchool && (
            <Tag icon={<LoginOutlined />} color="purple">
              Hozir maktabda
            </Tag>
          )}
        </Space>
      )
    }
    open={open}
    onCancel={onClose}
    footer={null}
    width={500}
  >
    {selectedRecord && (
      <div>
        <div style={{ display: "flex", gap: 16, marginBottom: 16, padding: 12, background: "#fafafa", borderRadius: 8 }}>
          <div>
            <Text type="secondary">Kirdi</Text>
            <div>
              <Text strong>{selectedRecord.firstScanTime ? dayjs(selectedRecord.firstScanTime).format("HH:mm") : "-"}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary">Chiqdi</Text>
            <div>
              <Text strong>{selectedRecord.lastOutTime ? dayjs(selectedRecord.lastOutTime).format("HH:mm") : "-"}</Text>
            </div>
          </div>
          <div>
            <Text type="secondary">Maktabda</Text>
            <div>
              <Text strong>{formatDuration(selectedRecord.totalTimeOnPremises || 0)}</Text>
            </div>
          </div>
          {selectedRecord.lateMinutes && selectedRecord.lateMinutes > 0 && (
            <div>
              <Text type="secondary">Kechikish</Text>
              <div>
                <Tag color="orange">{selectedRecord.lateMinutes} daqiqa</Tag>
              </div>
            </div>
          )}
        </div>

        <Text strong style={{ display: "block", marginBottom: 8 }}>
          Kirdi-Chiqdi tarixi
        </Text>
        {(() => {
          const dayEvents = getEventsForDate(selectedRecord.date);
          if (dayEvents.length === 0) {
            return <Empty description="Bu kunda kirdi-chiqdi ma'lumoti yo'q" />;
          }
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayEvents.map((event) => {
                const eventType = event.eventType === "IN" ? "IN" : "OUT";
                const eventTag = EVENT_TYPE_TAG[eventType];
                return (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 14px",
                      background: EVENT_TYPE_BG[eventType],
                      borderRadius: 8,
                      borderLeft: `4px solid ${EVENT_TYPE_COLOR[eventType]}`,
                    }}
                  >
                    <Tag icon={eventTag.icon} color={eventTag.color} style={{ margin: 0 }}>
                      {eventTag.text}
                    </Tag>
                    <Text strong style={{ fontSize: 16 }}>
                      {dayjs(event.timestamp).format("HH:mm:ss")}
                    </Text>
                    {event.device?.name && <Text type="secondary">{event.device.name}</Text>}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    )}
  </Modal>
);

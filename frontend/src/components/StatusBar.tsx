import React from "react";
import { Tooltip, Typography } from "antd";

const { Text } = Typography;

type StatusBarProps = {
  total: number;
  present: number;
  late: number;
  absent: number;
  pendingEarly?: number;
  pendingLate?: number;
  excused?: number;
  height?: number;
};

const colors = {
  present: "#52c41a",
  late: "#fa8c16",
  absent: "#ff4d4f",
  pendingLate: "#fadb14",
  pendingEarly: "#d9d9d9",
  excused: "#8c8c8c",
};

const StatusBar: React.FC<StatusBarProps> = ({
  total,
  present,
  late,
  absent,
  pendingEarly = 0,
  pendingLate = 0,
  excused = 0,
  height = 8,
}) => {
  if (!total || total <= 0) {
    return <Text type="secondary">-</Text>;
  }

  const segments = [
    { key: "present", label: "Kelgan", value: present, color: colors.present },
    { key: "late", label: "Kech qoldi", value: late, color: colors.late },
    {
      key: "pendingLate",
      label: "Kechikmoqda",
      value: pendingLate,
      color: colors.pendingLate,
    },
    { key: "absent", label: "Kelmadi", value: absent, color: colors.absent },
    {
      key: "pendingEarly",
      label: "Hali kelmagan",
      value: pendingEarly,
      color: colors.pendingEarly,
    },
    { key: "excused", label: "Sababli", value: excused, color: colors.excused },
  ].filter((s) => s.value > 0);

  const tooltip = (
    <div>
      <div>
        <Text>Kelgan:</Text> <Text strong>{present}</Text>
      </div>
      <div>
        <Text>Kech qoldi:</Text> <Text strong>{late}</Text>
      </div>
      <div>
        <Text>Kechikmoqda:</Text> <Text strong>{pendingLate}</Text>
      </div>
      <div>
        <Text>Kelmadi:</Text> <Text strong>{absent}</Text>
      </div>
      <div>
        <Text>Hali kelmagan:</Text> <Text strong>{pendingEarly}</Text>
      </div>
      {excused > 0 && (
        <div>
          <Text>Sababli:</Text> <Text strong>{excused}</Text>
        </div>
      )}
      <div style={{ marginTop: 6 }}>
        <Text type="secondary">Jami: {total}</Text>
      </div>
    </div>
  );

  return (
    <Tooltip title={tooltip}>
      <div
        style={{
          display: "flex",
          height,
          borderRadius: 4,
          overflow: "hidden",
          background: "#f0f0f0",
        }}
      >
        {segments.map((seg) => (
          <div
            key={seg.key}
            style={{
              width: `${(seg.value / total) * 100}%`,
              background: seg.color,
            }}
          />
        ))}
      </div>
    </Tooltip>
  );
};

export default StatusBar;

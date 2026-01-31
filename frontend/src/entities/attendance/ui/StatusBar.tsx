import React from "react";
import { Tooltip, Typography } from "antd";
import { STATUS_BAR_COLORS } from "../../../shared/attendance";
import {
  statusBarContainerStyle,
  statusBarTotalStyle,
  getStatusBarSegmentStyle,
} from "../../../shared/ui";

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
    {
      key: "present",
      label: "Kelgan",
      value: present,
      color: STATUS_BAR_COLORS.present,
    },
    {
      key: "late",
      label: "Kech qoldi",
      value: late,
      color: STATUS_BAR_COLORS.late,
    },
    {
      key: "pendingLate",
      label: "Kechikmoqda",
      value: pendingLate,
      color: STATUS_BAR_COLORS.pendingLate,
    },
    {
      key: "absent",
      label: "Kelmadi",
      value: absent,
      color: STATUS_BAR_COLORS.absent,
    },
    {
      key: "pendingEarly",
      label: "Hali kelmagan",
      value: pendingEarly,
      color: STATUS_BAR_COLORS.pendingEarly,
    },
    {
      key: "excused",
      label: "Sababli",
      value: excused,
      color: STATUS_BAR_COLORS.excused,
    },
  ].filter((s) => s.value > 0);

  const tooltip = renderTooltip({
    present,
    late,
    pendingLate,
    absent,
    pendingEarly,
    excused,
    total,
  });

  return (
    <Tooltip title={tooltip}>
      <div style={{ ...statusBarContainerStyle, height }}>
        {segments.map((seg) => (
          <div
            key={seg.key}
            style={getStatusBarSegmentStyle(seg.value, total, seg.color)}
          />
        ))}
      </div>
    </Tooltip>
  );
};

export default StatusBar;

function renderTooltip(params: {
  present: number;
  late: number;
  pendingLate: number;
  absent: number;
  pendingEarly: number;
  excused: number;
  total: number;
}) {
  const { present, late, pendingLate, absent, pendingEarly, excused, total } =
    params;
  return (
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
      <div style={statusBarTotalStyle}>
        <Text type="secondary">Jami: {total}</Text>
      </div>
    </div>
  );
}

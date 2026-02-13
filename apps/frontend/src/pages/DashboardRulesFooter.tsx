import React from "react";
import { Card, Typography } from "antd";
import type { School } from "@shared/types";

const { Text } = Typography;

type DashboardRulesFooterProps = {
  school: School | null;
};

export const DashboardRulesFooter: React.FC<DashboardRulesFooterProps> = ({ school }) => {
  if (!school) return null;

  return (
    <Card size="small" style={{ marginTop: 16, background: "#fafafa" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", color: "#666" }}>
        <Text type="secondary">
          <strong>Kech qolish:</strong> sinf boshlanishidan {school.lateThresholdMinutes} daqiqa keyin
        </Text>
        <Text type="secondary">
          <strong>Kelmadi:</strong> darsdan {school.absenceCutoffMinutes} daqiqa o'tgach avtomatik belgilanadi
          scan qilmasa
        </Text>
      </div>
    </Card>
  );
};

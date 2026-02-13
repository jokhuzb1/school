import React from "react";
import {
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined,
  LoginOutlined,
} from "@ant-design/icons";
import type { DashboardStats } from "@shared/types";
import { PageHeader, StatItem, StatGroup } from "../shared/ui";
import { EFFECTIVE_STATUS_META, STATUS_COLORS } from "../entities/attendance";

type DashboardStatsHeaderProps = {
  stats: DashboardStats;
  latePendingCount: number;
  pendingEarlyCount: number;
};

export const DashboardStatsHeader: React.FC<DashboardStatsHeaderProps> = ({
  stats,
  latePendingCount,
  pendingEarlyCount,
}) => (
  <PageHeader>
    <StatGroup>
      <StatItem
        icon={<TeamOutlined />}
        label="jami"
        value={stats.totalStudents}
        color="#1890ff"
        tooltip="Jami o'quvchilar"
      />
      <StatItem
        icon={<CheckCircleOutlined />}
        label="kelgan"
        value={stats.presentToday}
        color={STATUS_COLORS.PRESENT}
        tooltip={`Kelganlar (kelgan+kech) ${stats.presentPercentage}%`}
      />
      <StatItem
        icon={<ClockCircleOutlined />}
        label="kech qoldi"
        value={stats.lateToday}
        color={STATUS_COLORS.LATE}
        tooltip="Kech qolganlar (scan bilan)"
      />
      <StatItem
        icon={<CloseCircleOutlined />}
        label="kelmadi"
        value={stats.absentToday}
        color={STATUS_COLORS.ABSENT}
        tooltip="Kelmadi (cutoff o'tgan)"
      />
      {latePendingCount > 0 && (
        <StatItem
          icon={<ClockCircleOutlined />}
          label="kechikmoqda"
          value={latePendingCount}
          color={EFFECTIVE_STATUS_META.PENDING_LATE.color}
          tooltip="Dars boshlangan, cutoff o'tmagan"
        />
      )}
      {pendingEarlyCount > 0 && (
        <StatItem
          icon={<CloseCircleOutlined />}
          label="hali kelmagan"
          value={pendingEarlyCount}
          color={EFFECTIVE_STATUS_META.PENDING_EARLY.color}
          tooltip="Dars hali boshlanmagan"
        />
      )}
      {(stats.excusedToday || 0) > 0 && (
        <StatItem
          icon={<FileTextOutlined />}
          label="sababli"
          value={stats.excusedToday}
          color={STATUS_COLORS.EXCUSED}
          tooltip="Sababli"
        />
      )}
      <StatItem
        icon={<LoginOutlined />}
        label="maktabda"
        value={stats.currentlyInSchool || 0}
        color="#722ed1"
        tooltip="Hozir maktabda"
        highlight
      />
    </StatGroup>
  </PageHeader>
);

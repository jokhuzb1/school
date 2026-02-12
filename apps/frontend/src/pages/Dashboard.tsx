import React, { useCallback } from "react";
import { Empty, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import type { AttendanceEvent } from "@shared/types";
import { useSchool } from "@entities/school";
import { DashboardStatsHeader } from "./DashboardStatsHeader";
import { DashboardFilters } from "./DashboardFilters";
import { DashboardTopRow } from "./DashboardTopRow";
import { DashboardBottomRow } from "./DashboardBottomRow";
import { DashboardRulesFooter } from "./DashboardRulesFooter";
import { DashboardHistoryModal } from "./DashboardHistoryModal";
import { buildDashboardDerivedData } from "./dashboard.utils";
import { useDashboardPageState } from "./useDashboardPageState";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { schoolId } = useSchool();

  const navigateToStudent = useCallback(
    (event: AttendanceEvent) => {
      const studentId = event.student?.id || event.studentId;
      if (!studentId) return;
      if (!schoolId) return;
      navigate(`/schools/${schoolId}/students/${studentId}`);
    },
    [navigate, schoolId],
  );

  const {
    stats,
    events,
    historyOpen,
    historyLoading,
    historyRange,
    historyEvents,
    school,
    loading,
    classes,
    selectedClassId,
    selectedPeriod,
    customDateRange,
    attendanceScope,
    isToday,
    setHistoryRange,
    setSelectedClassId,
    setSelectedPeriod,
    setCustomDateRange,
    setAttendanceScope,
    openHistory,
    closeHistory,
    loadHistory,
  } = useDashboardPageState({ navigateToStudent });

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <Empty description="Ma'lumot mavjud emas" />;
  }

  const { pendingEarlyCount, latePendingCount, notYetArrivedCount, pieData, pieHasData, weeklyData } =
    buildDashboardDerivedData(stats);

  return (
    <div>
      <DashboardStatsHeader stats={stats} latePendingCount={latePendingCount} pendingEarlyCount={pendingEarlyCount} />

      <DashboardFilters
        selectedPeriod={selectedPeriod}
        customDateRange={customDateRange}
        setSelectedPeriod={setSelectedPeriod}
        setCustomDateRange={setCustomDateRange}
        isToday={isToday}
        attendanceScope={attendanceScope}
        setAttendanceScope={setAttendanceScope}
        selectedClassId={selectedClassId}
        setSelectedClassId={setSelectedClassId}
        classes={classes}
        stats={stats}
      />

      <DashboardTopRow
        pieData={pieData}
        pieHasData={pieHasData}
        events={events}
        onOpenHistory={openHistory}
        navigateToStudent={navigateToStudent}
        selectedPeriod={selectedPeriod}
        customDateRange={customDateRange}
        setCustomDateRange={(range) => setCustomDateRange(range)}
        setSelectedPeriod={setSelectedPeriod}
      />

      <DashboardBottomRow
        weeklyData={weeklyData}
        notYetArrivedCount={notYetArrivedCount}
        pendingEarlyCount={pendingEarlyCount}
        latePendingCount={latePendingCount}
        stats={stats}
      />

      <DashboardRulesFooter school={school} />

      <DashboardHistoryModal
        open={historyOpen}
        onClose={closeHistory}
        historyLoading={historyLoading}
        historyRange={historyRange}
        setHistoryRange={setHistoryRange}
        onSearch={loadHistory}
        historyEvents={historyEvents}
        navigateToStudent={navigateToStudent}
      />
    </div>
  );
};

export default Dashboard;


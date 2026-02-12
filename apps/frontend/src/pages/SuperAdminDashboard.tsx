import React, { useCallback, useEffect, useRef, useState } from "react";
import { Empty, Spin } from "antd";
import { useLocation, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { dashboardService } from "@features/dashboard";
import type { AttendanceScope, PeriodType } from "@shared/types";
import { useAdminSSE } from "@features/realtime";
import { useHeaderMeta } from "../shared/ui";
import { buildSuperAdminColumns } from "./superAdminColumns";
import { SuperAdminDashboardView } from "./SuperAdminDashboardView";
import type { AdminDashboardData, RealtimeEvent } from "./superAdminTypes";

const AUTO_REFRESH_MS = 60000;

const calcPercent = (present: number, late: number, total: number) =>
  total > 0 ? Math.round(((present + late) / total) * 100) : 0;

const SuperAdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>("started");
  const backState = { backTo: location.pathname };
  const { setMeta, setRefresh, setLastUpdated } = useHeaderMeta();
  const isToday = selectedPeriod === "today";

  const refreshData = useCallback(
    async (withLoading = false) => {
      if (withLoading) setLoading(true);
      try {
        const filters: any = { period: selectedPeriod };
        if (selectedPeriod === "custom" && customDateRange) {
          filters.startDate = customDateRange[0].format("YYYY-MM-DD");
          filters.endDate = customDateRange[1].format("YYYY-MM-DD");
        }
        if (selectedPeriod === "today") filters.scope = attendanceScope;
        setData(await dashboardService.getAdminStats(filters));
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to refresh admin dashboard:", err);
      } finally {
        if (withLoading) setLoading(false);
      }
    },
    [selectedPeriod, customDateRange, attendanceScope, setLastUpdated],
  );

  const handleAttendanceEvent = useCallback(
    (event: any) => {
      if (!isToday) return;
      const incomingId = event?.event?.id;
      if (incomingId) {
        const seen = seenEventIdsRef.current;
        if (seen.has(incomingId)) return;
        seen.add(incomingId);
        if (seen.size > 200) {
          const first = seen.values().next().value;
          if (first) seen.delete(first);
        }
      }
      const newEvent: RealtimeEvent = {
        id: event.event?.id || Date.now().toString(),
        schoolId: event.schoolId,
        schoolName: event.schoolName,
        studentName: event.event?.student?.name || "Noma'lum",
        eventType: event.event?.eventType || "IN",
        timestamp: event.event?.timestamp || new Date().toISOString(),
        className: event.event?.student?.class?.name,
      };
      setRealtimeEvents((prev) => [newEvent, ...prev].slice(0, 20));
    },
    [isToday],
  );

  const handleStatsUpdate = useCallback(
    (event: any) => {
      if (!isToday) return;
      if (event?.scope && event.scope !== attendanceScope) return;
      if (!event?.schoolId || !event?.data) return;

      setData((prevData) => {
        if (!prevData) return prevData;
        const updatedSchools = prevData.schools.map((school) => {
          if (school.id !== event.schoolId) return school;
          const totalStudents = event.data.totalStudents ?? school.totalStudents;
          const presentToday = event.data.presentToday ?? school.presentToday;
          const lateToday = event.data.lateToday ?? school.lateToday;
          const absentToday = event.data.absentToday ?? school.absentToday;
          const excusedToday = event.data.excusedToday ?? school.excusedToday;
          const pendingEarlyCount = event.data.pendingEarlyCount ?? school.pendingEarlyCount;
          const latePendingCount = event.data.latePendingCount ?? school.latePendingCount;
          const currentlyInSchool = event.data.currentlyInSchool ?? school.currentlyInSchool;
          return {
            ...school,
            totalStudents,
            presentToday,
            lateToday,
            absentToday,
            excusedToday,
            pendingEarlyCount,
            latePendingCount,
            currentlyInSchool,
            attendancePercent: calcPercent(presentToday, lateToday, totalStudents),
          };
        });
        const totals = updatedSchools.reduce(
          (acc, school) => ({
            totalSchools: acc.totalSchools + 1,
            totalStudents: acc.totalStudents + school.totalStudents,
            presentToday: acc.presentToday + school.presentToday,
            lateToday: acc.lateToday + school.lateToday,
            absentToday: acc.absentToday + school.absentToday,
            excusedToday: acc.excusedToday + (school.excusedToday || 0),
            pendingEarlyCount: acc.pendingEarlyCount + (school.pendingEarlyCount || 0),
            latePendingCount: acc.latePendingCount + (school.latePendingCount || 0),
            currentlyInSchool: acc.currentlyInSchool + school.currentlyInSchool,
          }),
          {
            totalSchools: 0,
            totalStudents: 0,
            presentToday: 0,
            lateToday: 0,
            absentToday: 0,
            excusedToday: 0,
            pendingEarlyCount: 0,
            latePendingCount: 0,
            currentlyInSchool: 0,
          },
        );
        return {
          ...prevData,
          schools: updatedSchools,
          totals: {
            ...prevData.totals,
            ...totals,
            attendancePercent: calcPercent(totals.presentToday, totals.lateToday, totals.totalStudents),
          },
        };
      });
      setLastUpdated(new Date());
    },
    [attendanceScope, isToday, setLastUpdated],
  );

  const { isConnected } = useAdminSSE({
    onAttendanceEvent: handleAttendanceEvent,
    onStatsUpdate: handleStatsUpdate,
    enabled: isToday,
  });

  useEffect(() => {
    refreshData(true);
    if (!isToday) setRealtimeEvents([]);
  }, [refreshData, isToday]);

  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => refreshData(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isToday, refreshData]);

  useEffect(() => {
    setMeta({ showLiveStatus: isToday, isConnected });
    return () => setMeta({ showLiveStatus: false, isConnected: false });
  }, [isToday, isConnected, setMeta]);

  const handleRefresh = useCallback(async () => {
    await refreshData(true);
  }, [refreshData]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin size="large" /></div>;
  }
  if (!data) return <Empty description="Ma'lumot yo'q" />;

  const { totals, schools, weeklyStats } = data;
  const sortedSchools = [...schools].sort((a, b) => {
    const numA = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
    const numB = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
    return numA - numB;
  });
  const problemSchools = schools.filter((s) => s.attendancePercent < 80);
  const columns = buildSuperAdminColumns();

  return (
    <SuperAdminDashboardView
      totals={totals}
      sortedSchools={sortedSchools}
      weeklyStats={weeklyStats}
      realtimeEvents={realtimeEvents}
      problemSchools={problemSchools}
      isConnected={isConnected}
      isToday={isToday}
      selectedPeriod={selectedPeriod}
      customDateRange={customDateRange}
      attendanceScope={attendanceScope}
      columns={columns}
      onPeriodChange={(period, customRange) => {
        setSelectedPeriod(period);
        setCustomDateRange(customRange);
      }}
      onScopeChange={setAttendanceScope}
      onOpenSchool={(schoolId, schoolName) => {
        navigate(`/schools/${schoolId}/dashboard`, {
          state: { ...backState, schoolName },
        });
      }}
    />
  );
};

export default SuperAdminDashboard;


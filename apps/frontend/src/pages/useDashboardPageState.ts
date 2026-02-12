import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dayjs from "dayjs";
import debounce from "lodash/debounce";
import { useSchool } from "@entities/school";
import { useAttendanceSSE } from "@features/realtime";
import { useSchoolSnapshotSSE, type SchoolSnapshotPayload } from "@features/realtime";
import { useClassSnapshotSSE, type ClassSnapshotPayload } from "@features/realtime";
import { dashboardService } from "@features/dashboard";
import { schoolsService } from "@entities/school";
import { classesService } from "@entities/class";
import type { AttendanceEvent, AttendanceScope, Class, DashboardStats, PeriodType, School } from "@shared/types";
import { useHeaderMeta } from "../shared/ui";

const AUTO_REFRESH_MS = 60000;

type UseDashboardPageStateParams = {
  navigateToStudent: (event: AttendanceEvent) => void;
};

export const useDashboardPageState = ({ navigateToStudent }: UseDashboardPageStateParams) => {
  const { schoolId } = useSchool();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRange, setHistoryRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(6, "day"),
    dayjs(),
  ]);
  const [historyEvents, setHistoryEvents] = useState<AttendanceEvent[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>("started");
  const { setMeta, setRefresh, setLastUpdated } = useHeaderMeta();

  const pendingEventsRef = useRef<{ inCount: number; outCount: number }>({ inCount: 0, outCount: 0 });
  const isToday = selectedPeriod === "today";
  const schoolSnapshotEnabled = isToday && !selectedClassId;
  const classSnapshotEnabled = isToday && !!selectedClassId;

  const fetchStats = useCallback(async () => {
    if (!schoolId) return;
    try {
      const filters: any = { period: selectedPeriod };
      if (selectedClassId) filters.classId = selectedClassId;
      if (selectedPeriod === "today") filters.scope = attendanceScope;
      if (selectedPeriod === "custom" && customDateRange) {
        filters.startDate = customDateRange[0].format("YYYY-MM-DD");
        filters.endDate = customDateRange[1].format("YYYY-MM-DD");
      }

      const statsData = await dashboardService.getStats(schoolId, filters);
      setStats(statsData);
      setLastUpdated(new Date());
      pendingEventsRef.current = { inCount: 0, outCount: 0 };
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    }
  }, [schoolId, selectedClassId, selectedPeriod, customDateRange, attendanceScope, setLastUpdated]);

  const debouncedFetchStats = useMemo(
    () => debounce(() => fetchStats(), 5000, { leading: false, trailing: true }),
    [fetchStats],
  );

  const handleSSEEvent = useCallback(
    (event: any) => {
      if (!isToday) return;

      const typedEvent = event as unknown as AttendanceEvent;
      const eventClassId = typedEvent.student?.classId;
      const matchesClass = !selectedClassId || (eventClassId && eventClassId === selectedClassId);

      if (matchesClass) setEvents((prev) => [typedEvent, ...prev].slice(0, 10));

      if (historyOpen) {
        const start = historyRange[0].startOf("day");
        const end = historyRange[1].endOf("day");
        const ts = dayjs(typedEvent.timestamp);
        if (ts.isAfter(start) && ts.isBefore(end)) setHistoryEvents((prev) => [typedEvent, ...prev]);
      }

      if (schoolSnapshotEnabled || classSnapshotEnabled) return;
      if (selectedClassId) {
        if (!matchesClass) return;
        debouncedFetchStats();
        return;
      }

      setStats((prevStats) => {
        if (!prevStats) return prevStats;
        const isIn = event.eventType === "IN";
        const newCurrentlyInSchool = isIn
          ? (prevStats.currentlyInSchool || 0) + 1
          : Math.max(0, (prevStats.currentlyInSchool || 0) - 1);

        if (isIn) pendingEventsRef.current.inCount++;
        else pendingEventsRef.current.outCount++;

        return { ...prevStats, currentlyInSchool: newCurrentlyInSchool };
      });

      debouncedFetchStats();
    },
    [debouncedFetchStats, isToday, selectedClassId, schoolSnapshotEnabled, classSnapshotEnabled, historyOpen, historyRange],
  );

  const handleSnapshot = useCallback(
    (snapshot: SchoolSnapshotPayload | ClassSnapshotPayload) => {
      if (snapshot.scope !== attendanceScope) return;
      setStats((prevStats) => {
        if (!snapshot?.stats) return prevStats;
        const totalStudents = snapshot.stats.totalStudents;
        const presentToday = snapshot.stats.present;
        const lateToday = snapshot.stats.late;
        const absentToday = snapshot.stats.absent;
        const excusedToday = snapshot.stats.excused;
        const currentlyInSchool = snapshot.stats.currentlyInSchool;
        const pendingEarlyCount = snapshot.stats.pendingEarly;
        const latePendingCount = snapshot.stats.pendingLate;
        const presentPercentage = totalStudents > 0 ? Math.round(((presentToday + lateToday) / totalStudents) * 100) : 0;

        if (!prevStats) {
          return {
            period: "today",
            periodLabel: "Bugun",
            startDate: snapshot.timestamp,
            endDate: snapshot.timestamp,
            daysCount: 1,
            totalStudents,
            presentToday,
            lateToday,
            absentToday,
            excusedToday,
            presentPercentage,
            currentlyInSchool,
            pendingEarlyCount,
            latePendingCount,
            notYetArrivedCount: pendingEarlyCount + latePendingCount,
            weeklyStats: snapshot.weeklyStats || [],
          };
        }

        return {
          ...prevStats,
          totalStudents,
          presentToday,
          lateToday,
          absentToday,
          excusedToday,
          currentlyInSchool,
          pendingEarlyCount,
          latePendingCount,
          notYetArrivedCount: pendingEarlyCount + latePendingCount,
          presentPercentage,
          weeklyStats: snapshot.weeklyStats || prevStats.weeklyStats,
        };
      });
      setLastUpdated(new Date());
    },
    [attendanceScope, setLastUpdated],
  );

  const { isConnected } = useAttendanceSSE(schoolId, { onEvent: handleSSEEvent, enabled: isToday });
  useSchoolSnapshotSSE(schoolId, { onSnapshot: handleSnapshot, enabled: schoolSnapshotEnabled });
  useClassSnapshotSSE(schoolId, selectedClassId || null, { onSnapshot: handleSnapshot, enabled: classSnapshotEnabled });

  const loadDashboard = useCallback(
    async (withLoading = true) => {
      if (!schoolId) return;
      if (withLoading) setLoading(true);
      try {
        const filters: any = { period: selectedPeriod };
        if (selectedClassId) filters.classId = selectedClassId;
        if (selectedPeriod === "today") filters.scope = attendanceScope;
        if (selectedPeriod === "custom" && customDateRange) {
          filters.startDate = customDateRange[0].format("YYYY-MM-DD");
          filters.endDate = customDateRange[1].format("YYYY-MM-DD");
        }

        const [statsData, eventsData, schoolData, classesData] = await Promise.all([
          dashboardService.getStats(schoolId, filters),
          isToday ? dashboardService.getRecentEvents(schoolId, 10) : Promise.resolve([]),
          schoolsService.getById(schoolId),
          classesService.getAll(schoolId),
        ]);
        setStats(statsData);
        setEvents(eventsData);
        setSchool(schoolData);
        setClasses(classesData);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        if (withLoading) setLoading(false);
      }
    },
    [schoolId, selectedClassId, selectedPeriod, customDateRange, isToday, attendanceScope, setLastUpdated],
  );

  const loadHistory = useCallback(async () => {
    if (!schoolId) return;
    setHistoryLoading(true);
    try {
      const result = await dashboardService.getEventHistory(schoolId, {
        startDate: historyRange[0].format("YYYY-MM-DD"),
        endDate: historyRange[1].format("YYYY-MM-DD"),
        classId: selectedClassId,
        limit: 300,
      });
      setHistoryEvents(result.data || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [schoolId, historyRange, selectedClassId]);

  useEffect(() => {
    loadDashboard(true);
  }, [loadDashboard]);

  useEffect(() => {
    if (!isToday) return;
    const timer = setInterval(() => fetchStats(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isToday, fetchStats]);

  useEffect(() => {
    setMeta({ showLiveStatus: isToday, isConnected });
    return () => setMeta({ showLiveStatus: false, isConnected: false });
  }, [isToday, isConnected, setMeta]);

  useEffect(() => {
    setRefresh(async () => {
      await loadDashboard(false);
    });
    return () => setRefresh(null);
  }, [loadDashboard, setRefresh]);

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    loadHistory();
  }, [loadHistory]);

  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  return {
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
    navigateToStudent,
    setHistoryRange,
    setSelectedClassId,
    setSelectedPeriod,
    setCustomDateRange,
    setAttendanceScope,
    openHistory,
    closeHistory,
    loadHistory,
  };
};


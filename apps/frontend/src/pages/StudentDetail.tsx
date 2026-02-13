import React, { useCallback, useEffect, useState } from "react";
import { Badge, Empty, Spin } from "antd";
import { useParams } from "react-router-dom";
import dayjs, { Dayjs } from "dayjs";
import { useAttendanceSSE } from "@features/realtime";
import { studentsService } from "@entities/student";
import { useHeaderMeta } from "../shared/ui";
import type { AttendanceEvent, AttendanceStatus, DailyAttendance, PeriodType, Student } from "@shared/types";
import { EFFECTIVE_STATUS_COLORS, getAttendanceStatsForStudentDetail } from "../entities/attendance";
import { isWithinPeriod } from "../shared/utils/dateFilters";
import { buildStudentWeeklyData } from "./studentDetail.utils";
import { StudentDetailHeader } from "./StudentDetailHeader";
import { StudentDetailFilters } from "./StudentDetailFilters";
import { StudentDetailTopRow } from "./StudentDetailTopRow";
import { StudentDetailWeeklyCard } from "./StudentDetailWeeklyCard";
import { StudentDetailHistoryTable } from "./StudentDetailHistoryTable";
import { StudentDetailDayModal } from "./StudentDetailDayModal";

const StudentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<DailyAttendance[]>([]);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("month");
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | undefined>();
  const [selectedRecord, setSelectedRecord] = useState<DailyAttendance | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const filteredAttendance = attendance.filter((a) => {
    const statusMatch = statusFilter ? a.status === statusFilter : true;
    const periodMatch = isWithinPeriod({ date: a.date, period: selectedPeriod, customRange: customDateRange });
    return statusMatch && periodMatch;
  });

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [studentData, attendanceData, eventsData] = await Promise.all([
        studentsService.getById(id),
        studentsService.getAttendance(id),
        studentsService.getEvents(id),
      ]);
      setStudent(studentData);
      setAttendance(attendanceData);
      setEvents(eventsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  }, [id, setLastUpdated]);

  const getEventsForDate = (date: string) => {
    const dateStr = dayjs(date).format("YYYY-MM-DD");
    return events.filter((e) => dayjs(e.timestamp).format("YYYY-MM-DD") === dateStr);
  };

  const { isConnected } = useAttendanceSSE(student?.schoolId || null, {
    onEvent: (event) => {
      if (event?.studentId === id) {
        fetchData();
      }
    },
    enabled: !!student?.schoolId,
  });

  useEffect(() => {
    const loadInitial = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    loadInitial();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    await fetchData();
    setLastUpdated(new Date());
  }, [fetchData, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!student) {
    return <Empty description="O'quvchi topilmadi" />;
  }

  const lateRecords = attendance.filter((a) => a.status === "LATE");
  const avgLateMinutes =
    lateRecords.length > 0
      ? Math.round(lateRecords.reduce((sum, a) => sum + (a.lateMinutes || 0), 0) / lateRecords.length)
      : 0;

  const counts = getAttendanceStatsForStudentDetail(attendance);
  const stats = { ...counts, late: lateRecords.length, avgLateMinutes };

  const attendanceMap = new Map(attendance.map((a) => [dayjs(a.date).format("YYYY-MM-DD"), a]));
  const dateCellRender = (date: Dayjs) => {
    const key = date.format("YYYY-MM-DD");
    const record = attendanceMap.get(key);
    if (!record) return null;
    return <Badge color={EFFECTIVE_STATUS_COLORS[record.status]} />;
  };

  const weeklyData = buildStudentWeeklyData(attendance);

  return (
    <div>
      <StudentDetailHeader student={student} isConnected={isConnected} stats={stats} />

      <StudentDetailFilters
        selectedPeriod={selectedPeriod}
        customDateRange={customDateRange}
        setSelectedPeriod={setSelectedPeriod}
        setCustomDateRange={setCustomDateRange}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filteredCount={filteredAttendance.length}
      />

      <StudentDetailTopRow
        stats={stats}
        events={events}
        dateCellRender={dateCellRender}
        selectedPeriod={selectedPeriod}
        customDateRange={customDateRange}
        setCustomDateRange={setCustomDateRange}
        setSelectedPeriod={setSelectedPeriod}
      />

      <StudentDetailWeeklyCard weeklyData={weeklyData} />

      <StudentDetailHistoryTable
        filteredAttendance={filteredAttendance}
        onRowClick={(record) => {
          setSelectedRecord(record);
          setModalOpen(true);
        }}
      />

      <StudentDetailDayModal
        selectedRecord={selectedRecord}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        getEventsForDate={getEventsForDate}
      />
    </div>
  );
};

export default StudentDetail;


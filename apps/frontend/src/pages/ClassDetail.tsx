import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Empty, Spin, Form } from "antd";
import dayjs from "dayjs";
import { useNavigate, useParams } from "react-router-dom";
import { useSchool } from "@entities/school";
import { useAttendanceSSE } from "@features/realtime";
import { classesService } from "@entities/class";
import { studentsService } from "@entities/student";
import { attendanceService } from "@entities/attendance";
import { useHeaderMeta } from "../shared/ui";
import type { Class, EffectiveAttendanceStatus, Student } from "@shared/types";
import {
  EFFECTIVE_STATUS_META,
  getEffectiveStatusCounts,
} from "../entities/attendance";
import { ClassDetailContent } from "./ClassDetailContent";
import { ClassDetailEditModal } from "./ClassDetailEditModal";

const AUTO_REFRESH_MS = 60000;
const STATUS_CONFIG: Record<EffectiveAttendanceStatus, { color: string; bg: string; text: string }> =
  EFFECTIVE_STATUS_META;

const ClassDetail: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const { schoolId } = useSchool();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [classData, setClassData] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<any[]>([]);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    if (!classId || !schoolId) return;
    try {
      const [studentsData, classesData] = await Promise.all([
        studentsService.getAll(schoolId, { classId }),
        classesService.getAll(schoolId),
      ]);
      setStudents(studentsData.data || []);
      const foundClass = classesData.find((c: Class) => c.id === classId);
      if (foundClass) setClassData(foundClass);

      const weekStart = dayjs().subtract(6, "day").startOf("day");
      const weekEnd = dayjs().endOf("day");
      let attendanceData: any[] = [];
      try {
        attendanceData = await attendanceService.getReport(schoolId, {
          startDate: weekStart.format("YYYY-MM-DD"),
          endDate: weekEnd.format("YYYY-MM-DD"),
          classId,
        });
      } catch (err) {
        console.error("Failed to load weekly attendance report:", err);
      }

      const byDate = new Map<string, { present: number; late: number; absent: number }>();
      attendanceData.forEach((record) => {
        const dateKey = dayjs(record.date).format("YYYY-MM-DD");
        if (!byDate.has(dateKey)) byDate.set(dateKey, { present: 0, late: 0, absent: 0 });
        const entry = byDate.get(dateKey)!;
        if (record.status === "PRESENT") entry.present += 1;
        else if (record.status === "LATE") entry.late += 1;
        else if (record.status === "ABSENT") entry.absent += 1;
      });

      const dayNames = ["Ya", "Du", "Se", "Ch", "Pa", "Ju", "Sh"];
      setWeeklyStats(
        Array.from({ length: 7 }).map((_, idx) => {
          const date = weekStart.add(idx, "day");
          const dateKey = date.format("YYYY-MM-DD");
          const stats = byDate.get(dateKey) || { present: 0, late: 0, absent: 0 };
          return { date: dateKey, dayName: dayNames[date.day()], present: stats.present, late: stats.late, absent: stats.absent };
        }),
      );

      const events: any[] = [];
      (studentsData.data || []).forEach((student: Student) => {
        if (student.todayFirstScan) {
          events.push({ id: `${student.id}-in`, student, eventType: "IN", timestamp: student.todayFirstScan });
        }
      });
      events.sort((a, b) => dayjs(b.timestamp).diff(dayjs(a.timestamp)));
      setRecentEvents(events.slice(0, 10));
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  }, [classId, schoolId, setLastUpdated]);

  const { isConnected } = useAttendanceSSE(schoolId, { onEvent: () => fetchData() });

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

  useEffect(() => {
    if (dateFilter !== "today") return;
    const timer = setInterval(() => fetchData(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [dateFilter, fetchData]);

  const studentsWithEffectiveStatus = useMemo<Array<Student & { effectiveStatus: EffectiveAttendanceStatus }>>(
    () =>
      students.map((student) => ({
        ...student,
        effectiveStatus: (student.todayEffectiveStatus as EffectiveAttendanceStatus) || "PENDING_EARLY",
      })),
    [students],
  );

  const stats = useMemo(() => {
    const counts = getEffectiveStatusCounts(studentsWithEffectiveStatus);
    const total = students.length;
    return { total, ...counts, attendancePercent: total > 0 ? Math.round(((counts.present + counts.late) / total) * 100) : 0 };
  }, [studentsWithEffectiveStatus, students.length]);

  const filteredStudents = useMemo(() => {
    if (!statusFilter) return studentsWithEffectiveStatus;
    return studentsWithEffectiveStatus.filter((s) => s.effectiveStatus === statusFilter);
  }, [studentsWithEffectiveStatus, statusFilter]);

  const pieData = useMemo(
    () =>
      [
        { name: STATUS_CONFIG.PRESENT.text, value: stats.present, color: STATUS_CONFIG.PRESENT.color },
        { name: STATUS_CONFIG.LATE.text, value: stats.late, color: STATUS_CONFIG.LATE.color },
        { name: STATUS_CONFIG.ABSENT.text, value: stats.absent, color: STATUS_CONFIG.ABSENT.color },
        { name: "Kechikmoqda", value: stats.pendingLate, color: STATUS_CONFIG.PENDING_LATE.color },
        { name: "Hali kelmagan", value: stats.pendingEarly, color: STATUS_CONFIG.PENDING_EARLY.color },
        { name: STATUS_CONFIG.EXCUSED.text, value: stats.excused, color: STATUS_CONFIG.EXCUSED.color },
      ].filter((d) => d.value > 0),
    [stats],
  );

  if (loading) return <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><Spin size="large" /></div>;
  if (!classData) return <Empty description="Sinf topilmadi" />;

  return (
    <div>
      <ClassDetailContent
        classData={classData}
        stats={stats}
        isConnected={isConnected}
        dateFilter={dateFilter}
        setDateFilter={setDateFilter}
        onBack={() => navigate(-1)}
        onEdit={() => {
          form.setFieldsValue({
            name: classData.name,
            gradeLevel: classData.gradeLevel,
            startTime: classData.startTime ? dayjs(classData.startTime, "HH:mm") : null,
            endTime: classData.endTime ? dayjs(classData.endTime, "HH:mm") : null,
          });
          setEditModalOpen(true);
        }}
        onDelete={async () => {
          if (!classId) return;
          try {
            await classesService.delete(classId);
            message.success("Sinf o'chirildi");
            navigate(-1);
          } catch {
            message.error("Xatolik yuz berdi");
          }
        }}
        pieData={pieData}
        recentEvents={recentEvents}
        schoolId={schoolId ?? undefined}
        navigateToStudent={(studentId) => navigate(`/schools/${schoolId}/students/${studentId}`)}
        filteredStudents={filteredStudents}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        weeklyStats={weeklyStats}
      />

      <ClassDetailEditModal
        open={editModalOpen}
        form={form}
        onClose={() => setEditModalOpen(false)}
        onSubmit={async (values) => {
          if (!classId) return;
          try {
            await classesService.update(classId, {
              ...values,
              startTime: values.startTime?.format("HH:mm"),
              endTime: values.endTime?.format("HH:mm"),
            });
            message.success("Sinf yangilandi");
            setEditModalOpen(false);
            fetchData();
          } catch {
            message.error("Xatolik yuz berdi");
          }
        }}
      />
    </div>
  );
};

export default ClassDetail;


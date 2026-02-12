import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Form, Table } from "antd";
import { useSchool } from "@entities/school";
import { useAttendanceSSE } from "@features/realtime";
import { attendanceService } from "@entities/attendance";
import { classesService } from "@entities/class";
import type {
  AttendanceStatus,
  Class,
  DailyAttendance,
  PeriodType,
} from "@shared/types";
import { useAuth } from "@entities/auth";
import { PageHeader, useHeaderMeta } from "../shared/ui";
import dayjs from "dayjs";
import { getAttendanceStatsFromRecords } from "../entities/attendance";
import { getRangeForPeriod } from "../shared/utils/periodRanges";
import { buildAttendanceColumns } from "./attendanceColumns";
import { AttendanceFiltersBar } from "./AttendanceFiltersBar";
import { AttendanceExcuseModal } from "./AttendanceExcuseModal";

const AUTO_REFRESH_MS = 60000;

const Attendance: React.FC = () => {
  const { message } = App.useApp();
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const [records, setRecords] = useState<DailyAttendance[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>(() => getRangeForPeriod("today"));
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [excuseModalOpen, setExcuseModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DailyAttendance | null>(null);
  const [excuseForm] = Form.useForm();
  const { setMeta, setRefresh, setLastUpdated } = useHeaderMeta();

  const isSchoolAdmin = user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const canEdit = isSchoolAdmin || isTeacher;

  const fetchData = useCallback(
    async (silent = false) => {
      if (!schoolId) return;
      if (!silent) setLoading(true);
      try {
        let data: DailyAttendance[];
        const isToday = dateRange[0].isSame(dayjs(), "day") && dateRange[1].isSame(dayjs(), "day");
        if (isToday) {
          data = await attendanceService.getToday(schoolId, { classId: classFilter, status: statusFilter });
        } else {
          data = await attendanceService.getReport(schoolId, {
            startDate: dateRange[0].format("YYYY-MM-DD"),
            endDate: dateRange[1].format("YYYY-MM-DD"),
            classId: classFilter,
          });
          if (statusFilter) data = data.filter((r) => r.status === statusFilter);
        }
        setRecords(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [schoolId, dateRange, classFilter, statusFilter, setLastUpdated],
  );

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    try {
      setClasses(await classesService.getAll(schoolId));
    } catch (err) {
      console.error(err);
    }
  }, [schoolId]);

  useEffect(() => {
    fetchData();
    fetchClasses();
  }, [fetchData, fetchClasses]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchData(), fetchClasses()]);
    setLastUpdated(new Date());
  }, [fetchData, fetchClasses, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  const isTodayRange = useMemo(
    () => dateRange[0].isSame(dayjs(), "day") && dateRange[1].isSame(dayjs(), "day"),
    [dateRange],
  );

  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: () => {
      if (isTodayRange) fetchData();
    },
  });

  useEffect(() => {
    setMeta({ showLiveStatus: isTodayRange, isConnected });
    return () => setMeta({ showLiveStatus: false, isConnected: false });
  }, [isTodayRange, isConnected, setMeta]);

  useEffect(() => {
    if (!isTodayRange) return;
    const timer = setInterval(() => fetchData(true), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isTodayRange, fetchData]);

  const handleStatusChange = useCallback(
    async (record: DailyAttendance, status: AttendanceStatus) => {
      if (!canEdit) return;
      if (status === "EXCUSED") {
        setSelectedRecord(record);
        excuseForm.resetFields();
        setExcuseModalOpen(true);
        return;
      }
      try {
        if (isTeacher) return;
        if (record.id) {
          await attendanceService.update(record.id, { status });
        } else {
          await attendanceService.upsert(schoolId!, {
            studentId: record.studentId,
            date: dayjs(record.date).toISOString(),
            status,
          });
        }
        message.success("Holat yangilandi");
        fetchData();
      } catch {
        message.error("Yangilashda xatolik");
      }
    },
    [canEdit, excuseForm, isTeacher, schoolId, message, fetchData],
  );

  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return records;
    const search = searchText.toLowerCase();
    return records.filter((r) => r.student?.name?.toLowerCase().includes(search));
  }, [records, searchText]);

  const columns = useMemo(
    () => buildAttendanceColumns({ canEdit, isTeacher, onStatusChange: handleStatusChange }),
    [canEdit, isTeacher, handleStatusChange],
  );

  const stats = getAttendanceStatsFromRecords(filteredRecords);

  return (
    <div>
      <PageHeader>
        <AttendanceFiltersBar
          stats={stats}
          selectedPeriod={selectedPeriod}
          customDateRange={customDateRange}
          setSelectedPeriod={setSelectedPeriod}
          setCustomDateRange={setCustomDateRange}
          setDateRange={setDateRange}
          searchText={searchText}
          setSearchText={setSearchText}
          classFilter={classFilter}
          setClassFilter={setClassFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          classOptions={classes.map((c) => ({ label: c.name, value: c.id }))}
          onExport={async () => {
            if (!schoolId) return;
            try {
              const blob = await attendanceService.exportExcel(schoolId, {
                startDate: dateRange[0].format("YYYY-MM-DD"),
                endDate: dateRange[1].format("YYYY-MM-DD"),
              });
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.setAttribute(
                "download",
                `attendance-${dateRange[0].format("YYYY-MM-DD")}-${dateRange[1].format("YYYY-MM-DD")}.xlsx`,
              );
              document.body.appendChild(link);
              link.click();
              link.remove();
            } catch {
              message.error("Eksportda xatolik");
            }
          }}
          isSchoolAdmin={isSchoolAdmin}
          selectedCount={selectedRowKeys.length}
          bulkLoading={bulkLoading}
          onBulkExcuse={async () => {
            setBulkLoading(true);
            try {
              const result = await attendanceService.bulkUpdate(selectedRowKeys as string[], "EXCUSED");
              message.success(`${result.updated} ta yozuv "Sababli" qilindi`);
              setSelectedRowKeys([]);
              fetchData();
            } catch {
              message.error("Xatolik yuz berdi");
            } finally {
              setBulkLoading(false);
            }
          }}
        />
      </PageHeader>

      <Table
        dataSource={filteredRecords}
        columns={columns}
        rowKey={(record) => record.id || `temp-${record.studentId}`}
        loading={loading}
        size="middle"
        rowSelection={isSchoolAdmin ? { selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) } : undefined}
        pagination={{ pageSize: 20 }}
      />

      <AttendanceExcuseModal
        open={excuseModalOpen}
        form={excuseForm}
        onClose={() => setExcuseModalOpen(false)}
        onOk={async () => {
          try {
            if (!selectedRecord || !schoolId) return;
            const values = await excuseForm.validateFields();
            await attendanceService.upsert(schoolId, {
              studentId: selectedRecord.studentId,
              date: dayjs(selectedRecord.date).toISOString(),
              status: "EXCUSED",
              notes: values.notes,
            });
            message.success("Sababli deb belgilandi");
            setExcuseModalOpen(false);
            fetchData();
          } catch {
            message.error("Xatolik yuz berdi");
          }
        }}
      />
    </div>
  );
};

export default Attendance;


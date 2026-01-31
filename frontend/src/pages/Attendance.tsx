import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Tag,
  DatePicker,
  Select,
  App,
  Input,
  Modal,
  Form,
  Segmented,
} from "antd";
import {
  DownloadOutlined,
  SearchOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useSchool } from "../hooks/useSchool";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { attendanceService } from "../services/attendance";
import { classesService } from "../services/classes";
import type {
  DailyAttendance,
  Class,
  AttendanceStatus,
  PeriodType,
  EffectiveAttendanceStatus,
} from "../types";
import { getAssetUrl } from "../config";
import { useAuth } from "../hooks/useAuth";
import { PageHeader, StatItem, StatGroup, useHeaderMeta } from "../shared/ui";
import dayjs from "dayjs";
import {
  ATTENDANCE_STATUS_TAG,
  EFFECTIVE_STATUS_COLORS,
  EFFECTIVE_STATUS_LABELS,
  getAttendanceStatsFromRecords,
  STATUS_COLORS,
  EFFECTIVE_STATUS_OPTIONS,
} from "../entities/attendance";
import { PERIOD_OPTIONS_WITH_CUSTOM } from "../shared/constants/periodOptions";

const { RangePicker } = DatePicker;
const AUTO_REFRESH_MS = 60000;

const PERIOD_OPTIONS = PERIOD_OPTIONS_WITH_CUSTOM;

const Attendance: React.FC = () => {
  const { message } = App.useApp();
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const [records, setRecords] = useState<DailyAttendance[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs(),
    dayjs(),
  ]);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [excuseModalOpen, setExcuseModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DailyAttendance | null>(
    null,
  );
  const [excuseForm] = Form.useForm();

  const isSchoolAdmin =
    user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const canEdit = isSchoolAdmin || isTeacher;
  const { setMeta, setRefresh, setLastUpdated } = useHeaderMeta();

  const fetchData = useCallback(async (silent = false) => {
    if (!schoolId) return;
    if (!silent) {
      setLoading(true);
    }
    try {
      let data: DailyAttendance[];
      const isToday =
        dateRange[0].isSame(dayjs(), "day") &&
        dateRange[1].isSame(dayjs(), "day");

      if (isToday) {
        data = await attendanceService.getToday(schoolId, {
          classId: classFilter,
          status: statusFilter,
        });
      } else {
        data = await attendanceService.getReport(schoolId, {
          startDate: dateRange[0].format("YYYY-MM-DD"),
          endDate: dateRange[1].format("YYYY-MM-DD"),
          classId: classFilter,
        });
        // Frontend filtering of status since getReport might not support it
        if (statusFilter) {
          data = data.filter((r) => r.status === statusFilter);
        }
      }
      setRecords(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [schoolId, dateRange, classFilter, statusFilter]);

  const isTodayRange = useMemo(
    () =>
      dateRange[0].isSame(dayjs(), "day") &&
      dateRange[1].isSame(dayjs(), "day"),
    [dateRange],
  );

  // SSE for real-time updates
  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: () => {
      // Only auto-refresh if viewing today's data
      if (isTodayRange) {
        fetchData();
      }
    },
  });

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    try {
      const data = await classesService.getAll(schoolId);
      setClasses(data);
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

  useEffect(() => {
    setMeta({ showLiveStatus: isTodayRange, isConnected });
    return () => setMeta({ showLiveStatus: false, isConnected: false });
  }, [isTodayRange, isConnected, setMeta]);

  useEffect(() => {
    if (!isTodayRange) return;
    const timer = setInterval(() => {
      fetchData(true);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [isTodayRange, fetchData]);

  const handlePeriodChange = (value: PeriodType) => {
    setSelectedPeriod(value);
    let start = dayjs();
    let end = dayjs();

    switch (value) {
      case "today":
        start = dayjs();
        end = dayjs();
        break;
      case "yesterday":
        start = dayjs().subtract(1, "day");
        end = dayjs().subtract(1, "day");
        break;
      case "week":
        start = dayjs().startOf("week");
        end = dayjs();
        break;
      case "month":
        start = dayjs().startOf("month");
        end = dayjs();
        break;
      case "year":
        start = dayjs().startOf("year");
        end = dayjs();
        break;
      case "custom":
        return; // Don't change dateRange yet, wait for picker
    }
    setDateRange([start, end]);
  };

  const handleStatusChange = async (
    record: DailyAttendance,
    status: AttendanceStatus,
  ) => {
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
        // No record ID, use studentId and date
        await attendanceService.upsert(schoolId!, {
          studentId: record.studentId,
          date: dayjs(record.date).toISOString(),
          status,
        });
      }

      message.success("Holat yangilandi");
      fetchData();
    } catch (err) {
      message.error("Yangilashda xatolik");
    }
  };

  const handleExcuseOk = async () => {
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
    } catch (err) {
      message.error("Xatolik yuz berdi");
    }
  };

  const handleExport = async () => {
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
    } catch (err) {
      message.error("Eksportda xatolik");
    }
  };

  // Filter records by search text
  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return records;
    const search = searchText.toLowerCase();
    return records.filter((r) =>
      r.student?.name?.toLowerCase().includes(search),
    );
  }, [records, searchText]);

  const stats = getAttendanceStatsFromRecords(filteredRecords);

  const columns = [
    {
      title: "Rasm",
      dataIndex: ["student", "photoUrl"],
      key: "photo",
      render: (url: string) =>
        url ? (
          <img
            src={getAssetUrl(url)}
            alt="o'quvchi"
            style={{
              width: 40,
              height: 40,
              objectFit: "cover",
              borderRadius: "50%",
            }}
          />
        ) : null,
    },
    { title: "O'quvchi", dataIndex: ["student", "name"], key: "student" },
    { title: "Sinf", dataIndex: ["student", "class", "name"], key: "class" },
    {
      title: "Holat",
      dataIndex: "status",
      key: "status",
      render: (status: EffectiveAttendanceStatus, record: DailyAttendance) => {
        if (!canEdit) {
          const color = EFFECTIVE_STATUS_COLORS[status];
          const text = EFFECTIVE_STATUS_LABELS[status];
          return (
            <Tag color={color || "default"}>{text || "-"}</Tag>
          );
        }
        const options = [
          {
            value: "PRESENT",
            label: (
              <Tag color={ATTENDANCE_STATUS_TAG.PRESENT.color}>
                {ATTENDANCE_STATUS_TAG.PRESENT.text}
              </Tag>
            ),
            disabled: isTeacher,
          },
          {
            value: "LATE",
            label: (
              <Tag color={ATTENDANCE_STATUS_TAG.LATE.color}>
                {ATTENDANCE_STATUS_TAG.LATE.text}
              </Tag>
            ),
            disabled: isTeacher,
          },
          {
            value: "ABSENT",
            label: (
              <Tag color={ATTENDANCE_STATUS_TAG.ABSENT.color}>
                {ATTENDANCE_STATUS_TAG.ABSENT.text}
              </Tag>
            ),
            disabled: isTeacher,
          },
          {
            value: "EXCUSED",
            label: (
              <Tag color={ATTENDANCE_STATUS_TAG.EXCUSED.color}>
                {ATTENDANCE_STATUS_TAG.EXCUSED.text}
              </Tag>
            ),
            disabled: false,
          },
        ];
        return (
          <Select
            value={
              status === "PENDING_EARLY" || status === "PENDING_LATE"
                ? undefined
                : status
            }
            placeholder="Kutilmoqda"
            size="small"
            style={{ width: 100 }}
            onChange={(val) => handleStatusChange(record, val as AttendanceStatus)}
            options={options}
            allowClear={false}
          />
        );
      },
    },
    {
      title: "Izoh",
      dataIndex: "notes",
      key: "notes",
      render: (notes: string) => notes || "-",
    },
    {
      title: "Birinchi skan",
      dataIndex: "firstScanTime",
      key: "first",
      render: (t: string) => (t ? dayjs(t).format("HH:mm") : "-"),
    },
    {
      title: "Oxirgi skan",
      dataIndex: "lastScanTime",
      key: "last",
      render: (t: string) => (t ? dayjs(t).format("HH:mm") : "-"),
    },
    {
      title: "Kechikish",
      dataIndex: "lateMinutes",
      key: "late",
      render: (m: number | null) => (m ? `${m} daq` : "-"),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <div>
      {/* Standart Header */}
      <PageHeader>
        <StatGroup>
          <StatItem
            icon={<TeamOutlined />}
            label="Jami"
            value={stats.total}
            color="#1890ff"
          />
          <StatItem
            icon={<CheckCircleOutlined />}
            label="Kelgan"
            value={stats.present}
            color={STATUS_COLORS.PRESENT}
          />
          <StatItem
            icon={<ClockCircleOutlined />}
            label="Kech qoldi"
            value={stats.late}
            color={STATUS_COLORS.LATE}
          />
          <StatItem
            icon={<CloseCircleOutlined />}
            label="Yo'q"
            value={stats.absent}
            color={STATUS_COLORS.ABSENT}
          />
          {stats.excused > 0 && (
             <StatItem
             icon={<CalendarOutlined />}
             label="Sababli"
             value={stats.excused}
             color={STATUS_COLORS.EXCUSED}
           />
          )}
        </StatGroup>
      </PageHeader>

      {/* Filterlar satri */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          padding: "0 4px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            padding: "4px 8px",
            borderRadius: 8,
            border: "1px solid #f0f0f0",
          }}
        >
          <CalendarOutlined style={{ color: "#8c8c8c" }} />
          <Segmented
            size="middle"
            value={selectedPeriod}
            onChange={(val) => handlePeriodChange(val as PeriodType)}
            options={PERIOD_OPTIONS}
            style={{ background: "transparent" }}
          />
        </div>

        {(selectedPeriod === "custom") && (
          <RangePicker
            value={dateRange}
            onChange={(values) =>
              values && setDateRange([values[0]!, values[1]!])
            }
            format="DD.MM.YYYY"
            style={{ width: 240, borderRadius: 8 }}
          />
        )}

        <div
          style={{
            width: 1,
            height: 20,
            background: "#e8e8e8",
            margin: "0 4px",
          }}
        />

        <Input
          placeholder="O'quvchi nomi..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 180, borderRadius: 8 }}
          allowClear
        />

        <Select
          placeholder="Sinf"
          value={classFilter}
          onChange={setClassFilter}
          style={{ width: 120 }}
          allowClear
          options={classes.map((c) => ({ label: c.name, value: c.id }))}
          suffixIcon={<TeamOutlined />}
        />
        
        <Select
          placeholder="Holat"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 120 }}
          allowClear
          options={EFFECTIVE_STATUS_OPTIONS}
        />
        
        <Button icon={<DownloadOutlined />} onClick={handleExport} style={{ borderRadius: 8 }}>
          Eksport
        </Button>

        {isSchoolAdmin && selectedRowKeys.length > 0 && (
          <Button
            type="primary"
            loading={bulkLoading}
            style={{ borderRadius: 8 }}
            onClick={async () => {
              setBulkLoading(true);
              try {
                const result = await attendanceService.bulkUpdate(
                  selectedRowKeys as string[],
                  "EXCUSED",
                );
                message.success(`${result.updated} ta yozuv "Sababli" qilindi`);
                setSelectedRowKeys([]);
                fetchData();
              } catch (err) {
                message.error("Xatolik yuz berdi");
              } finally {
                setBulkLoading(false);
              }
            }}
          >
            {selectedRowKeys.length} tani Sababli qilish
          </Button>
        )}
      </div>

      <Table
        dataSource={filteredRecords}
        columns={columns}
        rowKey={(record) => record.id || `temp-${record.studentId}`}
        loading={loading}
        size="middle"
        rowSelection={isSchoolAdmin ? rowSelection : undefined}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Sababli deb belgilash"
        open={excuseModalOpen}
        onOk={handleExcuseOk}
        onCancel={() => setExcuseModalOpen(false)}
        okText="Saqlash"
        cancelText="Bekor"
      >
        <Form form={excuseForm} layout="vertical">
          <Form.Item
            name="notes"
            label="Sabab (izoh)"
            rules={[{ required: true, message: "Iltimos, sababni kiriting" }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Masalan: Kasallik tufayli kelmadi"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Attendance;

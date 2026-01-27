import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Table,
  Button,
  Space,
  Tag,
  DatePicker,
  Select,
  Card,
  Row,
  Col,
  Statistic,
  App,
  Badge,
  Tooltip,
  Input,
} from "antd";
import { DownloadOutlined, WifiOutlined, SearchOutlined } from "@ant-design/icons";
import { useSchool } from "../hooks/useSchool";
import { useAttendanceSSE } from "../hooks/useAttendanceSSE";
import { attendanceService } from "../services/attendance";
import { classesService } from "../services/classes";
import type { DailyAttendance, Class, AttendanceStatus } from "../types";
import { getAssetUrl } from "../config";
import { useAuth } from "../hooks/useAuth";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

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
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [searchText, setSearchText] = useState("");
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const isSchoolAdmin = user?.role === "SCHOOL_ADMIN" || user?.role === "SUPER_ADMIN";
  const isTeacher = user?.role === "TEACHER";
  const canEdit = isSchoolAdmin || isTeacher;

  const fetchData = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let data: DailyAttendance[];
      const isToday =
        dateRange[0].isSame(dayjs(), "day") &&
        dateRange[1].isSame(dayjs(), "day");

      if (isToday && !classFilter && !statusFilter) {
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
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, dateRange, classFilter, statusFilter]);

  // SSE for real-time updates
  const { isConnected } = useAttendanceSSE(schoolId, {
    onEvent: () => {
      // Only auto-refresh if viewing today's data
      const isToday = dateRange[0].isSame(dayjs(), 'day') && dateRange[1].isSame(dayjs(), 'day');
      if (isToday) {
        fetchData();
      }
    },
  });

  const fetchClasses = async () => {
    if (!schoolId) return;
    try {
      const data = await classesService.getAll(schoolId);
      setClasses(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    fetchClasses();
  }, [schoolId, dateRange, classFilter, statusFilter]);

  const handleStatusChange = async (id: string, status: AttendanceStatus) => {
    try {
      if (!canEdit) return;
      if (isTeacher && status !== "EXCUSED") return;
      await attendanceService.update(id, { status });
      message.success("Holat yangilandi");
      fetchData();
    } catch (err) {
      message.error("Yangilashda xatolik");
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
      r.student?.name?.toLowerCase().includes(search)
    );
  }, [records, searchText]);

  const stats = {
    present: filteredRecords.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE",
    ).length,
    late: filteredRecords.filter((r) => r.status === "LATE").length,
    absent: filteredRecords.filter((r) => r.status === "ABSENT").length,
  };

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
      render: (status: AttendanceStatus, record: DailyAttendance) => {
        if (!canEdit) {
          return (
            <Tag color={status === "PRESENT" ? "green" : status === "LATE" ? "orange" : status === "ABSENT" ? "red" : "gray"}>
              {status === "PRESENT" ? "Kelgan" : status === "LATE" ? "Kech" : status === "ABSENT" ? "Kelmagan" : "Sababli"}
            </Tag>
          );
        }
        const options = [
          { value: "PRESENT", label: <Tag color="green">Kelgan</Tag>, disabled: isTeacher },
          { value: "LATE", label: <Tag color="orange">Kech</Tag>, disabled: isTeacher },
          { value: "ABSENT", label: <Tag color="red">Kelmagan</Tag>, disabled: isTeacher },
          { value: "EXCUSED", label: <Tag color="gray">Sababli</Tag>, disabled: false },
        ];
        return (
          <Select
            value={status}
            size="small"
            style={{ width: 100 }}
            onChange={(val) => handleStatusChange(record.id, val)}
            options={options}
          />
        );
      },
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

  return (
    <div>
      {/* Connection Status Indicator */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tooltip title={isConnected ? 'Jonli ulangan' : 'Jonli ulanish yo\'q'}>
          <Badge
            status={isConnected ? 'success' : 'error'}
            text={
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <WifiOutlined style={{ color: isConnected ? '#52c41a' : '#ff4d4f' }} />
              </span>
            }
          />
        </Tooltip>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card>
            <Statistic
              title="Kelgan"
              value={stats.present}
              styles={{ content: { color: "#52c41a" } }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic
              title="Kech"
              value={stats.late}
              styles={{ content: { color: "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card>
            <Statistic
              title="Kelmagan"
              value={stats.absent}
              styles={{ content: { color: "#ff4d4f" } }}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ marginBottom: 16, flexWrap: "wrap" }} size="middle">
        {/* Qidiruv */}
        <Input
          placeholder="O'quvchi nomi..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 180 }}
          allowClear
        />

        {/* Quick Date Buttons */}
        <Button.Group>
          <Button
            type={dateRange[0].isSame(dayjs(), 'day') && dateRange[1].isSame(dayjs(), 'day') ? 'primary' : 'default'}
            onClick={() => setDateRange([dayjs(), dayjs()])}
          >
            Bugun
          </Button>
          <Button
            type={dateRange[0].isSame(dayjs().subtract(1, 'day'), 'day') && dateRange[1].isSame(dayjs().subtract(1, 'day'), 'day') ? 'primary' : 'default'}
            onClick={() => setDateRange([dayjs().subtract(1, 'day'), dayjs().subtract(1, 'day')])}
          >
            Kecha
          </Button>
          <Button
            type={dateRange[0].isSame(dayjs().startOf('week'), 'day') && dateRange[1].isSame(dayjs(), 'day') ? 'primary' : 'default'}
            onClick={() => setDateRange([dayjs().startOf('week'), dayjs()])}
          >
            Bu hafta
          </Button>
        </Button.Group>

        <RangePicker
          value={dateRange}
          onChange={(values) =>
            values && setDateRange([values[0]!, values[1]!])
          }
        />
        <Select
          placeholder="Sinf"
          value={classFilter}
          onChange={setClassFilter}
          style={{ width: 120 }}
          allowClear
          options={classes.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Select
          placeholder="Holat"
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 120 }}
          allowClear
          options={[
            { value: "PRESENT", label: "Kelgan" },
            { value: "LATE", label: "Kech" },
            { value: "ABSENT", label: "Kelmagan" },
            { value: "EXCUSED", label: "Sababli" },
          ]}
        />
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          Eksport
        </Button>
        {isSchoolAdmin && selectedRowKeys.length > 0 && (
          <Button
            type="primary"
            loading={bulkLoading}
            onClick={async () => {
              setBulkLoading(true);
              try {
                const result = await attendanceService.bulkUpdate(
                  selectedRowKeys as string[],
                  'EXCUSED'
                );
                message.success(`${result.updated} ta yozuv "Sababli" qilindi`);
                setSelectedRowKeys([]);
                fetchData();
              } catch (err) {
                message.error('Xatolik yuz berdi');
              } finally {
                setBulkLoading(false);
              }
            }}
          >
            {selectedRowKeys.length} tani Sababli qilish
          </Button>
        )}
      </Space>

      <Table
        dataSource={filteredRecords}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
      />
    </div>
  );
};

export default Attendance;

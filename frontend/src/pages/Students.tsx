import React, { useEffect, useState, useMemo, useCallback } from "react";
import debounce from "lodash/debounce";
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Avatar,
  Modal,
  Form,
  Popconfirm,
  App,
  Typography,
  Segmented,
  DatePicker,
  Progress,
  Switch,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  UserOutlined,
  DeleteOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSchool } from "../hooks/useSchool";
import { studentsService } from "../services/students";
import type { StudentsResponse } from "../types";
import { classesService } from "../services/classes";
import type { PeriodType, EffectiveAttendanceStatus } from "../types";
import { PageHeader, Divider, StatItem, useHeaderMeta } from "../shared/ui";
import { getAssetUrl, DEFAULT_PAGE_SIZE } from "../config";
import type { Student, Class } from "../types";
import dayjs from "dayjs";
import {
  getEffectiveStatusTagConfig,
  getStudentListStatsFallback,
  EFFECTIVE_STATUS_META,
  STATUS_COLORS,
} from "../entities/attendance";
import { PERIOD_OPTIONS as SHARED_PERIOD_OPTIONS } from "../shared/constants/periodOptions";

const { Text } = Typography;
const { RangePicker } = DatePicker;
const AUTO_REFRESH_MS = 60000;

// Vaqt filterlari opsiyalari (shared)
const PERIOD_OPTIONS = SHARED_PERIOD_OPTIONS;

const Students: React.FC = () => {
  const { schoolId } = useSchool();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<
    Array<{ row: number; message: string }>
  >([]);
  const [importErrorOpen, setImportErrorOpen] = useState(false);
  const [allowCreateMissingClass, setAllowCreateMissingClass] = useState(false);

  // Vaqt filterlari
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customDateRange, setCustomDateRange] = useState<
    [dayjs.Dayjs, dayjs.Dayjs] | null
  >(null);
  const [responseData, setResponseData] = useState<StudentsResponse | null>(
    null,
  );

  const fetchStudents = useCallback(
    async (silent = false) => {
      if (!schoolId) return;
      if (!silent) {
        setLoading(true);
      }
      try {
        const params: any = {
          page,
          search,
          classId: classFilter,
          period: selectedPeriod,
        };

        if (selectedPeriod === "custom" && customDateRange) {
          params.startDate = customDateRange[0].format("YYYY-MM-DD");
          params.endDate = customDateRange[1].format("YYYY-MM-DD");
        }

        const data = await studentsService.getAll(schoolId, params);
        setStudents(data.data || []);
        setTotal(data.total || 0);
        setResponseData(data);
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [
      schoolId,
      page,
      search,
      classFilter,
      selectedPeriod,
      customDateRange,
      setLastUpdated,
    ],
  );

  const fetchClasses = useCallback(async () => {
    if (!schoolId) return;
    try {
      const data = await classesService.getAll(schoolId);
      setClasses(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  }, [schoolId, setLastUpdated]);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [fetchStudents, fetchClasses]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchStudents(), fetchClasses()]);
    setLastUpdated(new Date());
  }, [fetchStudents, fetchClasses, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  useEffect(() => {
    if (selectedPeriod !== "today") return;
    const timer = setInterval(() => {
      fetchStudents(true);
    }, AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [selectedPeriod, fetchStudents]);

  const debouncedSetSearch = useMemo(
    () =>
      debounce((value: string) => {
        setSearch(value);
        setPage(1);
      }, 350),
    [],
  );

  useEffect(() => {
    return () => {
      debouncedSetSearch.cancel();
    };
  }, [debouncedSetSearch]);

  // Statistikalar - API'dan kelgan stats'dan olish
  const stats = useMemo(() => {
    if (responseData?.stats) {
      return responseData.stats;
    }
    return getStudentListStatsFallback(students, total);
  }, [responseData, students, total]);

  const isSingleDay = responseData?.isSingleDay ?? true;

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Student) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingId) {
        await studentsService.update(editingId, values);
        message.success("O'quvchi yangilandi");
      } else {
        await studentsService.create(schoolId!, values);
        message.success("O'quvchi qo'shildi");
      }
      setModalOpen(false);
      fetchStudents();
    } catch (err) {
      message.error("Saqlashda xatolik");
    }
  };

  const handleExport = async () => {
    if (!schoolId) return;
    try {
      const blob = await studentsService.exportExcel(schoolId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `students-${schoolId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success("Eksport muvaffaqiyatli");
    } catch (err) {
      message.error("Eksport xatolik");
    }
  };

  const handleDownloadTemplate = async () => {
    if (!schoolId) return;
    try {
      const blob = await studentsService.downloadTemplate(schoolId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "talabalar-shablon.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      message.error("Shablonni yuklab bo'lmadi");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId) return;

    const hide = message.loading("Yuklanmoqda...", 0);
    try {
      const result = await studentsService.importExcel(schoolId, file, {
        createMissingClass: allowCreateMissingClass,
      });
      const skipped = result.skipped || 0;
      const errors = result.errors || [];
      if (errors.length > 0) {
        message.warning(
          `${result.imported} ta yuklandi, ${skipped} ta o'tkazib yuborildi`,
        );
        console.warn("Import errors:", errors);
        setImportErrors(errors);
        setImportErrorOpen(true);
      } else {
        message.success(`${result.imported} ta o'quvchi yuklandi`);
      }
      fetchStudents();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      message.error(
        apiError || "Yuklashda xatolik. Fayl formatini tekshiring.",
      );
    } finally {
      hide();
      e.target.value = ""; // Reset input
    }
  };

  const columns = [
    {
      title: "",
      dataIndex: "photoUrl",
      key: "photo",
      width: 50,
      render: (url: string) => (
        <Avatar src={getAssetUrl(url)} icon={<UserOutlined />} size="small" />
      ),
    },
    {
      title: "ID",
      dataIndex: "deviceStudentId",
      key: "id",
      width: 70,
      render: (id: string) => (
        <Text type="secondary" style={{ fontSize: 11 }}>
          {id || "-"}
        </Text>
      ),
    },
    {
      title: "Ism",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Sinf",
      dataIndex: "class",
      key: "class",
      width: 80,
      render: (cls: Class | undefined) =>
        cls?.name ? <Tag>{cls.name}</Tag> : <Text type="secondary">-</Text>,
    },
    // Bitta kun uchun - holat ustuni
    ...(isSingleDay
      ? [
          {
            title: "Holat",
            key: "status",
            width: 140,
            render: (_: any, record: Student) => {
              const effectiveStatus =
                record.todayEffectiveStatus || record.todayStatus;
              if (!effectiveStatus) {
                return <Tag color="default">-</Tag>;
              }
              const config = getEffectiveStatusTagConfig(
                effectiveStatus as EffectiveAttendanceStatus,
              );
              const time = record.todayFirstScan
                ? new Date(record.todayFirstScan).toLocaleTimeString("uz-UZ", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "";
              return (
                <Tag color={config.color} icon={config.icon}>
                  {config.text} {time && `(${time})`}
                </Tag>
              );
            },
          },
        ]
      : []),
    // Ko'p kun uchun - statistika ustunlari
    ...(!isSingleDay
      ? [
          {
            title: "Davomat %",
            key: "attendancePercent",
            width: 120,
            sorter: (a: any, b: any) =>
              (a.periodStats?.attendancePercent || 0) -
              (b.periodStats?.attendancePercent || 0),
            render: (_: any, record: any) => {
              const percent = record.periodStats?.attendancePercent || 0;
              return (
                <Progress
                  percent={percent}
                  size="small"
                  status={
                    percent >= 80
                      ? "success"
                      : percent >= 60
                        ? "normal"
                        : "exception"
                  }
                  format={(p) => `${p}%`}
                />
              );
            },
          },
          {
            title: (
              <span style={{ color: STATUS_COLORS.PRESENT }}>
                <CheckCircleOutlined /> Kelgan
              </span>
            ),
            key: "present",
            width: 80,
            align: "center" as const,
            render: (_: any, record: any) => (
              <Text style={{ color: STATUS_COLORS.PRESENT }}>
                {record.periodStats?.presentCount || 0}
              </Text>
            ),
          },
          {
            title: (
              <span style={{ color: STATUS_COLORS.LATE }}>
                <ClockCircleOutlined /> Kech qoldi
              </span>
            ),
            key: "late",
            width: 80,
            align: "center" as const,
            render: (_: any, record: any) => (
              <Text style={{ color: STATUS_COLORS.LATE }}>
                {record.periodStats?.lateCount || 0}
              </Text>
            ),
          },
          {
            title: (
              <span style={{ color: STATUS_COLORS.ABSENT }}>
                <CloseCircleOutlined /> Yo'q
              </span>
            ),
            key: "absent",
            width: 80,
            align: "center" as const,
            render: (_: any, record: any) => (
              <Text style={{ color: STATUS_COLORS.ABSENT }}>
                {record.periodStats?.absentCount || 0}
              </Text>
            ),
          },
          {
            title: "Kunlar",
            key: "totalDays",
            width: 70,
            align: "center" as const,
            render: (_: any, record: any) => (
              <Text type="secondary">{record.periodStats?.totalDays || 0}</Text>
            ),
          },
        ]
      : []),
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_: any, record: Student) => (
        <Space size={4}>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/students/${record.id}`);
            }}
          >
            Ko'rish
          </Button>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(record);
            }}
          >
            Tahrir
          </Button>
          <Popconfirm
            title="O'quvchini o'chirish?"
            description="Bu o'quvchining barcha ma'lumotlari o'chiriladi."
            onConfirm={async () => {
              try {
                await studentsService.delete(record.id);
                message.success("O'quvchi o'chirildi");
                fetchStudents();
              } catch (err) {
                message.error("O'chirishda xatolik");
              }
            }}
            okText="Ha"
            cancelText="Yo'q"
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              aria-label="O'quvchini o'chirish"
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Kompakt Header - Dashboard uslubida */}
      <PageHeader>
        {/* Vaqt filterlari */}
        <Segmented
          size="small"
          value={selectedPeriod}
          onChange={(value) => {
            setSelectedPeriod(value as PeriodType);
            if (value !== "custom") setCustomDateRange(null);
            setPage(1);
          }}
          options={PERIOD_OPTIONS}
        />

        {/* Custom date range picker */}
        {selectedPeriod === "custom" || customDateRange ? (
          <RangePicker
            size="small"
            value={customDateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setCustomDateRange([dates[0], dates[1]]);
                setSelectedPeriod("custom");
              } else {
                setCustomDateRange(null);
                setSelectedPeriod("today");
              }
              setPage(1);
            }}
            format="DD.MM.YYYY"
            style={{ width: 200 }}
          />
        ) : null}

        {responseData?.periodLabel && selectedPeriod !== "today" && (
          <Tag color="blue">{responseData.periodLabel}</Tag>
        )}

        <Divider />

        <StatItem
          icon={<TeamOutlined />}
          value={stats.total}
          label="jami"
          color="#1890ff"
          tooltip="Jami o'quvchilar"
        />
        <Divider />
        <StatItem
          icon={<CheckCircleOutlined />}
          value={stats.present}
          label={isSingleDay ? "kelgan" : "kelgan (jami)"}
          color={STATUS_COLORS.PRESENT}
          tooltip={
            isSingleDay ? "Kelganlar" : "Vaqt oralig'ida kelgan kunlar soni"
          }
        />
        <StatItem
          icon={<ClockCircleOutlined />}
          value={stats.late}
          label={isSingleDay ? "kech qoldi" : "kech (jami)"}
          color={STATUS_COLORS.LATE}
          tooltip={
            isSingleDay
              ? "Kech qolganlar (scan bilan)"
              : "Vaqt oralig'ida kech qolgan kunlar soni"
          }
        />
        <StatItem
          icon={<CloseCircleOutlined />}
          value={stats.absent}
          label={isSingleDay ? "kelmadi" : "yo'q (jami)"}
          color={STATUS_COLORS.ABSENT}
          tooltip={
            isSingleDay
              ? "Kelmadi (cutoff o'tgan)"
              : "Vaqt oralig'ida kelmagan kunlar soni"
          }
        />
        {isSingleDay && (stats.pendingLate || 0) > 0 && (
          <StatItem
            icon={<ClockCircleOutlined />}
            value={stats.pendingLate || 0}
            label="kechikmoqda"
            color={EFFECTIVE_STATUS_META.PENDING_LATE.color}
            tooltip="Dars boshlangan, cutoff o'tmagan"
          />
        )}
        {isSingleDay && (stats.pendingEarly || 0) > 0 && (
          <StatItem
            icon={<CloseCircleOutlined />}
            value={stats.pendingEarly || 0}
            label="hali kelmagan"
            color={EFFECTIVE_STATUS_META.PENDING_EARLY.color}
            tooltip="Dars hali boshlanmagan"
          />
        )}
        <Divider />
        <Input
          placeholder="Qidirish..."
          prefix={<SearchOutlined />}
          value={searchInput}
          onChange={(e) => {
            const value = e.target.value;
            setSearchInput(value);
            debouncedSetSearch(value);
          }}
          style={{ width: 160 }}
          allowClear
          size="small"
        />
        <Select
          placeholder="Sinf"
          value={classFilter}
          onChange={setClassFilter}
          style={{ width: 100 }}
          allowClear
          size="small"
          options={classes.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={handleAdd}
        >
          Qo'shish
        </Button>
        <div style={{ display: "inline-block" }}>
          <input
            type="file"
            accept=".xlsx"
            style={{ display: "none" }}
            id="import-excel"
            onChange={handleImport}
          />
          <Button
            icon={<UploadOutlined />}
            size="small"
            onClick={() => document.getElementById("import-excel")?.click()}
          >
            Yuklash
          </Button>
        </div>
        <Space size={4}>
          <Switch
            size="small"
            checked={allowCreateMissingClass}
            onChange={setAllowCreateMissingClass}
          />
          <Text type="secondary" style={{ fontSize: 12 }}>
            Sinf yo'q bo'lsa yaratish
          </Text>
        </Space>
        <Button size="small" onClick={handleDownloadTemplate}>
          Shablon
        </Button>
        <Button icon={<DownloadOutlined />} size="small" onClick={handleExport}>
          Eksport
        </Button>
      </PageHeader>

      <Table
        dataSource={students}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          current: page,
          total,
          pageSize: DEFAULT_PAGE_SIZE,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (total) => `Jami: ${total}`,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/students/${record.id}`),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              navigate(`/students/${record.id}`);
            }
          },
          role: "button",
          tabIndex: 0,
          style: { cursor: "pointer" },
        })}
      />

      <Modal
        title={editingId ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Saqlash"
        cancelText="Bekor"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="deviceStudentId" label="Qurilma ID (qurilmadagi)">
            <Input placeholder="Student ID" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Ism familiya"
            rules={[{ required: true, message: "Ismni kiriting" }]}
          >
            <Input placeholder="Masalan: Aliyev Ali" />
          </Form.Item>
          <Form.Item
            name="classId"
            label="Sinf"
            rules={[{ required: true, message: "Sinfni tanlang" }]}
          >
            <Select
              placeholder="Sinfni tanlang"
              options={classes.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="fatherName" label="Otasining ismi">
            <Input placeholder="Masalan: Aliyev Vali" />
          </Form.Item>
          <Form.Item name="parentPhone" label="Telefon raqami">
            <Input placeholder="+998 XX XXX XX XX" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Import xatolari"
        open={importErrorOpen}
        onCancel={() => setImportErrorOpen(false)}
        onOk={() => setImportErrorOpen(false)}
        okText="Yopish"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <div style={{ maxHeight: 300, overflow: "auto" }}>
          {importErrors.length === 0 ? (
            <Text type="secondary">Xatoliklar yo'q</Text>
          ) : (
            importErrors.slice(0, 50).map((e, idx) => (
              <div key={`${e.row}-${idx}`}>
                <Text>
                  {e.row}-qatorda: {e.message}
                </Text>
              </div>
            ))
          )}
          {importErrors.length > 50 && (
            <Text type="secondary">
              Yana {importErrors.length - 50} ta xatolik bor
            </Text>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Students;

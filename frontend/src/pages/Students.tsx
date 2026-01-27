import React, { useEffect, useState, useMemo } from "react";
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
import type { PeriodType } from "../types";
import { PageHeader, Divider } from "../components";
import { StatItem } from "../components/StatItem";
import { getAssetUrl, DEFAULT_PAGE_SIZE } from "../config";
import type { Student, Class } from "../types";
import dayjs from "dayjs";

const { Text } = Typography;
const { RangePicker } = DatePicker;

// Vaqt filterlari opsiyalari
const PERIOD_OPTIONS = [
  { label: 'Bugun', value: 'today' },
  { label: 'Kecha', value: 'yesterday' },
  { label: 'Hafta', value: 'week' },
  { label: 'Oy', value: 'month' },
  { label: 'Yil', value: 'year' },
];

const Students: React.FC = () => {
  const { schoolId } = useSchool();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Vaqt filterlari
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>('today');
  const [customDateRange, setCustomDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [responseData, setResponseData] = useState<StudentsResponse | null>(null);

  const fetchStudents = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const params: any = {
        page,
        search,
        classId: classFilter,
        period: selectedPeriod,
      };
      
      if (selectedPeriod === 'custom' && customDateRange) {
        params.startDate = customDateRange[0].format('YYYY-MM-DD');
        params.endDate = customDateRange[1].format('YYYY-MM-DD');
      }
      
      const data = await studentsService.getAll(schoolId, params);
      setStudents(data.data || []);
      setTotal(data.total || 0);
      setResponseData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
    fetchStudents();
    fetchClasses();
  }, [schoolId, page, search, classFilter, selectedPeriod, customDateRange]);

  // Statistikalar - API'dan kelgan stats'dan olish
  const stats = useMemo(() => {
    if (responseData?.stats) {
      return responseData.stats;
    }
    // Fallback
    const present = students.filter(s => (s.todayEffectiveStatus || s.todayStatus) === 'PRESENT').length;
    const late = students.filter(s => (s.todayEffectiveStatus || s.todayStatus) === 'LATE').length;
    const absent = students.filter(s => (s.todayEffectiveStatus || s.todayStatus) === 'ABSENT').length;
    const excused = students.filter(s => (s.todayEffectiveStatus || s.todayStatus) === 'EXCUSED').length;
    const pending = students.filter(s => (s.todayEffectiveStatus || s.todayStatus) === 'PENDING').length;
    return { total, present, late, absent, excused, pending };
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

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId) return;

    const hide = message.loading("Yuklanmoqda...", 0);
    try {
      const result = await studentsService.importExcel(schoolId, file);
      message.success(`${result.imported} ta o'quvchi yuklandi`);
      fetchStudents();
    } catch (err) {
      message.error("Yuklashda xatolik. Fayl formatini tekshiring.");
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
        <Avatar
          src={getAssetUrl(url)}
          icon={<UserOutlined />}
          size="small"
        />
      ),
    },
    { 
      title: "ID", 
      dataIndex: "deviceStudentId", 
      key: "id", 
      width: 70,
      render: (id: string) => <Text type="secondary" style={{ fontSize: 11 }}>{id || '-'}</Text>
    },
    { 
      title: "Ism", 
      dataIndex: "name", 
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>
    },
    {
      title: "Sinf",
      dataIndex: "class",
      key: "class",
      width: 80,
      render: (cls: Class | undefined) => cls?.name ? <Tag>{cls.name}</Tag> : <Text type="secondary">-</Text>,
    },
    // Bitta kun uchun - holat ustuni
    ...(isSingleDay ? [{
      title: "Holat",
      key: "status",
      width: 140,
      render: (_: any, record: Student) => {
        const effectiveStatus = record.todayEffectiveStatus || record.todayStatus;
        if (!effectiveStatus) {
          return <Tag color="default">-</Tag>;
        }
        const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
          PRESENT: { color: "green", text: "Kelgan", icon: <CheckCircleOutlined /> },
          LATE: { color: "orange", text: "Kech", icon: <ClockCircleOutlined /> },
          ABSENT: { color: "red", text: "Kelmagan", icon: <CloseCircleOutlined /> },
          EXCUSED: { color: "gray", text: "Sababli", icon: null },
          PENDING: { color: "default", text: "Kutilmoqda", icon: null },
        };
        const config = statusConfig[effectiveStatus] || { color: "default", text: effectiveStatus, icon: null };
        const time = record.todayFirstScan
          ? new Date(record.todayFirstScan).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
          : "";
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text} {time && `(${time})`}
          </Tag>
        );
      },
    }] : []),
    // Ko'p kun uchun - statistika ustunlari
    ...(!isSingleDay ? [
      {
        title: "Davomat %",
        key: "attendancePercent",
        width: 120,
        sorter: (a: any, b: any) => (a.periodStats?.attendancePercent || 0) - (b.periodStats?.attendancePercent || 0),
        render: (_: any, record: any) => {
          const percent = record.periodStats?.attendancePercent || 0;
          return (
            <Progress 
              percent={percent} 
              size="small" 
              status={percent >= 80 ? "success" : percent >= 60 ? "normal" : "exception"}
              format={(p) => `${p}%`}
            />
          );
        },
      },
      {
        title: <span style={{ color: "#52c41a" }}><CheckCircleOutlined /> Kelgan</span>,
        key: "present",
        width: 80,
        align: "center" as const,
        render: (_: any, record: any) => (
          <Text style={{ color: "#52c41a" }}>{record.periodStats?.presentCount || 0}</Text>
        ),
      },
      {
        title: <span style={{ color: "#faad14" }}><ClockCircleOutlined /> Kech</span>,
        key: "late",
        width: 80,
        align: "center" as const,
        render: (_: any, record: any) => (
          <Text style={{ color: "#faad14" }}>{record.periodStats?.lateCount || 0}</Text>
        ),
      },
      {
        title: <span style={{ color: "#ff4d4f" }}><CloseCircleOutlined /> Yo'q</span>,
        key: "absent",
        width: 80,
        align: "center" as const,
        render: (_: any, record: any) => (
          <Text style={{ color: "#ff4d4f" }}>{record.periodStats?.absentCount || 0}</Text>
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
    ] : []),
    {
      title: "",
      key: "actions",
      width: 120,
      render: (_: any, record: Student) => (
        <Space size={4}>
          <Button
            size="small"
            onClick={(e) => { e.stopPropagation(); navigate(`/students/${record.id}`); }}
          >
            Ko'rish
          </Button>
          <Button size="small" onClick={(e) => { e.stopPropagation(); handleEdit(record); }}>
            Tahrir
          </Button>
          <Popconfirm
            title="O'quvchini o'chirish?"
            description="Bu o'quvchining barcha ma'lumotlari o'chiriladi."
            onConfirm={async () => {
              try {
                await studentsService.delete(record.id);
                message.success('O\'quvchi o\'chirildi');
                fetchStudents();
              } catch (err) {
                message.error('O\'chirishda xatolik');
              }
            }}
            okText="Ha"
            cancelText="Yo'q"
          >
            <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
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
            if (value !== 'custom') setCustomDateRange(null);
            setPage(1);
          }}
          options={PERIOD_OPTIONS}
        />
        
        {/* Custom date range picker */}
        {selectedPeriod === 'custom' || customDateRange ? (
          <RangePicker
            size="small"
            value={customDateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setCustomDateRange([dates[0], dates[1]]);
                setSelectedPeriod('custom');
              } else {
                setCustomDateRange(null);
                setSelectedPeriod('today');
              }
              setPage(1);
            }}
            format="DD.MM.YYYY"
            style={{ width: 200 }}
          />
        ) : null}
        
        {responseData?.periodLabel && selectedPeriod !== 'today' && (
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
          color="#52c41a"
          tooltip={isSingleDay ? "Kelganlar" : "Vaqt oralig'ida kelgan kunlar soni"}
        />
        <StatItem 
          icon={<ClockCircleOutlined />} 
          value={stats.late} 
          label={isSingleDay ? "kech" : "kech (jami)"} 
          color="#faad14"
          tooltip={isSingleDay ? "Kech qolganlar" : "Vaqt oralig'ida kech qolgan kunlar soni"}
        />
        <StatItem 
          icon={<CloseCircleOutlined />} 
          value={stats.absent} 
          label={isSingleDay ? "yo'q" : "yo'q (jami)"} 
          color="#ff4d4f"
          tooltip={isSingleDay ? "Kelmaganlar" : "Vaqt oralig'ida kelmagan kunlar soni"}
        />
        <Divider />
        <Input
          placeholder="Qidirish..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
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
            <Input placeholder="Qurilmadagi o'quvchi ID" />
          </Form.Item>
          <Form.Item name="name" label="Ism familiya" rules={[{ required: true, message: "Ismni kiriting" }]}>
            <Input placeholder="Masalan: Aliyev Ali" />
          </Form.Item>
          <Form.Item name="classId" label="Sinf">
            <Select
              placeholder="Sinfni tanlang"
              options={classes.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="parentName" label="Ota-ona ismi">
            <Input placeholder="Masalan: Aliyev Vali" />
          </Form.Item>
          <Form.Item name="parentPhone" label="Telefon raqami">
            <Input placeholder="+998 XX XXX XX XX" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Students;



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
import { classesService } from "../services/classes";
import { PageHeader, Divider } from "../components";
import { StatItem } from "../components/StatItem";
import { getAssetUrl, DEFAULT_PAGE_SIZE } from "../config";
import type { Student, Class } from "../types";

const { Text } = Typography;

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

  const fetchStudents = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await studentsService.getAll(schoolId, {
        page,
        search,
        classId: classFilter,
      });
      setStudents(data.data || []);
      setTotal(data.total || 0);
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
  }, [schoolId, page, search, classFilter]);

  // Statistikalar
  const stats = useMemo(() => {
    const present = students.filter(s => s.todayStatus === 'PRESENT').length;
    const late = students.filter(s => s.todayStatus === 'LATE').length;
    const absent = students.filter(s => s.todayStatus === 'ABSENT').length;
    return { total, present, late, absent };
  }, [students, total]);

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
      message.success("Export muvaffaqiyatli");
    } catch (err) {
      message.error("Export xatolik");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId) return;

    const hide = message.loading("Import qilinmoqda...", 0);
    try {
      const result = await studentsService.importExcel(schoolId, file);
      message.success(`${result.imported} ta o'quvchi import qilindi`);
      fetchStudents();
    } catch (err) {
      message.error("Import xatolik. Fayl formatini tekshiring.");
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
    {
      title: "Bugungi holat",
      key: "status",
      width: 140,
      render: (_: any, record: Student) => {
        if (!record.todayStatus) {
          return <Tag color="default">—</Tag>;
        }
        const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
          PRESENT: { color: "green", text: "Kelgan", icon: <CheckCircleOutlined /> },
          LATE: { color: "orange", text: "Kech", icon: <ClockCircleOutlined /> },
          ABSENT: { color: "red", text: "Kelmagan", icon: <CloseCircleOutlined /> },
          EXCUSED: { color: "gray", text: "Sababli", icon: null },
        };
        const config = statusConfig[record.todayStatus] || { color: "default", text: record.todayStatus, icon: null };
        const time = record.todayFirstScan 
          ? new Date(record.todayFirstScan).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })
          : "";
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text} {time && `(${time})`}
          </Tag>
        );
      },
    },
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
          label="kelgan" 
          color="#52c41a"
          tooltip="Bugun kelganlar"
        />
        <StatItem 
          icon={<ClockCircleOutlined />} 
          value={stats.late} 
          label="kech" 
          color="#faad14"
          tooltip="Kech qolganlar"
        />
        <StatItem 
          icon={<CloseCircleOutlined />} 
          value={stats.absent} 
          label="yo'q" 
          color="#ff4d4f"
          tooltip="Kelmaganlar"
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
            Import
          </Button>
        </div>
        <Button icon={<DownloadOutlined />} size="small" onClick={handleExport}>
          Export
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
          <Form.Item name="deviceStudentId" label="Device ID (qurilmadagi)">
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

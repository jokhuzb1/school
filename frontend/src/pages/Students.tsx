import React, { useEffect, useState } from "react";
import {
  Table,
  Button,
  Input,
  Select,
  Space,
  Tag,
  Avatar,
  message,
  Modal,
  Form,
} from "antd";
import {
  PlusOutlined,
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSchool } from "../hooks/useSchool";
import { studentsService } from "../services/students";
import { classesService } from "../services/classes";
import type { Student, Class } from "../types";

const Students: React.FC = () => {
  const { schoolId } = useSchool();
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
        message.success("Student updated");
      } else {
        await studentsService.create(schoolId!, values);
        message.success("Student created");
      }
      setModalOpen(false);
      fetchStudents();
    } catch (err) {
      message.error("Failed to save student");
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
      message.success("Export successful");
    } catch (err) {
      message.error("Failed to export students");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !schoolId) return;

    const hide = message.loading("Importing students...", 0);
    try {
      const result = await studentsService.importExcel(schoolId, file);
      message.success(`Successfully imported ${result.imported} students`);
      fetchStudents();
    } catch (err) {
      message.error("Failed to import students. Please check the file format.");
    } finally {
      hide();
      e.target.value = ""; // Reset input
    }
  };

  const columns = [
    {
      title: "Photo",
      dataIndex: "photoUrl",
      key: "photo",
      width: 60,
      render: (url: string) => (
        <Avatar
          src={url ? `http://localhost:4000/${url}` : undefined}
          icon={<UserOutlined />}
        />
      ),
    },
    { title: "ID", dataIndex: "deviceStudentId", key: "id", width: 80 },
    { title: "Name", dataIndex: "name", key: "name" },
    {
      title: "Class",
      dataIndex: "class",
      key: "class",
      render: (cls: Class | undefined) => cls?.name || "-",
    },
    {
      title: "Status",
      key: "status",
      render: () => <Tag color="default">-</Tag>, // TODO: fetch today's status
    },
    {
      title: "Actions",
      key: "actions",
      render: (_: any, record: Student) => (
        <Space>
          <Button
            size="small"
            onClick={() => navigate(`/students/${record.id}`)}
          >
            View
          </Button>
          <Button size="small" onClick={() => handleEdit(record)}>
            Edit
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16, flexWrap: "wrap" }} size="middle">
        <Input
          placeholder="Search students..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="Filter by class"
          value={classFilter}
          onChange={setClassFilter}
          style={{ width: 150 }}
          allowClear
          options={classes.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Add Student
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
            onClick={() => document.getElementById("import-excel")?.click()}
          >
            Import Excel
          </Button>
        </div>
        <Button icon={<DownloadOutlined />} onClick={handleExport}>
          Export
        </Button>
      </Space>

      <Table
        dataSource={students}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 50,
          onChange: setPage,
          showSizeChanger: false,
        }}
        onRow={(record) => ({
          onClick: () => navigate(`/students/${record.id}`),
          style: { cursor: "pointer" },
        })}
      />

      <Modal
        title={editingId ? "Edit Student" : "Add Student"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="deviceStudentId" label="Device Student ID">
            <Input />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="classId" label="Class">
            <Select
              options={classes.map((c) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
          <Form.Item name="parentName" label="Parent Name">
            <Input />
          </Form.Item>
          <Form.Item name="parentPhone" label="Parent Phone">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Students;

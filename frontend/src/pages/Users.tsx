import React, { useEffect, useState, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Space,
  Popconfirm,
  App,
  Typography,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  UserOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  BookOutlined,
  LinkOutlined,
  EditOutlined,
} from "@ant-design/icons";
import { useSchool } from "../hooks/useSchool";
import { usersService } from "../services/users";
import type { User, CreateUserData, TeacherClass } from "../services/users";
import { classesService } from "../services/classes";
import { PageHeader, Divider, StatItem, useHeaderMeta } from "../shared/ui";
import type { Class } from "../types";

const { Text } = Typography;

const Users: React.FC = () => {
  const { schoolId } = useSchool();
  const { message } = App.useApp();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const [users, setUsers] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<User | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [form] = Form.useForm<CreateUserData>();
  const [assignForm] = Form.useForm();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      const data = await usersService.getAll(schoolId);
      setUsers(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, setLastUpdated]);

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
    fetchUsers();
    fetchClasses();
  }, [fetchUsers, fetchClasses]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchUsers(), fetchClasses()]);
    setLastUpdated(new Date());
  }, [fetchUsers, fetchClasses, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  const handleAdd = () => {
    form.resetFields();
    setModalOpen(true);
  };

  const handleSubmit = async (values: CreateUserData) => {
    if (!schoolId) return;
    try {
      await usersService.create(schoolId, values);
      message.success("Foydalanuvchi qo'shildi");
      setModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      message.error(err.response?.data?.error || "Xatolik yuz berdi");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!schoolId) return;
    try {
      await usersService.delete(schoolId, userId);
      message.success("Foydalanuvchi o'chirildi");
      fetchUsers();
    } catch (err) {
      message.error("O'chirishda xatolik");
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUser(user);
    editForm.setFieldsValue({ name: user.name, password: "" });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (values: {
    name: string;
    password?: string;
  }) => {
    if (!schoolId || !editingUser) return;
    try {
      const data: { name?: string; password?: string } = {};
      if (values.name) data.name = values.name;
      if (values.password) data.password = values.password;
      await usersService.update(schoolId, editingUser.id, data);
      message.success("Foydalanuvchi yangilandi");
      setEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      message.error(err.response?.data?.error || "Yangilashda xatolik");
    }
  };

  const handleAssignClick = async (teacher: User) => {
    if (!schoolId) return;
    setSelectedTeacher(teacher);
    try {
      const assigned = await usersService.getTeacherClasses(
        schoolId,
        teacher.id,
      );
      setTeacherClasses(assigned);
      assignForm.resetFields();
      setAssignModalOpen(true);
    } catch (err) {
      message.error("Sinflarni olishda xatolik");
    }
  };

  const handleAssignClass = async (values: { classId: string }) => {
    if (!schoolId || !selectedTeacher) return;
    try {
      await usersService.assignClass(
        schoolId,
        selectedTeacher.id,
        values.classId,
      );
      message.success("Sinfga biriktirildi");
      const assigned = await usersService.getTeacherClasses(
        schoolId,
        selectedTeacher.id,
      );
      setTeacherClasses(assigned);
      assignForm.resetFields();
    } catch (err: any) {
      message.error(err.response?.data?.error || "Biriktirishda xatolik");
    }
  };

  const handleUnassignClass = async (classId: string) => {
    if (!schoolId || !selectedTeacher) return;
    try {
      await usersService.unassignClass(schoolId, selectedTeacher.id, classId);
      message.success("Sinfdan chiqarildi");
      const assigned = await usersService.getTeacherClasses(
        schoolId,
        selectedTeacher.id,
      );
      setTeacherClasses(assigned);
    } catch (err) {
      message.error("Chiqarishda xatolik");
    }
  };

  // Stats
  const teacherCount = users.filter((u) => u.role === "TEACHER").length;
  const guardCount = users.filter((u) => u.role === "GUARD").length;

  // Available classes for assignment (not yet assigned)
  const availableClasses = classes.filter(
    (c) => !teacherClasses.some((tc) => tc.id === c.id),
  );

  const columns = [
    {
      title: "Ism",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: User) => (
        <Space>
          {record.role === "TEACHER" ? (
            <UserOutlined style={{ color: "#1890ff" }} />
          ) : (
            <SafetyCertificateOutlined style={{ color: "#52c41a" }} />
          )}
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string) => <Text type="secondary">{email}</Text>,
    },
    {
      title: "Rol",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={role === "TEACHER" ? "blue" : "green"}>
          {role === "TEACHER" ? "O'qituvchi" : "Nazoratchi"}
        </Tag>
      ),
    },
    {
      title: "Amallar",
      key: "actions",
      width: 150,
      render: (_: any, record: User) => (
        <Space>
          <Tooltip title="Tahrirlash">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick(record);
              }}
            />
          </Tooltip>
          {record.role === "TEACHER" && (
            <Tooltip title="Sinfga biriktirish">
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAssignClick(record);
                }}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="Rostdan o'chirmoqchimisiz?"
            onConfirm={(e) => {
              e?.stopPropagation();
              handleDelete(record.id);
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader>
        <StatItem
          icon={<UserOutlined />}
          value={teacherCount}
          label="o'qituvchi"
          color="#1890ff"
          tooltip="O'qituvchilar soni"
        />
        <StatItem
          icon={<SafetyCertificateOutlined />}
          value={guardCount}
          label="nazoratchi"
          color="#52c41a"
          tooltip="Nazoratchilar soni"
        />
        <Divider />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="small"
          onClick={handleAdd}
        >
          Qo'shish
        </Button>
      </PageHeader>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
      />

      {/* Create User Modal */}
      <Modal
        title="Yangi foydalanuvchi"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        okText="Saqlash"
        cancelText="Bekor"
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Ism familiya"
            rules={[{ required: true, message: "Ismni kiriting" }]}
          >
            <Input placeholder="Masalan: Aliyev Vali" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: "Email kiriting" },
              { type: "email", message: "Noto'g'ri email formati" },
            ]}
          >
            <Input placeholder="masalan@email.com" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Parol"
            rules={[
              { required: true, message: "Parol kiriting" },
              { min: 6, message: "Kamida 6 ta belgi" },
            ]}
          >
            <Input.Password placeholder="Kamida 6 ta belgi" />
          </Form.Item>
          <Form.Item
            name="role"
            label="Rol"
            rules={[{ required: true, message: "Rolni tanlang" }]}
          >
            <Select
              placeholder="Tanlang"
              options={[
                { value: "TEACHER", label: "O'qituvchi" },
                { value: "GUARD", label: "Nazoratchi" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Assign Classes Modal */}
      <Modal
        title={`${selectedTeacher?.name} — Sinflar`}
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong>Biriktirilgan sinflar:</Text>
          <div style={{ marginTop: 8 }}>
            {teacherClasses.length === 0 ? (
              <Text type="secondary">Hech qanday sinf biriktirilmagan</Text>
            ) : (
              <Space wrap>
                {teacherClasses.map((cls) => (
                  <Tag
                    key={cls.id}
                    closable
                    onClose={() => handleUnassignClass(cls.id)}
                    color="blue"
                  >
                    <BookOutlined /> {cls.name}
                  </Tag>
                ))}
              </Space>
            )}
          </div>
        </div>

        <Divider />

        <Form form={assignForm} layout="inline" onFinish={handleAssignClass}>
          <Form.Item
            name="classId"
            rules={[{ required: true, message: "Sinfni tanlang" }]}
            style={{ flex: 1 }}
          >
            <Select
              placeholder="Sinf tanlang"
              options={availableClasses.map((c) => ({
                value: c.id,
                label: `${c.name} (${c.gradeLevel}-sinf)`,
              }))}
              disabled={availableClasses.length === 0}
            />
          </Form.Item>
          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              disabled={availableClasses.length === 0}
            >
              Biriktirish
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="Foydalanuvchini tahrirlash"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={() => editForm.submit()}
        okText="Saqlash"
        cancelText="Bekor"
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item
            name="name"
            label="Ism familiya"
            rules={[{ required: true, message: "Ismni kiriting" }]}
          >
            <Input placeholder="Masalan: Aliyev Vali" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Yangi parol (ixtiyoriy)"
            rules={[{ min: 6, message: "Kamida 6 ta belgi" }]}
          >
            <Input.Password placeholder="Bo'sh qoldiring agar o'zgartirmaysiz" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Form, Table } from "antd";
import { PlusOutlined, SafetyCertificateOutlined, UserOutlined } from "@ant-design/icons";
import { useSchool } from "@entities/school";
import { usersService } from "@entities/user";
import type { CreateUserData, TeacherClass, User } from "@entities/user";
import { classesService } from "@entities/class";
import { Divider, PageHeader, StatItem, useHeaderMeta } from "../shared/ui";
import type { Class } from "@shared/types";
import { buildUsersColumns } from "./usersColumns";
import { UserCreateModal } from "./UserCreateModal";
import { UserAssignClassesModal } from "./UserAssignClassesModal";
import { UserEditModal } from "./UserEditModal";

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
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm<CreateUserData>();
  const [assignForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      setUsers(await usersService.getAll(schoolId));
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
      setClasses(await classesService.getAll(schoolId));
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

  const handleDelete = useCallback(
    async (userId: string) => {
      if (!schoolId) return;
      try {
        await usersService.delete(schoolId, userId);
        message.success("Foydalanuvchi o'chirildi");
        fetchUsers();
      } catch {
        message.error("O'chirishda xatolik");
      }
    },
    [schoolId, message, fetchUsers],
  );

  const handleAssignClick = useCallback(
    async (teacher: User) => {
      if (!schoolId) return;
      setSelectedTeacher(teacher);
      try {
        setTeacherClasses(await usersService.getTeacherClasses(schoolId, teacher.id));
        assignForm.resetFields();
        setAssignModalOpen(true);
      } catch {
        message.error("Sinflarni olishda xatolik");
      }
    },
    [schoolId, assignForm, message],
  );

  const availableClasses = useMemo(
    () => classes.filter((c) => !teacherClasses.some((tc) => tc.id === c.id)),
    [classes, teacherClasses],
  );

  const columns = useMemo(
    () =>
      buildUsersColumns({
        onEdit: (user) => {
          setEditingUser(user);
          editForm.setFieldsValue({ name: user.name, password: "" });
          setEditModalOpen(true);
        },
        onAssign: handleAssignClick,
        onDelete: handleDelete,
      }),
    [editForm, handleAssignClick, handleDelete],
  );

  const teacherCount = users.filter((u) => u.role === "TEACHER").length;
  const guardCount = users.filter((u) => u.role === "GUARD").length;

  return (
    <div>
      <PageHeader>
        <StatItem icon={<UserOutlined />} value={teacherCount} label="o'qituvchi" color="#1890ff" tooltip="O'qituvchilar soni" />
        <StatItem icon={<SafetyCertificateOutlined />} value={guardCount} label="nazoratchi" color="#52c41a" tooltip="Nazoratchilar soni" />
        <Divider />
        <Button type="primary" icon={<PlusOutlined />} size="small" onClick={() => { form.resetFields(); setModalOpen(true); }}>
          Qo'shish
        </Button>
      </PageHeader>

      <Table dataSource={users} columns={columns} rowKey="id" loading={loading} size="middle" />

      <UserCreateModal
        open={modalOpen}
        form={form}
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => {
          if (!schoolId) return;
          try {
            await usersService.create(schoolId, values);
            message.success("Foydalanuvchi qo'shildi");
            setModalOpen(false);
            fetchUsers();
          } catch (err: any) {
            message.error(err.response?.data?.error || "Xatolik yuz berdi");
          }
        }}
      />

      <UserAssignClassesModal
        open={assignModalOpen}
        selectedTeacher={selectedTeacher}
        teacherClasses={teacherClasses}
        availableClasses={availableClasses}
        form={assignForm}
        onClose={() => setAssignModalOpen(false)}
        onAssign={async (values) => {
          if (!schoolId || !selectedTeacher) return;
          try {
            await usersService.assignClass(schoolId, selectedTeacher.id, values.classId);
            message.success("Sinfga biriktirildi");
            setTeacherClasses(await usersService.getTeacherClasses(schoolId, selectedTeacher.id));
            assignForm.resetFields();
          } catch (err: any) {
            message.error(err.response?.data?.error || "Biriktirishda xatolik");
          }
        }}
        onUnassign={async (classId) => {
          if (!schoolId || !selectedTeacher) return;
          try {
            await usersService.unassignClass(schoolId, selectedTeacher.id, classId);
            message.success("Sinfdan chiqarildi");
            setTeacherClasses(await usersService.getTeacherClasses(schoolId, selectedTeacher.id));
          } catch {
            message.error("Chiqarishda xatolik");
          }
        }}
      />

      <UserEditModal
        open={editModalOpen}
        form={editForm}
        onClose={() => setEditModalOpen(false)}
        onSubmit={async (values) => {
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
        }}
      />
    </div>
  );
};

export default Users;


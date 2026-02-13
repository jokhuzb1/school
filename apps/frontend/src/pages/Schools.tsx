import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Form, Input, Segmented, Table, Typography } from "antd";
import { BankOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { schoolsService } from "@entities/school";
import { Divider, PageHeader, StatGroup, StatItem, useHeaderMeta } from "../shared/ui";
import type { AttendanceScope, School } from "@shared/types";
import { buildSchoolsColumns } from "./schoolsColumns";
import { SchoolFormModal } from "./SchoolFormModal";

const { Text } = Typography;
const AUTO_REFRESH_MS = 60000;

const Schools: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>("started");
  const [form] = Form.useForm();

  const fetchSchools = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        setSchools(await schoolsService.getAll(attendanceScope));
        setLastUpdated(new Date());
      } catch (err) {
        console.error(err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [attendanceScope, setLastUpdated],
  );

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  useEffect(() => {
    const timer = setInterval(() => fetchSchools(true), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchSchools]);

  const handleRefresh = useCallback(async () => {
    await fetchSchools();
    setLastUpdated(new Date());
  }, [fetchSchools, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  const stats = useMemo(() => {
    const totalStudents = schools.reduce((sum, s) => sum + (s._count?.students || 0), 0);
    const totalClasses = schools.reduce((sum, s) => sum + (s._count?.classes || 0), 0);
    return { total: schools.length, totalStudents, totalClasses };
  }, [schools]);

  const filteredSchools = useMemo(() => {
    if (!searchText.trim()) return schools;
    const search = searchText.toLowerCase();
    return schools.filter(
      (s) => s.name.toLowerCase().includes(search) || s.address?.toLowerCase().includes(search),
    );
  }, [schools, searchText]);

  const openSchoolDashboard = useCallback(
    (school: School) => {
      navigate(`/schools/${school.id}/dashboard`, {
        state: { backTo: location.pathname, schoolName: school.name },
      });
    },
    [navigate, location.pathname],
  );

  const columns = useMemo(
    () =>
      buildSchoolsColumns({
        onEdit: (record) => {
          setEditingId(record.id);
          form.setFieldsValue(record);
          setModalOpen(true);
        },
        onDelete: async (id) => {
          try {
            await schoolsService.delete(id);
            message.success("Maktab o'chirildi");
            fetchSchools();
          } catch {
            message.error("O'chirishda xatolik");
          }
        },
        onOpenSchool: openSchoolDashboard,
      }),
    [form, message, fetchSchools, openSchoolDashboard],
  );

  return (
    <div>
      <PageHeader>
        <StatGroup>
          <StatItem icon={<BankOutlined />} value={stats.total} label="maktab" color="#722ed1" tooltip="Jami maktablar" />
          <StatItem icon={<TeamOutlined />} value={stats.totalStudents} label="o'quvchi" color="#1890ff" tooltip="Jami o'quvchilar" />
          <StatItem icon={<BankOutlined />} value={stats.totalClasses} label="sinf" color="#52c41a" tooltip="Jami sinflar" />
        </StatGroup>

        <Divider />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Ko'rinish:
          </Text>
          <Segmented
            size="middle"
            value={attendanceScope}
            onChange={(value) => setAttendanceScope(value as AttendanceScope)}
            options={[
              { label: "Boshlangan", value: "started" },
              { label: "Faol", value: "active" },
            ]}
          />
        </div>

        <Input
          placeholder="Qidirish..."
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 200, borderRadius: 8 }}
          allowClear
          size="middle"
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            setEditingId(null);
            form.resetFields();
            setModalOpen(true);
          }}
          style={{ borderRadius: 8 }}
        >
          Maktab qo'shish
        </Button>
      </PageHeader>

      <Table
        dataSource={filteredSchools}
        columns={columns}
        rowKey="id"
        loading={loading}
        size="middle"
        onRow={(record) => ({
          onClick: () => openSchoolDashboard(record),
          onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openSchoolDashboard(record);
            }
          },
          role: "button",
          tabIndex: 0,
          style: { cursor: "pointer" },
        })}
      />

      <SchoolFormModal
        open={modalOpen}
        editingId={editingId}
        form={form}
        onClose={() => setModalOpen(false)}
        onSubmit={async (values) => {
          try {
            if (editingId) {
              await schoolsService.update(editingId, values);
              message.success("Maktab yangilandi");
            } else {
              await schoolsService.create(values);
              message.success("Maktab qo'shildi");
            }
            setModalOpen(false);
            fetchSchools();
          } catch {
            message.error("Saqlashda xatolik");
          }
        }}
      />
    </div>
  );
};

export default Schools;


import React, { useCallback, useEffect, useMemo, useState } from "react";
import { App, Button, Card, Col, Form, Row, Table } from "antd";
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoginOutlined,
  LogoutOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useSchool } from "@entities/school";
import { devicesService } from "@entities/device";
import { schoolsService } from "@entities/school";
import { Divider, PageHeader, StatItem, useHeaderMeta } from "../shared/ui";
import type { Device } from "@shared/types";
import { buildDevicesColumns } from "./devicesColumns";
import { DeviceFormModal } from "./DeviceFormModal";
import { DeviceWebhookCard } from "./DeviceWebhookCard";

const Devices: React.FC = () => {
  const { schoolId, isSchoolAdmin, isSuperAdmin } = useSchool();
  const { message } = App.useApp();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const [devices, setDevices] = useState<Device[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<{
    enforceSecret: boolean;
    secretHeaderName: string;
    inUrl: string;
    outUrl: string;
    inUrlWithSecret: string;
    outUrlWithSecret: string;
    inSecret: string;
    outSecret: string;
  } | null>(null);
  const [showWebhookAdvanced, setShowWebhookAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const canManage = isSchoolAdmin || isSuperAdmin;

  const fetchDevices = useCallback(async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      setDevices(await devicesService.getAll(schoolId));
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [schoolId, setLastUpdated]);

  const fetchWebhookInfo = useCallback(async () => {
    if (!schoolId || !canManage) return;
    try {
      setWebhookInfo(await schoolsService.getWebhookInfo(schoolId));
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
    }
  }, [schoolId, canManage, setLastUpdated]);

  useEffect(() => {
    fetchDevices();
    fetchWebhookInfo();
  }, [fetchDevices, fetchWebhookInfo]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchDevices(), fetchWebhookInfo()]);
    setLastUpdated(new Date());
  }, [fetchDevices, fetchWebhookInfo, setLastUpdated]);

  useEffect(() => {
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [handleRefresh, setRefresh]);

  const stats = useMemo(() => {
    const online = devices.filter(
      (d) => d.lastSeenAt && dayjs().diff(dayjs(d.lastSeenAt), "hour") < 2,
    ).length;
    return {
      total: devices.length,
      online,
      offline: devices.length - online,
      entrance: devices.filter((d) => d.type === "ENTRANCE").length,
      exit: devices.filter((d) => d.type === "EXIT").length,
    };
  }, [devices]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      message.success("Nusxalandi!");
    } catch {
      message.error("Nusxalashda xatolik");
    }
  };

  const handleEdit = useCallback(
    (record: Device) => {
      setEditingId(record.id);
      form.setFieldsValue(record);
      setModalOpen(true);
    },
    [form],
  );

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await devicesService.delete(id);
        message.success("Qurilma o'chirildi");
        fetchDevices();
      } catch {
        message.error("O'chirishda xatolik");
      }
    },
    [message, fetchDevices],
  );

  const columns = useMemo(
    () =>
      buildDevicesColumns({
        canManage,
        onEdit: handleEdit,
        onDelete: handleDelete,
      }),
    [canManage, handleEdit, handleDelete],
  );

  return (
    <div>
      <PageHeader>
        <StatItem icon={<ApiOutlined />} value={stats.total} label="jami" color="#1890ff" tooltip="Jami qurilmalar" />
        <Divider />
        <StatItem icon={<CheckCircleOutlined />} value={stats.online} label="" color="#52c41a" tooltip="Onlayn qurilmalar" />
        <StatItem icon={<CloseCircleOutlined />} value={stats.offline} label="" color="#ff4d4f" tooltip="Oflayn qurilmalar" />
        <Divider />
        <StatItem icon={<LoginOutlined />} value={stats.entrance} label="kirish" color="#52c41a" tooltip="Kirish qurilmalari" />
        <StatItem icon={<LogoutOutlined />} value={stats.exit} label="chiqish" color="#1890ff" tooltip="Chiqish qurilmalari" />
      </PageHeader>

      <Row gutter={[12, 12]}>
        {canManage && (
          <DeviceWebhookCard
            webhookInfo={webhookInfo}
            showWebhookAdvanced={showWebhookAdvanced}
            setShowWebhookAdvanced={setShowWebhookAdvanced}
            copyToClipboard={copyToClipboard}
          />
        )}

        <Col xs={24} lg={16}>
          <Card
            title="Qurilmalar ro'yxati"
            size="small"
            extra={
              canManage ? (
                <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
                  Qo'shish
                </Button>
              ) : null
            }
          >
            <Table
              dataSource={devices}
              columns={columns}
              rowKey="id"
              loading={loading}
              size="small"
              pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => `Jami: ${total}` }}
            />
          </Card>
        </Col>
      </Row>

      {canManage && (
        <DeviceFormModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          onClose={() => setModalOpen(false)}
          onSubmit={async (values) => {
            try {
              if (editingId) {
                await devicesService.update(editingId, values);
                message.success("Qurilma yangilandi");
              } else {
                await devicesService.create(schoolId!, values);
                message.success("Qurilma qo'shildi");
              }
              setModalOpen(false);
              setEditingId(null);
              form.resetFields();
              fetchDevices();
            } catch {
              message.error("Saqlashda xatolik");
            }
          }}
        />
      )}
    </div>
  );
};

export default Devices;


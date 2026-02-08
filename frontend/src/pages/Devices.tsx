import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, Card, Typography, Popconfirm, Tag, App, Row, Col, Space, Tooltip } from 'antd';
import { 
    PlusOutlined, 
    DeleteOutlined, 
    EditOutlined, 
    CopyOutlined, 
    ApiOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    LoginOutlined,
    LogoutOutlined,
    EnvironmentOutlined,
    EyeOutlined,
    EyeInvisibleOutlined,
} from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { devicesService } from '../services/devices';
import { schoolsService } from '../services/schools';
import { PageHeader, Divider, StatItem, useHeaderMeta } from '../shared/ui';
import type { Device } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

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

    const fetchDevices = useCallback(async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await devicesService.getAll(schoolId);
            setDevices(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [schoolId, setLastUpdated]);

    const canManage = isSchoolAdmin || isSuperAdmin;

    const fetchWebhookInfo = useCallback(async () => {
        if (!schoolId) return;
        if (!canManage) return;
        try {
            const info = await schoolsService.getWebhookInfo(schoolId);
            setWebhookInfo(info);
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

    // Statistikalar
    const stats = useMemo(() => {
        const online = devices.filter(d => d.lastSeenAt && dayjs().diff(dayjs(d.lastSeenAt), 'hour') < 2).length;
        const entrance = devices.filter(d => d.type === 'ENTRANCE').length;
        const exit = devices.filter(d => d.type === 'EXIT').length;
        return { total: devices.length, online, offline: devices.length - online, entrance, exit };
    }, [devices]);

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text);
            message.success('Nusxalandi!');
        } catch (err) {
            message.error('Nusxalashda xatolik');
        }
    };

    const formatWebhookPath = (value?: string) => {
        if (!value) return '';
        if (value.startsWith('/')) return value;
        try {
            const url = new URL(value);
            return `${url.pathname}${url.search}`;
        } catch {
            return value;
        }
    };

    const maskValue = (value: string, kind: 'url' | 'secret' | 'header') => {
        if (!value) return '';
        if (kind === 'url') {
            // Keep path visible but mask secret query param if present
            const formatted = formatWebhookPath(value);
            return formatted.replace(/secret=[^&]+/i, 'secret=***');
        }
        // secrets/headers: fully masked (token-like)
        return '••••••••••••••••';
    };

    const CopyField: React.FC<{
        label: string;
        value: string;
        kind: 'url' | 'secret' | 'header';
        ariaCopyLabel: string;
    }> = ({ label, value, kind, ariaCopyLabel }) => {
        const [visible, setVisible] = useState(false);

        const displayValue = visible
            ? (kind === 'url' ? formatWebhookPath(value) : value)
            : maskValue(value, kind);

        return (
            <div>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    {label}
                </Text>
                <Input.Group compact>
                    <Input value={displayValue} readOnly style={{ width: 'calc(100% - 64px)' }} size="small" />
                    <Tooltip title={visible ? "Yashirish" : "Ko'rsatish"}>
                        <Button
                            icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                            size="small"
                            aria-label={`${label} ${visible ? "yashirish" : "ko'rsatish"}`}
                            onClick={() => setVisible((v) => !v)}
                        />
                    </Tooltip>
                    <Tooltip title="Nusxalash">
                        <Button
                            icon={<CopyOutlined />}
                            size="small"
                            aria-label={ariaCopyLabel}
                            onClick={() => copyToClipboard(kind === 'url' ? formatWebhookPath(value) : value)}
                        />
                    </Tooltip>
                </Input.Group>
            </div>
        );
    };

    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        setModalOpen(true);
    };

    const handleEdit = (record: Device) => {
        setEditingId(record.id);
        form.setFieldsValue(record);
        setModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await devicesService.delete(id);
            message.success('Qurilma o\'chirildi');
            fetchDevices();
        } catch (err) {
            message.error('O\'chirishda xatolik');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            if (editingId) {
                await devicesService.update(editingId, values);
                message.success('Qurilma yangilandi');
            } else {
                await devicesService.create(schoolId!, values);
                message.success('Qurilma qo\'shildi');
            }
            setModalOpen(false);
            fetchDevices();
        } catch (err) {
            message.error('Saqlashda xatolik');
        }
    };

    const columns = [
        { 
            title: 'Nomi', 
            dataIndex: 'name', 
            key: 'name',
            render: (name: string, record: Device) => (
                <Space>
                    <Text strong>{name}</Text>
                    {record.location && (
                        <Tooltip title={record.location}>
                            <EnvironmentOutlined style={{ color: '#8c8c8c' }} aria-hidden="true" />
                        </Tooltip>
                    )}
                </Space>
            )
        },
        { 
            title: 'Qurilma ID', 
            dataIndex: 'deviceId', 
            key: 'deviceId',
            render: (id: string) => <Text copyable={{ text: id }} style={{ fontSize: 12 }}>{id}</Text>
        },
        {
            title: 'Turi',
            dataIndex: 'type',
            key: 'type',
            width: 100,
            render: (t: string) => (
                <Tag 
                    icon={t === 'ENTRANCE' ? <LoginOutlined /> : <LogoutOutlined />} 
                    color={t === 'ENTRANCE' ? 'success' : 'processing'}
                >
                    {t === 'ENTRANCE' ? 'Kirish' : 'Chiqish'}
                </Tag>
            ),
        },
        {
            title: 'Holat',
            key: 'status',
            width: 100,
            render: (_: any, record: Device) => {
                const isOnline = record.lastSeenAt && dayjs().diff(dayjs(record.lastSeenAt), 'hour') < 2;
                return (
                    <Tag 
                        icon={isOnline ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                        color={isOnline ? 'success' : 'error'}
                    >
                        {isOnline ? 'Onlayn' : 'Oflayn'}
                    </Tag>
                );
            },
        },
        { 
            title: 'Oxirgi faoliyat', 
            dataIndex: 'lastSeenAt', 
            key: 'lastSeen', 
            render: (t: string) => t ? (
                <Tooltip title={dayjs(t).format('DD MMM YYYY, HH:mm:ss')}>
                    <Text type="secondary">{dayjs(t).format('DD MMM HH:mm')}</Text>
                </Tooltip>
            ) : <Text type="secondary">-</Text>
        },
        ...(canManage ? [{
            title: '',
            key: 'actions',
            width: 80,
            render: (_: any, record: Device) => (
                <Space size={4}>
                    <Tooltip title="Tahrirlash">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            aria-label="Qurilmani tahrirlash"
                            onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                        />
                    </Tooltip>
                    <Popconfirm title="Qurilmani o'chirish?" onConfirm={() => handleDelete(record.id)} okText="Ha" cancelText="Yo'q">
                        <Tooltip title="O'chirish">
                            <Button
                                size="small"
                                icon={<DeleteOutlined />}
                                aria-label="Qurilmani o'chirish"
                                danger
                                onClick={(e) => e.stopPropagation()}
                            />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        }] : []),
    ];

    return (
        <div>
            {/* Kompakt Header - Dashboard uslubida */}
            <PageHeader>
                <StatItem 
                    icon={<ApiOutlined />} 
                    value={stats.total} 
                    label="jami" 
                    color="#1890ff"
                    tooltip="Jami qurilmalar"
                />
                <Divider />
                <StatItem 
                    icon={<CheckCircleOutlined />} 
                    value={stats.online} 
                    label="" 
                    color="#52c41a"
                    tooltip="Onlayn qurilmalar"
                />
                <StatItem 
                    icon={<CloseCircleOutlined />} 
                    value={stats.offline} 
                    label="" 
                    color="#ff4d4f"
                    tooltip="Oflayn qurilmalar"
                />
                <Divider />
                <StatItem 
                    icon={<LoginOutlined />} 
                    value={stats.entrance} 
                    label="kirish" 
                    color="#52c41a"
                    tooltip="Kirish qurilmalari"
                />
                <StatItem 
                    icon={<LogoutOutlined />} 
                    value={stats.exit} 
                    label="chiqish" 
                    color="#1890ff"
                    tooltip="Chiqish qurilmalari"
                />
            </PageHeader>

            <Row gutter={[12, 12]}>
                {/* Webhook konfiguratsiya */}
                {canManage && (
                    <Col xs={24} lg={8}>
                        <Card 
                        title={<><ApiOutlined /> Webhook manzili</>} 
                            size="small"
                            styles={{ body: { padding: 12 } }}
                        >
                            {webhookInfo ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <CopyField
                                        label="Kirish webhooki (Hikvision URL)"
                                        value={webhookInfo.inUrlWithSecret}
                                        kind="url"
                                        ariaCopyLabel="Kirish webhook manzilini nusxalash"
                                    />
                                    <CopyField
                                        label="Chiqish webhooki (Hikvision URL)"
                                        value={webhookInfo.outUrlWithSecret}
                                        kind="url"
                                        ariaCopyLabel="Chiqish webhook manzilini nusxalash"
                                    />

                                    <div style={{ marginTop: 4 }}>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>
                                            <Space size={8}>
                                                <span>Advanced (header orqali yuborish):</span>
                                                <Button
                                                    size="small"
                                                    type="link"
                                                    onClick={() => setShowWebhookAdvanced((v) => !v)}
                                                    style={{ padding: 0, height: 'auto' }}
                                                >
                                                    {showWebhookAdvanced ? "Yashirish" : "Ko'rsatish"}
                                                </Button>
                                            </Space>
                                        </Text>
                                        {showWebhookAdvanced && (
                                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                                            <CopyField
                                                label="Header nomi (key)"
                                                value={webhookInfo.secretHeaderName}
                                                kind="header"
                                                ariaCopyLabel="Webhook header nomini nusxalash"
                                            />
                                            <CopyField
                                                label="Kirish secret (value)"
                                                value={webhookInfo.inSecret}
                                                kind="secret"
                                                ariaCopyLabel="Kirish webhook secretni nusxalash"
                                            />
                                            <CopyField
                                                label="Chiqish secret (value)"
                                                value={webhookInfo.outSecret}
                                                kind="secret"
                                                ariaCopyLabel="Chiqish webhook secretni nusxalash"
                                            />
                                        </Space>
                                        )}
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 10 }}>
                                        Hikvision odatda custom header yuborolmaydi, shuning uchun URL (secret bilan) ishlatiladi. Server esa header yoki query orqali secretni qabul qiladi.
                                    </Text>
                                </div>
                            ) : (
                                <Text type="secondary">Yuklanmoqda...</Text>
                            )}
                        </Card>
                    </Col>
                )}

                {/* Qurilmalar jadvali */}
                <Col xs={24} lg={16}>
                    <Card 
                        title="Qurilmalar ro'yxati"
                        size="small"
                        extra={canManage ? (
                            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
                                Qo'shish
                            </Button>
                        ) : null}
                    >
                        <Table 
                            dataSource={devices} 
                            columns={columns} 
                            rowKey="id" 
                            loading={loading}
                            size="small"
                            pagination={{
                                pageSize: 20,
                                showSizeChanger: false,
                                showTotal: (total) => `Jami: ${total}`,
                            }}
                        />
                    </Card>
                </Col>
            </Row>

            {canManage && (
                <Modal
                title={editingId ? 'Qurilmani tahrirlash' : 'Yangi qurilma'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
                okText="Saqlash"
                cancelText="Bekor"
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="name" label="Qurilma nomi" rules={[{ required: true, message: 'Nomni kiriting' }]}>
                        <Input placeholder="Masalan: Asosiy kirish" />
                    </Form.Item>
                    <Form.Item name="deviceId" label="Qurilma ID (Hikvision'dan)" rules={[{ required: true, message: 'Qurilma ID kiriting' }]}>
                        <Input placeholder="Qurilmadagi ID" />
                    </Form.Item>
                    <Form.Item name="type" label="Turi" rules={[{ required: true, message: 'Turini tanlang' }]}>
                        <Select 
                            options={[
                                { value: 'ENTRANCE', label: 'Kirish' }, 
                                { value: 'EXIT', label: 'Chiqish' }
                            ]} 
                        />
                    </Form.Item>
                    <Form.Item name="location" label="Joylashuvi">
                        <Input placeholder="Masalan: 1-qavat, asosiy kirish" />
                    </Form.Item>
                </Form>
                </Modal>
            )}
        </div>
    );
};

export default Devices;

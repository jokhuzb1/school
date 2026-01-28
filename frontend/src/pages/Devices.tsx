import React, { useEffect, useState, useMemo } from 'react';
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
} from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { devicesService } from '../services/devices';
import { schoolsService } from '../services/schools';
import { PageHeader, Divider } from '../components';
import { StatItem } from '../components/StatItem';
import type { Device } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

const Devices: React.FC = () => {
    const { schoolId, isSchoolAdmin, isSuperAdmin } = useSchool();
    const { message } = App.useApp();
    const [devices, setDevices] = useState<Device[]>([]);
    const [webhookInfo, setWebhookInfo] = useState<{ inUrl: string; outUrl: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();

    const fetchDevices = async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await devicesService.getAll(schoolId);
            setDevices(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const canManage = isSchoolAdmin || isSuperAdmin;

    const fetchWebhookInfo = async () => {
        if (!schoolId) return;
        if (!canManage) return;
        try {
            const info = await schoolsService.getWebhookInfo(schoolId);
            setWebhookInfo(info);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchDevices();
        fetchWebhookInfo();
    }, [schoolId]);

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
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                                            <LoginOutlined style={{ color: '#52c41a' }} /> Kirish webhooki:
                                        </Text>
                                        <Input.Group compact>
                                            <Input value={webhookInfo.inUrl} readOnly style={{ width: 'calc(100% - 32px)' }} size="small" />
                                            <Tooltip title="Nusxalash">
                                                <Button
                                                    icon={<CopyOutlined />}
                                                    size="small"
                                                    aria-label="Kirish webhook manzilini nusxalash"
                                                    onClick={() => copyToClipboard(webhookInfo.inUrl)}
                                                />
                                            </Tooltip>
                                        </Input.Group>
                                    </div>
                                    <div>
                                        <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                                            <LogoutOutlined style={{ color: '#1890ff' }} /> Chiqish webhooki:
                                        </Text>
                                        <Input.Group compact>
                                            <Input value={webhookInfo.outUrl} readOnly style={{ width: 'calc(100% - 32px)' }} size="small" />
                                            <Tooltip title="Nusxalash">
                                                <Button
                                                    icon={<CopyOutlined />}
                                                    size="small"
                                                    aria-label="Chiqish webhook manzilini nusxalash"
                                                    onClick={() => copyToClipboard(webhookInfo.outUrl)}
                                                />
                                            </Tooltip>
                                        </Input.Group>
                                    </div>
                                    <Text type="secondary" style={{ fontSize: 10 }}>
                                        Bu manzillarni Hikvision qurilmangizning HTTP tinglash sozlamalariga kiriting.
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

import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Card, Typography, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CopyOutlined } from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { devicesService } from '../services/devices';
import { schoolsService } from '../services/schools';
import type { Device } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

const Devices: React.FC = () => {
    const { schoolId } = useSchool();
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

    const fetchWebhookInfo = async () => {
        if (!schoolId) return;
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

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        message.success('Copied to clipboard');
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
            message.success('Device deleted');
            fetchDevices();
        } catch (err) {
            message.error('Failed to delete');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            if (editingId) {
                await devicesService.update(editingId, values);
                message.success('Device updated');
            } else {
                await devicesService.create(schoolId!, values);
                message.success('Device created');
            }
            setModalOpen(false);
            fetchDevices();
        } catch (err) {
            message.error('Failed to save');
        }
    };

    const columns = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Device ID', dataIndex: 'deviceId', key: 'deviceId' },
        {
            title: 'Type',
            dataIndex: 'type',
            key: 'type',
            render: (t: string) => <Tag color={t === 'ENTRANCE' ? 'green' : 'blue'}>{t}</Tag>,
        },
        {
            title: 'Status',
            key: 'status',
            render: (_: any, record: Device) => {
                const isOnline = record.lastSeenAt && dayjs().diff(dayjs(record.lastSeenAt), 'hour') < 2;
                return <Tag color={isOnline ? 'green' : 'red'}>{isOnline ? 'Online' : 'Offline'}</Tag>;
            },
        },
        { title: 'Last Seen', dataIndex: 'lastSeenAt', key: 'lastSeen', render: (t: string) => t ? dayjs(t).format('MMM DD HH:mm') : '-' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Device) => (
                <>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ marginRight: 8 }} />
                    <Popconfirm title="Delete this device?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </>
            ),
        },
    ];

    return (
        <div>
            {webhookInfo && (
                <Card title="Webhook Configuration" style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8 }}>
                        <Text strong>Entrance Webhook URL:</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <Input value={webhookInfo.inUrl} readOnly style={{ flex: 1 }} />
                            <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(webhookInfo.inUrl)} />
                        </div>
                    </div>
                    <div>
                        <Text strong>Exit Webhook URL:</Text>
                        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                            <Input value={webhookInfo.outUrl} readOnly style={{ flex: 1 }} />
                            <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(webhookInfo.outUrl)} />
                        </div>
                    </div>
                    <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                        Configure these URLs in your Hikvision device HTTP Listening settings.
                    </Text>
                </Card>
            )}

            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
                Add Device
            </Button>

            <Table dataSource={devices} columns={columns} rowKey="id" loading={loading} />

            <Modal
                title={editingId ? 'Edit Device' : 'Add Device'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="name" label="Device Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="deviceId" label="Device ID (from Hikvision)" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                        <Select options={[{ value: 'ENTRANCE', label: 'Entrance' }, { value: 'EXIT', label: 'Exit' }]} />
                    </Form.Item>
                    <Form.Item name="location" label="Location">
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Devices;

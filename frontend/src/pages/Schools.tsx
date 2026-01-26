import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Space, Tag, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { schoolsService } from '../services/schools';
import type { School } from '../types';

const Schools: React.FC = () => {
    const navigate = useNavigate();
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();

    const fetchSchools = async () => {
        setLoading(true);
        try {
            const data = await schoolsService.getAll();
            setSchools(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchools();
    }, []);

    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        setModalOpen(true);
    };

    const handleEdit = (record: School) => {
        setEditingId(record.id);
        form.setFieldsValue(record);
        setModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await schoolsService.delete(id);
            message.success('School deleted');
            fetchSchools();
        } catch (err) {
            message.error('Failed to delete');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            if (editingId) {
                await schoolsService.update(editingId, values);
                message.success('School updated');
            } else {
                await schoolsService.create(values);
                message.success('School created');
            }
            setModalOpen(false);
            fetchSchools();
        } catch (err) {
            message.error('Failed to save');
        }
    };

    const columns = [
        { 
            title: 'Maktab nomi', 
            dataIndex: 'name', 
            key: 'name',
            render: (name: string, record: School) => (
                <Space>
                    <span style={{ fontWeight: 500 }}>{name}</span>
                    {record._count?.students && (
                        <Tag color="blue">{record._count.students} o'quvchi</Tag>
                    )}
                </Space>
            )
        },
        { title: 'Manzil', dataIndex: 'address', key: 'address', render: (a: string) => a || '-' },
        { title: 'Telefon', dataIndex: 'phone', key: 'phone', render: (p: string) => p || '-' },
        {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: any, record: School) => (
                <Space size={4}>
                    <Tooltip title="Tahrirlash">
                        <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(record); }} />
                    </Tooltip>
                    <Popconfirm title="O'chirish?" onConfirm={() => handleDelete(record.id)}>
                        <Tooltip title="O'chirish">
                            <Button size="small" icon={<DeleteOutlined />} danger onClick={(e) => e.stopPropagation()} />
                        </Tooltip>
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    return (
        <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
                Maktab qo'shish
            </Button>

            <Table
                dataSource={schools}
                columns={columns}
                rowKey="id"
                loading={loading}
                onRow={(record) => ({
                    onClick: () => navigate(`/schools/${record.id}/dashboard`),
                    style: { cursor: 'pointer' },
                })}
            />

            <Modal
                title={editingId ? 'Edit School' : 'Add School'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="address" label="Address">
                        <Input />
                    </Form.Item>
                    <Form.Item name="phone" label="Phone">
                        <Input />
                    </Form.Item>
                    <Form.Item name="email" label="Email">
                        <Input type="email" />
                    </Form.Item>
                    <Form.Item name="lateThresholdMinutes" label="Late Threshold (minutes)">
                        <Input type="number" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Schools;

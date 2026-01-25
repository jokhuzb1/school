import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm } from 'antd';
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
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Address', dataIndex: 'address', key: 'address', render: (a: string) => a || '-' },
        { title: 'Phone', dataIndex: 'phone', key: 'phone', render: (p: string) => p || '-' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: School) => (
                <>
                    <Button size="small" onClick={() => navigate(`/schools/${record.id}/dashboard`)} style={{ marginRight: 8 }}>
                        View
                    </Button>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ marginRight: 8 }} />
                    <Popconfirm title="Delete this school?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </>
            ),
        },
    ];

    return (
        <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
                Add School
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

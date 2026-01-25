import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, TimePicker, message, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { classesService } from '../services/classes';
import type { Class } from '../types';
import dayjs from 'dayjs';

const Classes: React.FC = () => {
    const { schoolId } = useSchool();
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();

    const fetchClasses = async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await classesService.getAll(schoolId);
            setClasses(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClasses();
    }, [schoolId]);

    const handleAdd = () => {
        setEditingId(null);
        form.resetFields();
        setModalOpen(true);
    };

    const handleEdit = (record: Class) => {
        setEditingId(record.id);
        form.setFieldsValue({
            ...record,
            startTime: record.startTime ? dayjs(record.startTime, 'HH:mm') : null,
            endTime: record.endTime ? dayjs(record.endTime, 'HH:mm') : null,
        });
        setModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await classesService.delete(id);
            message.success('Class deleted');
            fetchClasses();
        } catch (err) {
            message.error('Failed to delete');
        }
    };

    const handleSubmit = async (values: any) => {
        const data = {
            ...values,
            startTime: values.startTime?.format('HH:mm'),
            endTime: values.endTime?.format('HH:mm'),
        };
        try {
            if (editingId) {
                await classesService.update(editingId, data);
                message.success('Class updated');
            } else {
                await classesService.create(schoolId!, data);
                message.success('Class created');
            }
            setModalOpen(false);
            fetchClasses();
        } catch (err) {
            message.error('Failed to save');
        }
    };

    const columns = [
        { title: 'Name', dataIndex: 'name', key: 'name' },
        { title: 'Grade', dataIndex: 'gradeLevel', key: 'grade' },
        { title: 'Start Time', dataIndex: 'startTime', key: 'startTime' },
        { title: 'End Time', dataIndex: 'endTime', key: 'endTime', render: (t: string) => t || '-' },
        { title: 'Students', dataIndex: ['_count', 'students'], key: 'students', render: (c: number) => c || 0 },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Class) => (
                <>
                    <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} style={{ marginRight: 8 }} />
                    <Popconfirm title="Delete this class?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" icon={<DeleteOutlined />} danger />
                    </Popconfirm>
                </>
            ),
        },
    ];

    return (
        <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
                Add Class
            </Button>

            <Table dataSource={classes} columns={columns} rowKey="id" loading={loading} />

            <Modal
                title={editingId ? 'Edit Class' : 'Add Class'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                        <Input placeholder="e.g., 1A" />
                    </Form.Item>
                    <Form.Item name="gradeLevel" label="Grade Level" rules={[{ required: true }]}>
                        <Select options={[...Array(12)].map((_, i) => ({ value: i + 1, label: `Grade ${i + 1}` }))} />
                    </Form.Item>
                    <Form.Item name="startTime" label="Start Time" rules={[{ required: true }]}>
                        <TimePicker format="HH:mm" />
                    </Form.Item>
                    <Form.Item name="endTime" label="End Time">
                        <TimePicker format="HH:mm" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Classes;

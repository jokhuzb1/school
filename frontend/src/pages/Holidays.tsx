import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, Card, Calendar, Badge, App, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { holidaysService } from '../services/holidays';
import type { Holiday } from '../types';
import dayjs, { Dayjs } from 'dayjs';

const Holidays: React.FC = () => {
    const { schoolId } = useSchool();
    const { message } = App.useApp();
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();

    const fetchHolidays = async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await holidaysService.getAll(schoolId);
            setHolidays(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHolidays();
    }, [schoolId]);

    const handleAdd = () => {
        form.resetFields();
        setModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await holidaysService.delete(id);
            message.success('Holiday deleted');
            fetchHolidays();
        } catch (err) {
            message.error('Failed to delete');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            await holidaysService.create(schoolId!, {
                ...values,
                date: values.date.toISOString(),
            });
            message.success('Holiday added');
            setModalOpen(false);
            fetchHolidays();
        } catch (err) {
            message.error('Failed to add holiday');
        }
    };

    const holidayDates = new Set(holidays.map((h) => dayjs(h.date).format('YYYY-MM-DD')));

    const dateCellRender = (date: Dayjs) => {
        const key = date.format('YYYY-MM-DD');
        if (holidayDates.has(key)) {
            return <Badge color="red" />;
        }
        return null;
    };

    const columns = [
        { title: 'Date', dataIndex: 'date', key: 'date', render: (d: string) => dayjs(d).format('MMM DD, YYYY') },
        { title: 'Name', dataIndex: 'name', key: 'name' },
        {
            title: 'Actions',
            key: 'actions',
            render: (_: any, record: Holiday) => (
                <Popconfirm title="Delete this holiday?" onConfirm={() => handleDelete(record.id)}>
                    <Button size="small" icon={<DeleteOutlined />} danger />
                </Popconfirm>
            ),
        },
    ];

    return (
        <div>
            <Card style={{ marginBottom: 16 }}>
                <Calendar fullscreen={false} cellRender={dateCellRender} />
            </Card>

            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
                Add Holiday
            </Button>

            <Table dataSource={holidays} columns={columns} rowKey="id" loading={loading} />

            <Modal
                title="Add Holiday"
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="date" label="Date" rules={[{ required: true }]}>
                        <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="name" label="Holiday Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Holidays;

import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, TimePicker, message, Popconfirm, Tag, Progress, Card, Row, Col, Typography, Space, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { classesService } from '../services/classes';
import { studentsService } from '../services/students';
import type { Class, Student, DailyAttendance } from '../types';
import dayjs from 'dayjs';

const { Text } = Typography;

const Classes: React.FC = () => {
    const { schoolId } = useSchool();
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form] = Form.useForm();
    const [expandedData, setExpandedData] = useState<Record<string, Student[]>>({});
    const [loadingStudents, setLoadingStudents] = useState<string | null>(null);

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

    // Expand qilinganda o'quvchilarni yuklash
    const handleExpand = async (expanded: boolean, record: Class) => {
        if (expanded && !expandedData[record.id]) {
            setLoadingStudents(record.id);
            try {
                const students = await studentsService.getAll(schoolId!, { classId: record.id });
                setExpandedData(prev => ({ ...prev, [record.id]: students.data || students }));
            } catch (err) {
                console.error('Failed to load students:', err);
            } finally {
                setLoadingStudents(null);
            }
        }
    };

    const columns = [
        { 
            title: 'Sinf', 
            dataIndex: 'name', 
            key: 'name',
            render: (name: string, record: Class) => (
                <Space>
                    <TeamOutlined style={{ color: '#1890ff' }} />
                    <Text strong>{name}</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>({record.gradeLevel}-sinf)</Text>
                </Space>
            )
        },
        { 
            title: 'Vaqt', 
            key: 'time',
            render: (_: any, record: Class) => (
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.startTime} - {record.endTime || '...'}
                </Text>
            )
        },
        { 
            title: "O'quvchilar", 
            key: 'students', 
            render: (_: any, record: Class) => {
                const total = record.totalStudents || record._count?.students || 0;
                return (
                    <Space>
                        <UserOutlined />
                        <Text>{total}</Text>
                    </Space>
                );
            }
        },
        { 
            title: 'Bugungi davomat', 
            key: 'today', 
            width: 280,
            render: (_: any, record: Class) => {
                const present = record.todayPresent || 0;
                const late = record.todayLate || 0;
                const absent = record.todayAbsent || 0;
                const total = record.totalStudents || record._count?.students || 0;
                const percent = total > 0 ? Math.round((present / total) * 100) : 0;
                
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Progress 
                            percent={percent} 
                            size="small" 
                            style={{ width: 80, margin: 0 }}
                            status={percent < 70 ? 'exception' : percent < 90 ? 'normal' : 'success'}
                            showInfo={false}
                        />
                        <Space size={4}>
                            <Tooltip title="Kelgan">
                                <Tag color="success" style={{ margin: 0 }}><CheckCircleOutlined /> {present}</Tag>
                            </Tooltip>
                            {late > 0 && (
                                <Tooltip title="Kech">
                                    <Tag color="warning" style={{ margin: 0 }}><ClockCircleOutlined /> {late}</Tag>
                                </Tooltip>
                            )}
                            {absent > 0 && (
                                <Tooltip title="Kelmagan">
                                    <Tag color="error" style={{ margin: 0 }}><CloseCircleOutlined /> {absent}</Tag>
                                </Tooltip>
                            )}
                        </Space>
                    </div>
                );
            }
        },
        {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: any, record: Class) => (
                <Space size={4}>
                    <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(record); }} />
                    <Popconfirm title="O'chirish?" onConfirm={() => handleDelete(record.id)}>
                        <Button size="small" icon={<DeleteOutlined />} danger onClick={(e) => e.stopPropagation()} />
                    </Popconfirm>
                </Space>
            ),
        },
    ];

    // Expandable row - o'quvchilar ro'yxati
    const expandedRowRender = (record: Class) => {
        const students = expandedData[record.id] || [];
        const isLoading = loadingStudents === record.id;

        if (isLoading) {
            return <div style={{ padding: 16, textAlign: 'center' }}><Text type="secondary">Yuklanmoqda...</Text></div>;
        }

        if (students.length === 0) {
            return <div style={{ padding: 16, textAlign: 'center' }}><Text type="secondary">O'quvchilar yo'q</Text></div>;
        }

        return (
            <div style={{ padding: '8px 16px' }}>
                <Row gutter={[8, 8]}>
                    {students.map((student: Student) => {
                        const todayAttendance = student.attendance?.[0];
                        const status = todayAttendance?.status;
                        
                        let statusColor = '#d9d9d9';
                        let statusIcon = <CloseCircleOutlined />;
                        let statusText = 'Kelmagan';
                        
                        if (status === 'PRESENT') {
                            statusColor = '#52c41a';
                            statusIcon = <CheckCircleOutlined />;
                            statusText = todayAttendance?.firstScanTime ? dayjs(todayAttendance.firstScanTime).format('HH:mm') : 'Kelgan';
                        } else if (status === 'LATE') {
                            statusColor = '#faad14';
                            statusIcon = <ClockCircleOutlined />;
                            statusText = todayAttendance?.firstScanTime ? dayjs(todayAttendance.firstScanTime).format('HH:mm') + ' (kech)' : 'Kech';
                        }

                        return (
                            <Col key={student.id} xs={12} sm={8} md={6} lg={4}>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: 6,
                                    padding: '6px 10px',
                                    background: status === 'PRESENT' ? '#f6ffed' : status === 'LATE' ? '#fffbe6' : '#fff1f0',
                                    borderRadius: 6,
                                    borderLeft: `3px solid ${statusColor}`,
                                }}>
                                    <span style={{ color: statusColor }}>{statusIcon}</span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <Text ellipsis style={{ fontSize: 12, display: 'block' }}>{student.name}</Text>
                                        <Text type="secondary" style={{ fontSize: 10 }}>{statusText}</Text>
                                    </div>
                                </div>
                            </Col>
                        );
                    })}
                </Row>
            </div>
        );
    };

    return (
        <div>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ marginBottom: 16 }}>
                Sinf qo'shish
            </Button>

            <Table 
                dataSource={classes} 
                columns={columns} 
                rowKey="id" 
                loading={loading}
                expandable={{
                    expandedRowRender,
                    onExpand: handleExpand,
                    expandRowByClick: true,
                }}
                size="middle"
            />

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

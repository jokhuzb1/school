import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Select, TimePicker, Tag, Progress, Typography, Space, Tooltip, App } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../hooks/useSchool';
import { classesService } from '../services/classes';
import { PageHeader, Divider } from '../components';
import { StatItem } from '../components/StatItem';
import type { Class } from '../types';

const { Text } = Typography;

const Classes: React.FC = () => {
    const { schoolId } = useSchool();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm<{ name: string; gradeLevel: number; startTime: any; endTime: any }>();

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

    // Statistikalar
    const stats = useMemo(() => {
        const totalStudents = classes.reduce((sum, c) => sum + (c.totalStudents || c._count?.students || 0), 0);
        const todayPresent = classes.reduce((sum, c) => sum + (c.todayPresent || 0), 0);
        const todayLate = classes.reduce((sum, c) => sum + (c.todayLate || 0), 0);
        const todayAbsent = classes.reduce((sum, c) => sum + (c.todayAbsent || 0), 0);
        return { total: classes.length, totalStudents, todayPresent, todayLate, todayAbsent };
    }, [classes]);

    const handleAdd = () => {
        form.resetFields();
        setModalOpen(true);
    };

    const handleSubmit = async (values: any) => {
        const data = {
            ...values,
            startTime: values.startTime?.format('HH:mm'),
            endTime: values.endTime?.format('HH:mm'),
        };
        try {
            await classesService.create(schoolId!, data);
            message.success('Sinf qo\'shildi');
            setModalOpen(false);
            fetchClasses();
        } catch (err) {
            message.error('Saqlashda xatolik');
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
    ];

    return (
        <div>
            {/* Kompakt Header - Dashboard uslubida */}
            <PageHeader>
                <StatItem 
                    icon={<TeamOutlined />} 
                    value={stats.total} 
                    label="sinf" 
                    color="#722ed1"
                    tooltip="Jami sinflar"
                />
                <StatItem 
                    icon={<UserOutlined />} 
                    value={stats.totalStudents} 
                    label="o'quvchi" 
                    color="#1890ff"
                    tooltip="Jami o'quvchilar"
                />
                <Divider />
                <StatItem 
                    icon={<CheckCircleOutlined />} 
                    value={stats.todayPresent} 
                    label="kelgan" 
                    color="#52c41a"
                    tooltip="Bugun kelganlar"
                />
                <StatItem 
                    icon={<ClockCircleOutlined />} 
                    value={stats.todayLate} 
                    label="kech" 
                    color="#faad14"
                    tooltip="Kech qolganlar"
                />
                <StatItem 
                    icon={<CloseCircleOutlined />} 
                    value={stats.todayAbsent} 
                    label="yo'q" 
                    color="#ff4d4f"
                    tooltip="Kelmaganlar"
                />
                <Divider />
                <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
                    Sinf qo'shish
                </Button>
            </PageHeader>

            <Table 
                dataSource={classes} 
                columns={columns} 
                rowKey="id" 
                loading={loading}
                size="middle"
                onRow={(record) => ({
                    onClick: () => navigate(schoolId ? `/schools/${schoolId}/classes/${record.id}` : `/classes/${record.id}`),
                    style: { cursor: 'pointer' },
                })}
            />

            <Modal
                title="Yangi sinf"
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
                okText="Saqlash"
                cancelText="Bekor"
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="name" label="Sinf nomi" rules={[{ required: true, message: 'Nomni kiriting' }]}>
                        <Input placeholder="Masalan: 1A, 5B" />
                    </Form.Item>
                    <Form.Item name="gradeLevel" label="Sinf darajasi" rules={[{ required: true, message: 'Darajani tanlang' }]}>
                        <Select 
                            placeholder="Tanlang"
                            options={[...Array(12)].map((_, i) => ({ value: i + 1, label: `${i + 1}-sinf` }))} 
                        />
                    </Form.Item>
                    <Form.Item name="startTime" label="Dars boshlanish vaqti" rules={[{ required: true, message: 'Vaqtni tanlang' }]}>
                        <TimePicker format="HH:mm" placeholder="08:00" />
                    </Form.Item>
                    <Form.Item name="endTime" label="Dars tugash vaqti">
                        <TimePicker format="HH:mm" placeholder="14:00" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Classes;

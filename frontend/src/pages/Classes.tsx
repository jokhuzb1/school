import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Select, TimePicker, Tag, Typography, Space, Tooltip, App } from 'antd';
import { PlusOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, UserOutlined, TeamOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSchool } from '../hooks/useSchool';
import { classesService } from '../services/classes';
import { PageHeader, Divider, StatItem, useHeaderMeta } from '../shared/ui';
import type { Class } from '../types';
import { ATTENDANCE_STATUS_TAG, STATUS_COLORS, StatusBar } from '../entities/attendance';

const { Text } = Typography;

const Classes: React.FC = () => {
    const { schoolId } = useSchool();
    const { setRefresh, setLastUpdated } = useHeaderMeta();
    const { message } = App.useApp();
    const navigate = useNavigate();
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm<{ name: string; gradeLevel: number; startTime: any; endTime: any }>();

    const fetchClasses = useCallback(async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await classesService.getAll(schoolId);
            setClasses(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [schoolId, setLastUpdated]);

    useEffect(() => {
        fetchClasses();
    }, [fetchClasses]);

    const handleRefresh = useCallback(async () => {
        await fetchClasses();
        setLastUpdated(new Date());
    }, [fetchClasses, setLastUpdated]);

    useEffect(() => {
        setRefresh(handleRefresh);
        return () => setRefresh(null);
    }, [handleRefresh, setRefresh]);

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
                
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80 }}>
                            <StatusBar
                                total={total}
                                present={present}
                                late={late}
                                absent={absent}
                                height={10}
                            />
                        </div>
                        <Space size={4}>
                            <Tooltip title="Kelgan">
                                <Tag color={ATTENDANCE_STATUS_TAG.PRESENT.color} style={{ margin: 0 }}><CheckCircleOutlined /> {present}</Tag>
                            </Tooltip>
                            {late > 0 && (
                                <Tooltip title="Kech qoldi">
                                    <Tag color={ATTENDANCE_STATUS_TAG.LATE.color} style={{ margin: 0 }}><ClockCircleOutlined /> {late}</Tag>
                                </Tooltip>
                            )}
                            {absent > 0 && (
                                <Tooltip title="Kelmadi">
                                    <Tag color={ATTENDANCE_STATUS_TAG.ABSENT.color} style={{ margin: 0 }}><CloseCircleOutlined /> {absent}</Tag>
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
                    color={STATUS_COLORS.PRESENT}
                    tooltip="Bugun kelganlar"
                />
                <StatItem 
                    icon={<ClockCircleOutlined />} 
                    value={stats.todayLate} 
                    label="kech qoldi" 
                    color={STATUS_COLORS.LATE}
                    tooltip="Kech qoldi (scan bilan)"
                />
                <StatItem 
                    icon={<CloseCircleOutlined />} 
                    value={stats.todayAbsent} 
                    label="kelmadi" 
                    color={STATUS_COLORS.ABSENT}
                    tooltip="Kelmadi (cutoff o'tgan)"
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

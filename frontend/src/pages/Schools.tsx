import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, Popconfirm, Space, Tag, Tooltip, App, Typography, InputNumber, Divider as AntDivider, Segmented } from 'antd';
import { 
    PlusOutlined, 
    DeleteOutlined, 
    EditOutlined, 
    BankOutlined,
    TeamOutlined,
    SearchOutlined,
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    EnvironmentOutlined,
    PhoneOutlined,
    RightOutlined,
    UserOutlined,
    LockOutlined,
    MailOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { schoolsService } from '../services/schools';
import { PageHeader, Divider, StatItem, StatGroup, useHeaderMeta } from '../shared/ui';
import { StatusBar } from '../entities/attendance';
import type { School, AttendanceScope } from '../types';

const { Text } = Typography;
const AUTO_REFRESH_MS = 60000;

const Schools: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { message } = App.useApp();
    const { setRefresh, setLastUpdated } = useHeaderMeta();
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
    const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>('started');
    const [form] = Form.useForm();
    const backStateBase = { backTo: location.pathname };

    const fetchSchools = useCallback(async (silent = false) => {
        if (!silent) {
            setLoading(true);
        }
        try {
            const data = await schoolsService.getAll(attendanceScope);
            setSchools(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
        } finally {
            if (!silent) {
                setLoading(false);
            }
        }
    }, [attendanceScope]);

    useEffect(() => {
        fetchSchools();
    }, [fetchSchools]);

    useEffect(() => {
        const timer = setInterval(() => {
            fetchSchools(true);
        }, AUTO_REFRESH_MS);
        return () => clearInterval(timer);
    }, [fetchSchools]);

    const handleRefresh = useCallback(async () => {
        await fetchSchools();
        setLastUpdated(new Date());
    }, [fetchSchools, setLastUpdated]);

    useEffect(() => {
        setRefresh(handleRefresh);
        return () => setRefresh(null);
    }, [handleRefresh, setRefresh]);

    // Statistikalar
    const stats = useMemo(() => {
        const totalStudents = schools.reduce((sum, s) => sum + (s._count?.students || 0), 0);
        const totalClasses = schools.reduce((sum, s) => sum + (s._count?.classes || 0), 0);
        const totalDevices = schools.reduce((sum, s) => sum + (s._count?.devices || 0), 0);
        return { total: schools.length, totalStudents, totalClasses, totalDevices };
    }, [schools]);

    // Filtrlangan maktablar
    const filteredSchools = useMemo(() => {
        if (!searchText.trim()) return schools;
        const search = searchText.toLowerCase();
        return schools.filter(s => 
            s.name.toLowerCase().includes(search) ||
            s.address?.toLowerCase().includes(search)
        );
    }, [schools, searchText]);

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
            message.success('Maktab o\'chirildi');
            fetchSchools();
        } catch (err) {
            message.error('O\'chirishda xatolik');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            if (editingId) {
                await schoolsService.update(editingId, values);
                message.success('Maktab yangilandi');
            } else {
                await schoolsService.create(values);
                message.success('Maktab qo\'shildi');
            }
            setModalOpen(false);
            fetchSchools();
        } catch (err) {
            message.error('Saqlashda xatolik');
        }
    };

    const columns = [
        { 
            title: 'Maktab', 
            dataIndex: 'name', 
            key: 'name',
            render: (name: string, record: School) => (
                <div>
                    <Space>
                        <BankOutlined style={{ color: '#1890ff' }} />
                        <Text strong>{name}</Text>
                    </Space>
                    {record.address && (
                        <div>
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                <EnvironmentOutlined /> {record.address}
                            </Text>
                        </div>
                    )}
                </div>
            )
        },
        { 
            title: "O'quvchilar", 
            key: 'students',
            width: 100,
            render: (_: any, record: School) => (
                <div style={{ textAlign: 'center' }}>
                    <Text strong style={{ color: '#1890ff' }}>{record._count?.students || 0}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 10 }}>o'quvchi</Text>
                </div>
            )
        },
        { 
            title: 'Sinflar', 
            key: 'classes',
            width: 80,
            render: (_: any, record: School) => (
                <div style={{ textAlign: 'center' }}>
                    <Text strong>{record._count?.classes || 0}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 10 }}>sinf</Text>
                </div>
            )
        },
        {
            title: 'Davomat',
            key: 'attendance',
            width: 120,
            render: (_: any, record: School) => {
                const stats = record.todayStats;
                const totalFromStats = stats
                    ? (stats.present || 0) +
                      (stats.late || 0) +
                      (stats.absent || 0) +
                      (stats.pendingEarly || 0) +
                      (stats.pendingLate || 0) +
                      (stats.excused || 0)
                    : 0;
                const total = stats ? totalFromStats : record._count?.students || 0;
                return (
                    <div>
                        <StatusBar
                            total={total}
                            present={stats?.present || 0}
                            late={stats?.late || 0}
                            absent={stats?.absent || 0}
                            pendingEarly={stats?.pendingEarly || 0}
                            pendingLate={stats?.pendingLate || 0}
                            excused={stats?.excused || 0}
                            height={10}
                        />
                        <Space size={4} style={{ marginTop: 6 }}>
                            <Tag color="success" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                <CheckCircleOutlined /> {stats?.present || 0}
                            </Tag>
                            <Tag color="warning" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                <ClockCircleOutlined /> {stats?.late || 0}
                            </Tag>
                            <Tag color="gold" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                <ClockCircleOutlined /> {stats?.pendingLate || 0}
                            </Tag>
                            <Tag color="default" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                <CloseCircleOutlined /> {stats?.pendingEarly || 0}
                            </Tag>
                            <Tag color="error" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                <CloseCircleOutlined /> {stats?.absent || 0}
                            </Tag>
                        </Space>
                    </div>
                );
            }
        },
        { 
            title: 'Telefon', 
            dataIndex: 'phone', 
            key: 'phone', 
            width: 130,
            render: (p: string) => p ? (
                <Space>
                    <PhoneOutlined style={{ color: '#8c8c8c' }} />
                    <Text>{p}</Text>
                </Space>
            ) : <Text type="secondary">-</Text>
        },
        {
            title: '',
            key: 'actions',
            width: 100,
            render: (_: any, record: School) => (
                <Space size={4}>
                    <Tooltip title="Tahrirlash">
                        <Button
                            size="small"
                            icon={<EditOutlined />}
                            aria-label="Maktabni tahrirlash"
                            onClick={(e) => { e.stopPropagation(); handleEdit(record); }}
                        />
                    </Tooltip>
                    <Popconfirm 
                        title="Maktabni o'chirish?" 
                        description="Barcha ma'lumotlar o'chiriladi!"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Ha"
                        cancelText="Yo'q"
                    >
                        <Tooltip title="O'chirish">
                            <Button
                                size="small"
                                icon={<DeleteOutlined />}
                                aria-label="Maktabni o'chirish"
                                danger
                                onClick={(e) => e.stopPropagation()}
                            />
                        </Tooltip>
                    </Popconfirm>
                    <Tooltip title="Boshqaruv">
                        <Button 
                            size="small" 
                            icon={<RightOutlined />} 
                            aria-label="Maktab boshqaruv sahifasi"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/schools/${record.id}/dashboard`, {
                                    state: { ...backStateBase, schoolName: record.name },
                                });
                            }} 
                        />
                    </Tooltip>
                </Space>
            ),
        },
    ];

    return (
        <div>
            {/* Kompakt Header - Dashboard uslubida */}
            <PageHeader>
                <StatGroup>
                    <StatItem 
                        icon={<BankOutlined />} 
                        value={stats.total} 
                        label="maktab" 
                        color="#722ed1"
                        tooltip="Jami maktablar"
                    />
                    <StatItem 
                        icon={<TeamOutlined />} 
                        value={stats.totalStudents} 
                        label="o'quvchi" 
                        color="#1890ff"
                        tooltip="Jami o'quvchilar"
                    />
                    <StatItem 
                        icon={<BankOutlined />} 
                        value={stats.totalClasses} 
                        label="sinf" 
                        color="#52c41a"
                        tooltip="Jami sinflar"
                    />
                </StatGroup>
                
                <Divider />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        Ko'rinish:
                    </Text>
                    <Segmented
                        size="middle"
                        value={attendanceScope}
                        onChange={(value) => setAttendanceScope(value as AttendanceScope)}
                        options={[
                            { label: "Boshlangan", value: "started" },
                            { label: "Faol", value: "active" },
                        ]}
                    />
                </div>
                
                {/* Search */}
                <Input
                    placeholder="Qidirish..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 200, borderRadius: 8 }}
                    allowClear
                    size="middle"
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ borderRadius: 8 }}>
                    Maktab qo'shish
                </Button>
            </PageHeader>

            <Table
                dataSource={filteredSchools}
                columns={columns}
                rowKey="id"
                loading={loading}
                size="middle"
                onRow={(record) => ({
                    onClick: () =>
                        navigate(`/schools/${record.id}/dashboard`, {
                            state: { ...backStateBase, schoolName: record.name },
                        }),
                    onKeyDown: (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            navigate(`/schools/${record.id}/dashboard`, {
                                state: { ...backStateBase, schoolName: record.name },
                            });
                        }
                    },
                    role: "button",
                    tabIndex: 0,
                    style: { cursor: 'pointer' },
                })}
            />

            <Modal
                title={editingId ? 'Maktabni tahrirlash' : 'Yangi maktab qo\'shish'}
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
                okText="Saqlash"
                cancelText="Bekor"
                width={520}
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    {/* Maktab ma'lumotlari */}
                    <AntDivider style={{ margin: '8px 0 16px' }}>
                        <BankOutlined /> Maktab ma'lumotlari
                    </AntDivider>
                    
                    <Form.Item 
                        name="name" 
                        label="Maktab nomi" 
                        rules={[
                            { required: true, message: 'Maktab nomini kiriting' },
                            { min: 2, message: 'Kamida 2 ta belgi bo\'lishi kerak' }
                        ]}
                    >
                        <Input prefix={<BankOutlined />} placeholder="Masalan: 15-maktab" />
                    </Form.Item>
                    
                    <Form.Item name="address" label="Manzil">
                        <Input prefix={<EnvironmentOutlined />} placeholder="Masalan: Toshkent sh., Chilonzor t." />
                    </Form.Item>
                    
                    <Form.Item 
                        name="phone" 
                        label="Telefon"
                        rules={[
                            { pattern: /^[\d\s\+\-\(\)]+$/, message: 'Noto\'g\'ri telefon formati' }
                        ]}
                    >
                        <Input prefix={<PhoneOutlined />} placeholder="+998 XX XXX XX XX" />
                    </Form.Item>
                    
                    <Space style={{ width: '100%' }} size={12}>
                        <Form.Item 
                            name="lateThresholdMinutes" 
                            label="Kechikish chegarasi (daqiqa)"
                            style={{ width: 200 }}
                            initialValue={15}
                        >
                            <InputNumber min={0} max={120} style={{ width: '100%' }} placeholder="15" />
                        </Form.Item>
                        
                        <Form.Item 
                            name="absenceCutoffMinutes" 
                        label="Kelmadi deb belgilash (daqiqa)"
                            style={{ width: 220 }}
                            initialValue={180}
                            tooltip="Dars boshlangandan keyin necha daqiqadan so'ng 'Kelmadi' deb belgilanadi"
                        >
                            <InputNumber min={0} max={600} style={{ width: '100%' }} placeholder="180" addonAfter="daq" />
                        </Form.Item>
                    </Space>

                    {/* Admin ma'lumotlari - faqat yangi maktab qo'shganda */}
                    {!editingId && (
                        <>
                            <AntDivider style={{ margin: '16px 0' }}>
                                <UserOutlined /> Admin hisobi
                            </AntDivider>
                            
                            <Form.Item 
                                name="adminName" 
                                label="Admin ismi"
                                rules={[
                                    { required: true, message: 'Admin ismini kiriting' },
                                    { min: 2, message: 'Kamida 2 ta belgi bo\'lishi kerak' }
                                ]}
                            >
                                <Input prefix={<UserOutlined />} placeholder="Masalan: Abdullayev Abdulla" />
                            </Form.Item>
                            
                            <Form.Item 
                                name="adminEmail" 
                                label="Admin elektron pochta"
                                rules={[
                                    { required: true, message: 'Elektron pochta kiriting' },
                                    { type: 'email', message: 'Noto\'g\'ri elektron pochta formati' },
                                    { 
                                        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                                        message: 'To\'g\'ri elektron pochta kiriting (masalan: admin@maktab.uz)'
                                    }
                                ]}
                            >
                                <Input prefix={<MailOutlined />} placeholder="admin@maktab.uz" />
                            </Form.Item>
                            
                            <Form.Item 
                                name="adminPassword" 
                                label="Parol"
                                rules={[
                                    { required: true, message: 'Parolni kiriting' },
                                    { min: 6, message: 'Parol kamida 6 ta belgidan iborat bo\'lishi kerak' },
                                    {
                                        pattern: /^(?=.*[a-zA-Z])(?=.*\d)/,
                                        message: 'Parolda harf va raqam bo\'lishi kerak'
                                    }
                                ]}
                            >
                                <Input.Password prefix={<LockOutlined />} placeholder="Kamida 6 ta belgi" />
                            </Form.Item>
                            
                            <Form.Item 
                                name="confirmPassword" 
                                label="Parolni tasdiqlash"
                                dependencies={['adminPassword']}
                                rules={[
                                    { required: true, message: 'Parolni tasdiqlang' },
                                    ({ getFieldValue }) => ({
                                        validator(_, value) {
                                            if (!value || getFieldValue('adminPassword') === value) {
                                                return Promise.resolve();
                                            }
                                            return Promise.reject(new Error('Parollar mos kelmadi'));
                                        },
                                    }),
                                ]}
                            >
                                <Input.Password prefix={<LockOutlined />} placeholder="Parolni qayta kiriting" />
                            </Form.Item>
                        </>
                    )}
                    
                    {/* Tahrirlashda email (faqat ko'rish uchun) */}
                    {editingId && (
                        <Form.Item 
                            name="email" 
                            label="Maktab elektron pochta"
                            rules={[
                                { type: 'email', message: 'Noto\'g\'ri elektron pochta formati' }
                            ]}
                        >
                            <Input prefix={<MailOutlined />} placeholder="maktab@example.com" />
                        </Form.Item>
                    )}
                </Form>
            </Modal>
        </div>
    );
};

export default Schools;

import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Modal, Form, Input, Popconfirm, Space, Tag, Tooltip, App, Typography, Progress, InputNumber, Divider as AntDivider } from 'antd';
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
import { useNavigate } from 'react-router-dom';
import { schoolsService } from '../services/schools';
import { PageHeader, Divider } from '../components';
import { StatItem } from '../components/StatItem';
import type { School } from '../types';

const { Text } = Typography;

const Schools: React.FC = () => {
    const navigate = useNavigate();
    const { message } = App.useApp();
    const [schools, setSchools] = useState<School[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');
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

    // Holat aniqlash
    const getStatus = (percent: number) => {
        if (percent >= 90) return { color: '#52c41a', text: 'Yaxshi' };
        if (percent >= 75) return { color: '#faad14', text: 'Normal' };
        return { color: '#ff4d4f', text: 'Past' };
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
                const percent = record.todayStats?.attendancePercent || 0;
                const status = getStatus(percent);
                return (
                    <div>
                        <Progress 
                            percent={percent} 
                            size="small" 
                            strokeColor={status.color}
                            format={() => `${percent}%`}
                        />
                        <Space size={4} style={{ marginTop: 2 }}>
                            {record.todayStats && (
                                <>
                                    <Tag color="success" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                        <CheckCircleOutlined /> {record.todayStats.present}
                                    </Tag>
                                    {record.todayStats.late > 0 && (
                                        <Tag color="warning" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                            <ClockCircleOutlined /> {record.todayStats.late}
                                        </Tag>
                                    )}
                                    {record.todayStats.absent > 0 && (
                                        <Tag color="error" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                            <CloseCircleOutlined /> {record.todayStats.absent}
                                        </Tag>
                                    )}
                                </>
                            )}
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
                        <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(record); }} />
                    </Tooltip>
                    <Popconfirm 
                        title="Maktabni o'chirish?" 
                        description="Barcha ma'lumotlar o'chiriladi!"
                        onConfirm={() => handleDelete(record.id)}
                        okText="Ha"
                        cancelText="Yo'q"
                    >
                        <Tooltip title="O'chirish">
                            <Button size="small" icon={<DeleteOutlined />} danger onClick={(e) => e.stopPropagation()} />
                        </Tooltip>
                    </Popconfirm>
                    <Tooltip title="Boshqaruv">
                        <Button 
                            size="small" 
                            icon={<RightOutlined />} 
                            onClick={(e) => { e.stopPropagation(); navigate(`/schools/${record.id}/dashboard`); }} 
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
                <StatItem 
                    icon={<BankOutlined />} 
                    value={stats.total} 
                    label="maktab" 
                    color="#722ed1"
                    tooltip="Jami maktablar"
                />
                <Divider />
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
                <Divider />
                {/* Search */}
                <Input
                    placeholder="Qidirish..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 200 }}
                    allowClear
                    size="small"
                />
                <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
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
                    onClick: () => navigate(`/schools/${record.id}/dashboard`),
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
                        label="Kelmagan deb belgilash (daqiqa)"
                            style={{ width: 220 }}
                            initialValue={180}
                            tooltip="Dars boshlangandan keyin necha daqiqadan so'ng 'Kelmagan' deb belgilanadi"
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

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, DatePicker, Card, Calendar, Badge, App, Popconfirm, Row, Col, Typography, Space, Tooltip, Tag } from 'antd';
import { 
    PlusOutlined, 
    DeleteOutlined, 
    CalendarOutlined,
    ClockCircleOutlined,
    CheckCircleOutlined,
    HistoryOutlined,
    GiftOutlined,
} from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { holidaysService } from '../services/holidays';
import { PageHeader, Divider, StatItem, useHeaderMeta } from '../shared/ui';
import type { Holiday } from '../types';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

const Holidays: React.FC = () => {
    const { schoolId } = useSchool();
    const { message } = App.useApp();
    const { setRefresh, setLastUpdated } = useHeaderMeta();
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [form] = Form.useForm();

    const fetchHolidays = useCallback(async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await holidaysService.getAll(schoolId);
            setHolidays(data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [schoolId, setLastUpdated]);

    useEffect(() => {
        fetchHolidays();
    }, [fetchHolidays]);

    const handleRefresh = useCallback(async () => {
        await fetchHolidays();
        setLastUpdated(new Date());
    }, [fetchHolidays, setLastUpdated]);

    useEffect(() => {
        setRefresh(handleRefresh);
        return () => setRefresh(null);
    }, [handleRefresh, setRefresh]);

    // Statistikalar
    const stats = useMemo(() => {
        const today = dayjs();
        const upcoming = holidays.filter(h => dayjs(h.date).isAfter(today)).length;
        const past = holidays.filter(h => dayjs(h.date).isBefore(today)).length;
        const thisMonth = holidays.filter(h => dayjs(h.date).isSame(today, 'month')).length;
        
        // Keyingi bayram
        const nextHoliday = holidays
            .filter(h => dayjs(h.date).isAfter(today))
            .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)))[0];
        
        const daysUntilNext = nextHoliday ? dayjs(nextHoliday.date).diff(today, 'day') : null;
        
        return { total: holidays.length, upcoming, past, thisMonth, nextHoliday, daysUntilNext };
    }, [holidays]);

    const handleAdd = () => {
        form.resetFields();
        setModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        try {
            await holidaysService.delete(id);
            message.success('Bayram o\'chirildi');
            fetchHolidays();
        } catch (err) {
            message.error('O\'chirishda xatolik');
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            await holidaysService.create(schoolId!, {
                ...values,
                date: values.date.toISOString(),
            });
            message.success('Bayram qo\'shildi');
            setModalOpen(false);
            fetchHolidays();
        } catch (err) {
            message.error('Qo\'shishda xatolik');
        }
    };

    const holidayDates = new Map(holidays.map((h) => [dayjs(h.date).format('YYYY-MM-DD'), h]));

    const dateCellRender = (date: Dayjs) => {
        const key = date.format('YYYY-MM-DD');
        const holiday = holidayDates.get(key);
        if (holiday) {
            return (
                <Tooltip title={holiday.name}>
                    <Badge color="red" />
                </Tooltip>
            );
        }
        return null;
    };

    // Kelasi bayramlarni ajratib olish
    const upcomingHolidays = holidays
        .filter(h => dayjs(h.date).isAfter(dayjs().subtract(1, 'day')))
        .sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));

    const pastHolidays = holidays
        .filter(h => dayjs(h.date).isBefore(dayjs()))
        .sort((a, b) => dayjs(b.date).diff(dayjs(a.date)));

    const columns = [
        { 
            title: 'Sana', 
            dataIndex: 'date', 
            key: 'date', 
            width: 140,
            render: (d: string) => {
                const date = dayjs(d);
                const isUpcoming = date.isAfter(dayjs());
                const isPast = date.isBefore(dayjs());
                const isToday = date.isSame(dayjs(), 'day');
                
                return (
                    <Space>
                        <Text strong={isToday} type={isPast ? 'secondary' : undefined}>
                            {date.format('DD MMM, YYYY')}
                        </Text>
                        {isToday && <Tag color="green">Bugun</Tag>}
                        {isUpcoming && !isToday && (
                            <Text type="secondary" style={{ fontSize: 11 }}>
                                ({date.diff(dayjs(), 'day')} kun)
                            </Text>
                        )}
                    </Space>
                );
            }
        },
        { 
            title: 'Nomi', 
            dataIndex: 'name', 
            key: 'name',
            render: (name: string) => (
                <Space>
                    <GiftOutlined style={{ color: '#eb2f96' }} />
                    <Text>{name}</Text>
                </Space>
            )
        },
        {
            title: '',
            key: 'actions',
            width: 60,
            render: (_: any, record: Holiday) => (
                <Popconfirm 
                    title="Bayramni o'chirish?" 
                    onConfirm={() => handleDelete(record.id)}
                    okText="Ha"
                    cancelText="Yo'q"
                >
                    <Tooltip title="O'chirish">
                        <Button size="small" icon={<DeleteOutlined />} danger />
                    </Tooltip>
                </Popconfirm>
            ),
        },
    ];

    return (
        <div>
            {/* Kompakt Header - Dashboard uslubida */}
            <PageHeader>
                <StatItem 
                    icon={<CalendarOutlined />} 
                    value={stats.total} 
                    label="jami" 
                    color="#1890ff"
                    tooltip="Jami bayramlar"
                />
                <Divider />
                <StatItem 
                    icon={<ClockCircleOutlined />} 
                    value={stats.upcoming} 
                    label="kelasi" 
                    color="#52c41a"
                    tooltip="Kelasi bayramlar"
                />
                <StatItem 
                    icon={<HistoryOutlined />} 
                    value={stats.past} 
                    label="o'tgan" 
                    color="#8c8c8c"
                    tooltip="O'tgan bayramlar"
                />
                <StatItem 
                    icon={<CheckCircleOutlined />} 
                    value={stats.thisMonth} 
                    label="bu oy" 
                    color="#722ed1"
                    tooltip="Bu oydagi bayramlar"
                />
                {stats.nextHoliday && (
                    <>
                        <Divider />
                        <Tooltip title={`Keyingi: ${stats.nextHoliday.name}`}>
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: 6,
                                background: '#fff7e6',
                                padding: '4px 10px',
                                borderRadius: 6,
                            }}>
                                <GiftOutlined style={{ color: '#fa8c16' }} />
                                <Text strong style={{ fontSize: 14, color: '#fa8c16' }}>
                                    {stats.daysUntilNext === 0 ? 'Bugun!' : `${stats.daysUntilNext} kun`}
                                </Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>
                                    {stats.nextHoliday.name}
                                </Text>
                            </div>
                        </Tooltip>
                    </>
                )}
            </PageHeader>

            <Row gutter={[12, 12]}>
                {/* Kalendar */}
                <Col xs={24} lg={10}>
                    <Card 
                        title={<><CalendarOutlined /> Kalendar</>}
                        size="small"
                        extra={
                            <Space size={4} style={{ fontSize: 10 }}>
                                <Badge color="red" text="Bayram" />
                            </Space>
                        }
                    >
                        <Calendar fullscreen={false} cellRender={dateCellRender} />
                    </Card>
                </Col>

                {/* Bayramlar ro'yxati */}
                <Col xs={24} lg={14}>
                    <Card 
                        title="Bayramlar ro'yxati"
                        size="small"
                        extra={
                            <Button type="primary" icon={<PlusOutlined />} size="small" onClick={handleAdd}>
                                Qo'shish
                            </Button>
                        }
                    >
                        {/* Kelasi bayramlar */}
                        {upcomingHolidays.length > 0 && (
                            <>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                                    <ClockCircleOutlined /> Kelasi bayramlar ({upcomingHolidays.length})
                                </Text>
                                <Table 
                                    dataSource={upcomingHolidays} 
                                    columns={columns} 
                                    rowKey="id" 
                                    loading={loading}
                                    size="small"
                                    pagination={false}
                                    style={{ marginBottom: 16 }}
                                />
                            </>
                        )}

                        {/* O'tgan bayramlar */}
                        {pastHolidays.length > 0 && (
                            <>
                                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 8 }}>
                                    <HistoryOutlined /> O'tgan bayramlar ({pastHolidays.length})
                                </Text>
                                <Table 
                                    dataSource={pastHolidays} 
                                    columns={columns} 
                                    rowKey="id" 
                                    loading={loading}
                                    size="small"
                                    pagination={{ pageSize: 5, size: 'small' }}
                                />
                            </>
                        )}

                        {holidays.length === 0 && !loading && (
                            <div style={{ textAlign: 'center', padding: 24 }}>
                                <GiftOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
                                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                                    Bayramlar ro'yxati bo'sh
                                </Text>
                            </div>
                        )}
                    </Card>
                </Col>
            </Row>

            <Modal
                title="Yangi bayram qo'shish"
                open={modalOpen}
                onCancel={() => setModalOpen(false)}
                onOk={() => form.submit()}
                okText="Qo'shish"
                cancelText="Bekor"
            >
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                    <Form.Item name="date" label="Sana" rules={[{ required: true, message: 'Sanani tanlang' }]}>
                        <DatePicker style={{ width: '100%' }} format="DD MMM, YYYY" />
                    </Form.Item>
                    <Form.Item name="name" label="Bayram nomi" rules={[{ required: true, message: 'Nomni kiriting' }]}>
                        <Input placeholder="Masalan: Navro'z bayrami" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default Holidays;

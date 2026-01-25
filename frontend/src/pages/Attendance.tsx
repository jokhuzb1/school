import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Tag, DatePicker, Select, Card, Row, Col, Statistic, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { attendanceService } from '../services/attendance';
import { classesService } from '../services/classes';
import type { DailyAttendance, Class, AttendanceStatus } from '../types';
import dayjs from 'dayjs';


const Attendance: React.FC = () => {
    const { schoolId } = useSchool();
    const [records, setRecords] = useState<DailyAttendance[]>([]);
    const [classes, setClasses] = useState<Class[]>([]);
    const [loading, setLoading] = useState(true);
    const [date, setDate] = useState(dayjs());
    const [classFilter, setClassFilter] = useState<string | undefined>();
    const [statusFilter, setStatusFilter] = useState<string | undefined>();

    const fetchData = async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await attendanceService.getToday(schoolId, { classId: classFilter, status: statusFilter });
            setRecords(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchClasses = async () => {
        if (!schoolId) return;
        try {
            const data = await classesService.getAll(schoolId);
            setClasses(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
        fetchClasses();
    }, [schoolId, classFilter, statusFilter]);

    const handleStatusChange = async (id: string, status: AttendanceStatus) => {
        try {
            await attendanceService.update(id, { status });
            message.success('Status updated');
            fetchData();
        } catch (err) {
            message.error('Failed to update');
        }
    };

    const stats = {
        present: records.filter((r) => r.status === 'PRESENT' || r.status === 'LATE').length,
        late: records.filter((r) => r.status === 'LATE').length,
        absent: records.filter((r) => r.status === 'ABSENT').length,
    };

    const columns = [
        { title: 'Student', dataIndex: ['student', 'name'], key: 'student' },
        { title: 'Class', dataIndex: ['student', 'class', 'name'], key: 'class' },
        {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (status: AttendanceStatus, record: DailyAttendance) => (
                <Select
                    value={status}
                    size="small"
                    style={{ width: 100 }}
                    onChange={(val) => handleStatusChange(record.id, val)}
                    options={[
                        { value: 'PRESENT', label: <Tag color="green">Present</Tag> },
                        { value: 'LATE', label: <Tag color="orange">Late</Tag> },
                        { value: 'ABSENT', label: <Tag color="red">Absent</Tag> },
                        { value: 'EXCUSED', label: <Tag color="gray">Excused</Tag> },
                    ]}
                />
            ),
        },
        { title: 'First Scan', dataIndex: 'firstScanTime', key: 'first', render: (t: string) => t ? dayjs(t).format('HH:mm') : '-' },
        { title: 'Last Scan', dataIndex: 'lastScanTime', key: 'last', render: (t: string) => t ? dayjs(t).format('HH:mm') : '-' },
        { title: 'Late By', dataIndex: 'lateMinutes', key: 'late', render: (m: number | null) => m ? `${m} min` : '-' },
    ];

    return (
        <div>
            <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col xs={8}><Card><Statistic title="Present" value={stats.present} styles={{ value: { color: '#52c41a' } }} /></Card></Col>
                <Col xs={8}><Card><Statistic title="Late" value={stats.late} styles={{ value: { color: '#faad14' } }} /></Card></Col>
                <Col xs={8}><Card><Statistic title="Absent" value={stats.absent} styles={{ value: { color: '#ff4d4f' } }} /></Card></Col>
            </Row>

            <Space style={{ marginBottom: 16, flexWrap: 'wrap' }} size="middle">
                <DatePicker value={date} onChange={(d) => d && setDate(d)} />
                <Select
                    placeholder="Filter by class"
                    value={classFilter}
                    onChange={setClassFilter}
                    style={{ width: 150 }}
                    allowClear
                    options={classes.map((c) => ({ label: c.name, value: c.id }))}
                />
                <Select
                    placeholder="Filter by status"
                    value={statusFilter}
                    onChange={setStatusFilter}
                    style={{ width: 120 }}
                    allowClear
                    options={[
                        { value: 'PRESENT', label: 'Present' },
                        { value: 'LATE', label: 'Late' },
                        { value: 'ABSENT', label: 'Absent' },
                        { value: 'EXCUSED', label: 'Excused' },
                    ]}
                />
                <Button icon={<DownloadOutlined />}>Export</Button>
            </Space>

            <Table dataSource={records} columns={columns} rowKey="id" loading={loading} size="middle" />
        </div>
    );
};

export default Attendance;

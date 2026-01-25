import React, { useEffect, useState } from 'react';
import { Card, Form, InputNumber, TimePicker, Select, Button, message, Spin } from 'antd';
import { useSchool } from '../hooks/useSchool';
import { schoolsService } from '../services/schools';

import dayjs from 'dayjs';

const Settings: React.FC = () => {
    const { schoolId } = useSchool();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    useEffect(() => {
        const fetchSchool = async () => {
            if (!schoolId) return;
            setLoading(true);
            try {
                const data = await schoolsService.getById(schoolId);
                form.setFieldsValue({
                    lateThresholdMinutes: data.lateThresholdMinutes,
                    absenceCutoffTime: dayjs(data.absenceCutoffTime, 'HH:mm'),
                    timezone: data.timezone,
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSchool();
    }, [schoolId]);

    const handleSave = async (values: any) => {
        if (!schoolId) return;
        setSaving(true);
        try {
            await schoolsService.update(schoolId, {
                lateThresholdMinutes: values.lateThresholdMinutes,
                absenceCutoffTime: values.absenceCutoffTime?.format('HH:mm'),
                timezone: values.timezone,
            });
            message.success('Settings saved');
        } catch (err) {
            message.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>;
    }

    return (
        <div>
            <Card title="School Settings" style={{ maxWidth: 600 }}>
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item name="lateThresholdMinutes" label="Late Threshold (minutes)">
                        <InputNumber min={0} max={120} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="absenceCutoffTime" label="Absence Cutoff Time">
                        <TimePicker format="HH:mm" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="timezone" label="Timezone">
                        <Select
                            options={[
                                { value: 'Asia/Tashkent', label: 'Asia/Tashkent (UTC+5)' },
                                { value: 'Asia/Almaty', label: 'Asia/Almaty (UTC+6)' },
                                { value: 'Europe/Moscow', label: 'Europe/Moscow (UTC+3)' },
                            ]}
                        />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={saving}>
                            Save Settings
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Settings;

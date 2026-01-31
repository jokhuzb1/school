import React, { useEffect, useState, useCallback } from 'react';
import { Card, Form, InputNumber, Button, Spin, App, Space } from 'antd';
import { 
    SettingOutlined, 
    ClockCircleOutlined, 
    SaveOutlined,
} from '@ant-design/icons';
import { useSchool } from '../hooks/useSchool';
import { schoolsService } from '../services/schools';
import { PageHeader, StatItem, useHeaderMeta } from '../shared/ui';

const Settings: React.FC = () => {
    const { schoolId } = useSchool();
    const { message } = App.useApp();
    const { setRefresh, setLastUpdated } = useHeaderMeta();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [schoolName, setSchoolName] = useState('');
    const [form] = Form.useForm();

    const fetchSchool = useCallback(async () => {
        if (!schoolId) return;
        setLoading(true);
        try {
            const data = await schoolsService.getById(schoolId);
            setSchoolName(data.name);
            form.setFieldsValue({
                lateThresholdMinutes: data.lateThresholdMinutes,
                absenceCutoffMinutes: data.absenceCutoffMinutes,
            });
            setLastUpdated(new Date());
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [schoolId, form, setLastUpdated]);

    useEffect(() => {
        fetchSchool();
    }, [fetchSchool]);

    const handleRefresh = useCallback(async () => {
        await fetchSchool();
        setLastUpdated(new Date());
    }, [fetchSchool, setLastUpdated]);

    useEffect(() => {
        setRefresh(handleRefresh);
        return () => setRefresh(null);
    }, [handleRefresh, setRefresh]);

    const handleSave = async (values: any) => {
        if (!schoolId) return;
        setSaving(true);
        try {
            await schoolsService.update(schoolId, {
                lateThresholdMinutes: values.lateThresholdMinutes,
                absenceCutoffMinutes: values.absenceCutoffMinutes,
            });
            message.success('Sozlamalar saqlandi');
        } catch (err) {
            message.error('Saqlashda xatolik');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>;
    }

    return (
        <div>
            {/* Kompakt Header */}
            <PageHeader>
                <StatItem 
                    icon={<SettingOutlined />} 
                    value={schoolName} 
                    label="sozlamalari" 
                    color="#722ed1"
                />
            </PageHeader>

            <Card 
                title={
                    <Space>
                        <ClockCircleOutlined style={{ color: '#1890ff' }} />
                        <span>Davomat sozlamalari</span>
                    </Space>
                }
                size="small"
                style={{ maxWidth: 500 }}
            >
                <Form form={form} layout="vertical" onFinish={handleSave}>
                    <Form.Item 
                        name="lateThresholdMinutes" 
                        label="Kechikish chegarasi (daqiqa)"
                        tooltip="Dars boshlanishidan necha daqiqa keyin kelgan o'quvchi 'Kech' hisoblanadi"
                    >
                        <InputNumber 
                            min={0} 
                            max={120} 
                            style={{ width: '100%' }} 
                            placeholder="15"
                            addonAfter="daqiqa"
                        />
                    </Form.Item>
                    
                    <Form.Item 
                        name="absenceCutoffMinutes" 
                        label="Kelmadi deb belgilash muddati"
                        tooltip="Dars boshlanishidan necha daqiqa keyin kelmagan o'quvchi avtomatik 'Kelmadi' deb belgilanadi"
                    >
                        <InputNumber 
                            min={0} 
                            max={600} 
                            style={{ width: '100%' }} 
                            placeholder="180"
                            addonAfter="daqiqa"
                        />
                    </Form.Item>

                    <Form.Item>
                        <Button 
                            type="primary" 
                            htmlType="submit" 
                            loading={saving}
                            icon={<SaveOutlined />}
                        >
                            Saqlash
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Settings;

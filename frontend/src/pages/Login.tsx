import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const { Title } = Typography;

const Login: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();
    const { message } = App.useApp();

    const onFinish = async (values: { email: string; password: string }) => {
        setLoading(true);
        try {
            const user = await login(values.email, values.password);
            message.success('Login successful!');
            if (user.role === 'SUPER_ADMIN') {
                navigate('/dashboard');
            } else if (user.schoolId) {
                navigate(`/schools/${user.schoolId}/dashboard`);
            } else {
                navigate('/dashboard');
            }
        } catch (error: any) {
            message.error(error.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: '#f0f2f5',
            }}
        >
            <Card style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
                        Attendance System
                    </Title>
                    <p style={{ color: '#8c8c8c', marginTop: 8 }}>Sign in to your account</p>
                </div>
                <Form
                    name="login"
                    onFinish={onFinish}
                    size="large"
                    layout="vertical"
                    initialValues={{
                        email: 'admin@system.com',
                        password: 'admin123'
                    }}
                >
                    <Form.Item
                        name="email"
                        rules={[
                            { required: true, message: 'Please enter your email' },
                            { type: 'email', message: 'Please enter a valid email' },
                        ]}
                    >
                        <Input prefix={<UserOutlined />} placeholder="Email" />
                    </Form.Item>
                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please enter your password' }]}
                    >
                        <Input.Password prefix={<LockOutlined />} placeholder="Password" />
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading} block>
                            Sign In
                        </Button>
                    </Form.Item>
                </Form>
            </Card>
        </div>
    );
};

export default Login;

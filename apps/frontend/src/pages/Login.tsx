import React, { useState } from "react";
import { Form, Input, Button, Card, Typography, App } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@entities/auth";

const { Title } = Typography;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values: { email: string; password: string }) => {
    console.log("Login attempt:", values.email); // Debug
    setLoading(true);
    try {
      const user = await login(values.email, values.password);
      console.log("Login success:", user); // Debug
      message.success("Kirish muvaffaqiyatli!");
      if (user.role === "SUPER_ADMIN") {
        navigate("/dashboard");
      } else if (user.schoolId) {
        navigate(`/schools/${user.schoolId}/dashboard`);
      } else {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Login error:", error); // Debug
      message.error(error.response?.data?.error || "Kirishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 400, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
            Davomat tizimi
          </Title>
          <p style={{ color: "#8c8c8c", marginTop: 8 }}>
            Hisobingizga kiring
          </p>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          onSubmitCapture={(e) => e.preventDefault()}
          size="large"
          layout="vertical"
          initialValues={{
            email: "admin@system.com",
            password: "admin123",
          }}
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: "Elektron pochtani kiriting" },
              { type: "email", message: "To'g'ri elektron pochta kiriting" },
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="Elektron pochta" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "Parolni kiriting" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Parol" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              Kirish
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Login;


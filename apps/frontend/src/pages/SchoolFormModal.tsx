import {
  BankOutlined,
  EnvironmentOutlined,
  LockOutlined,
  MailOutlined,
  PhoneOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Divider as AntDivider, Form, Input, InputNumber, Modal, Space } from "antd";
import type { FormInstance } from "antd/es/form";

type Props = {
  open: boolean;
  editingId: string | null;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
};

export function SchoolFormModal({ open, editingId, form, onClose, onSubmit }: Props) {
  return (
    <Modal
      title={editingId ? "Maktabni tahrirlash" : "Yangi maktab qo'shish"}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Saqlash"
      cancelText="Bekor"
      width={520}
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <AntDivider style={{ margin: "8px 0 16px" }}>
          <BankOutlined /> Maktab ma'lumotlari
        </AntDivider>

        <Form.Item
          name="name"
          label="Maktab nomi"
          rules={[
            { required: true, message: "Maktab nomini kiriting" },
            { min: 2, message: "Kamida 2 ta belgi bo'lishi kerak" },
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
          rules={[{ pattern: /^[\d\s+\-()]+$/, message: "Noto'g'ri telefon formati" }]}
        >
          <Input prefix={<PhoneOutlined />} placeholder="+998 XX XXX XX XX" />
        </Form.Item>

        <Space style={{ width: "100%" }} size={12}>
          <Form.Item
            name="lateThresholdMinutes"
            label="Kechikish chegarasi (daqiqa)"
            style={{ width: 200 }}
            initialValue={15}
          >
            <InputNumber min={0} max={120} style={{ width: "100%" }} placeholder="15" />
          </Form.Item>

          <Form.Item
            name="absenceCutoffMinutes"
            label="Kelmadi deb belgilash (daqiqa)"
            style={{ width: 220 }}
            initialValue={180}
            tooltip="Dars boshlangandan keyin necha daqiqadan so'ng 'Kelmadi' deb belgilanadi"
          >
            <InputNumber min={0} max={600} style={{ width: "100%" }} placeholder="180" addonAfter="daq" />
          </Form.Item>
        </Space>

        {!editingId && (
          <>
            <AntDivider style={{ margin: "16px 0" }}>
              <UserOutlined /> Admin hisobi
            </AntDivider>

            <Form.Item
              name="adminName"
              label="Admin ismi"
              rules={[
                { required: true, message: "Admin ismini kiriting" },
                { min: 2, message: "Kamida 2 ta belgi bo'lishi kerak" },
              ]}
            >
              <Input prefix={<UserOutlined />} placeholder="Masalan: Abdullayev Abdulla" />
            </Form.Item>

            <Form.Item
              name="adminEmail"
              label="Admin elektron pochta"
              rules={[
                { required: true, message: "Elektron pochta kiriting" },
                { type: "email", message: "Noto'g'ri elektron pochta formati" },
                {
                  pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
                  message: "To'g'ri elektron pochta kiriting (masalan: admin@maktab.uz)",
                },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="admin@maktab.uz" />
            </Form.Item>

            <Form.Item
              name="adminPassword"
              label="Parol"
              rules={[
                { required: true, message: "Parolni kiriting" },
                { min: 6, message: "Parol kamida 6 ta belgidan iborat bo'lishi kerak" },
                { pattern: /^(?=.*[a-zA-Z])(?=.*\d)/, message: "Parolda harf va raqam bo'lishi kerak" },
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Kamida 6 ta belgi" />
            </Form.Item>

            <Form.Item
              name="confirmPassword"
              label="Parolni tasdiqlash"
              dependencies={["adminPassword"]}
              rules={[
                { required: true, message: "Parolni tasdiqlang" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("adminPassword") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("Parollar mos kelmadi"));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Parolni qayta kiriting" />
            </Form.Item>
          </>
        )}

        {editingId && (
          <Form.Item
            name="email"
            label="Maktab elektron pochta"
            rules={[{ type: "email", message: "Noto'g'ri elektron pochta formati" }]}
          >
            <Input prefix={<MailOutlined />} placeholder="maktab@example.com" />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
}

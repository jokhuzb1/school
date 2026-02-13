import { Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd/es/form";
import type { CreateUserData } from "@entities/user";

type Props = {
  open: boolean;
  form: FormInstance<CreateUserData>;
  onClose: () => void;
  onSubmit: (values: CreateUserData) => Promise<void>;
};

export function UserCreateModal({ open, form, onClose, onSubmit }: Props) {
  return (
    <Modal
      title="Yangi foydalanuvchi"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Saqlash"
      cancelText="Bekor"
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          name="name"
          label="Ism familiya"
          rules={[{ required: true, message: "Ismni kiriting" }]}
        >
          <Input placeholder="Masalan: Aliyev Vali" />
        </Form.Item>
        <Form.Item
          name="email"
          label="Email"
          rules={[
            { required: true, message: "Email kiriting" },
            { type: "email", message: "Noto'g'ri email formati" },
          ]}
        >
          <Input placeholder="masalan@email.com" />
        </Form.Item>
        <Form.Item
          name="password"
          label="Parol"
          rules={[
            { required: true, message: "Parol kiriting" },
            { min: 6, message: "Kamida 6 ta belgi" },
          ]}
        >
          <Input.Password placeholder="Kamida 6 ta belgi" />
        </Form.Item>
        <Form.Item
          name="role"
          label="Rol"
          rules={[{ required: true, message: "Rolni tanlang" }]}
        >
          <Select
            placeholder="Tanlang"
            options={[
              { value: "TEACHER", label: "O'qituvchi" },
              { value: "GUARD", label: "Nazoratchi" },
            ]}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}


import { Form, Input, Modal } from "antd";
import type { FormInstance } from "antd/es/form";

type Props = {
  open: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: { name: string; password?: string }) => Promise<void>;
};

export function UserEditModal({ open, form, onClose, onSubmit }: Props) {
  return (
    <Modal
      title="Foydalanuvchini tahrirlash"
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
          name="password"
          label="Yangi parol (ixtiyoriy)"
          rules={[{ min: 6, message: "Kamida 6 ta belgi" }]}
        >
          <Input.Password placeholder="Bo'sh qoldiring agar o'zgartirmaysiz" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

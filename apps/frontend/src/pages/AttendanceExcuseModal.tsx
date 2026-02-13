import { Form, Input, Modal } from "antd";
import type { FormInstance } from "antd/es/form";

type Props = {
  open: boolean;
  form: FormInstance;
  onOk: () => Promise<void>;
  onClose: () => void;
};

export function AttendanceExcuseModal({ open, form, onOk, onClose }: Props) {
  return (
    <Modal
      title="Sababli deb belgilash"
      open={open}
      onOk={onOk}
      onCancel={onClose}
      okText="Saqlash"
      cancelText="Bekor"
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="notes"
          label="Sabab (izoh)"
          rules={[{ required: true, message: "Iltimos, sababni kiriting" }]}
        >
          <Input.TextArea rows={4} placeholder="Masalan: Kasallik tufayli kelmadi" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

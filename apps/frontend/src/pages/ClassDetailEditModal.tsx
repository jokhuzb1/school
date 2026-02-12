import { Form, Input, Modal, Select, TimePicker } from "antd";
import type { FormInstance } from "antd/es/form";

type Props = {
  open: boolean;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
};

export function ClassDetailEditModal({ open, form, onClose, onSubmit }: Props) {
  return (
    <Modal
      title="Sinfni tahrirlash"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Saqlash"
      cancelText="Bekor"
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="name" label="Sinf nomi" rules={[{ required: true, message: "Nomni kiriting" }]}>
          <Input placeholder="Masalan: 1A, 5B" />
        </Form.Item>
        <Form.Item name="gradeLevel" label="Sinf darajasi" rules={[{ required: true, message: "Darajani tanlang" }]}>
          <Select
            placeholder="Tanlang"
            options={[...Array(12)].map((_, i) => ({ value: i + 1, label: `${i + 1}-sinf` }))}
          />
        </Form.Item>
        <Form.Item name="startTime" label="Dars boshlanish vaqti" rules={[{ required: true, message: "Vaqtni tanlang" }]}>
          <TimePicker format="HH:mm" placeholder="08:00" style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="endTime" label="Dars tugash vaqti">
          <TimePicker format="HH:mm" placeholder="14:00" style={{ width: "100%" }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}

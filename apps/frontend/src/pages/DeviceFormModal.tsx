import { Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd/es/form";

type DeviceFormModalProps = {
  open: boolean;
  editingId: string | null;
  form: FormInstance;
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
};

export function DeviceFormModal({
  open,
  editingId,
  form,
  onClose,
  onSubmit,
}: DeviceFormModalProps) {
  return (
    <Modal
      title={editingId ? "Qurilmani tahrirlash" : "Yangi qurilma"}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Saqlash"
      cancelText="Bekor"
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item
          name="name"
          label="Qurilma nomi"
          rules={[{ required: true, message: "Nomni kiriting" }]}
        >
          <Input placeholder="Masalan: Asosiy kirish" />
        </Form.Item>
        <Form.Item
          name="deviceId"
          label="Qurilma ID (Hikvision'dan)"
          rules={[{ required: true, message: "Qurilma ID kiriting" }]}
        >
          <Input placeholder="Qurilmadagi ID" />
        </Form.Item>
        <Form.Item
          name="type"
          label="Turi"
          rules={[{ required: true, message: "Turini tanlang" }]}
        >
          <Select
            options={[
              { value: "ENTRANCE", label: "Kirish" },
              { value: "EXIT", label: "Chiqish" },
            ]}
          />
        </Form.Item>
        <Form.Item name="location" label="Joylashuvi">
          <Input placeholder="Masalan: 1-qavat, asosiy kirish" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

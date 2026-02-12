import { Form, Input, Modal, Select } from "antd";
import type { FormInstance } from "antd/es/form";
import type { Class } from "@shared/types";

type Props = {
  open: boolean;
  editingId: string | null;
  form: FormInstance;
  classes: Class[];
  onClose: () => void;
  onSubmit: (values: any) => Promise<void>;
};

export function StudentFormModal({
  open,
  editingId,
  form,
  classes,
  onClose,
  onSubmit,
}: Props) {
  return (
    <Modal
      title={editingId ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="Saqlash"
      cancelText="Bekor"
    >
      <Form form={form} layout="vertical" onFinish={onSubmit}>
        <Form.Item name="deviceStudentId" label="Qurilma ID (qurilmadagi)">
          <Input placeholder="Student ID" />
        </Form.Item>
        <Form.Item name="lastName" label="Familiya" rules={[{ required: true, message: "Familiyani kiriting" }]}>
          <Input placeholder="Aliyev" />
        </Form.Item>
        <Form.Item name="firstName" label="Ism" rules={[{ required: true, message: "Ismni kiriting" }]}>
          <Input placeholder="Ali" />
        </Form.Item>
        <Form.Item name="fatherName" label="Otasining ismi">
          <Input placeholder="Vali o'g'li" />
        </Form.Item>
        <Form.Item name="gender" label="Jinsi" rules={[{ required: true, message: "Jinsini tanlang" }]} initialValue="MALE">
          <Select placeholder="Jinsini tanlang">
            <Select.Option value="MALE">Erkak</Select.Option>
            <Select.Option value="FEMALE">Ayol</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="classId" label="Sinf" rules={[{ required: true, message: "Sinfni tanlang" }]}>
          <Select placeholder="Sinfni tanlang" options={classes.map((c) => ({ label: c.name, value: c.id }))} />
        </Form.Item>
        <Form.Item name="parentPhone" label="Telefon raqami">
          <Input placeholder="+998 XX XXX XX XX" />
        </Form.Item>
      </Form>
    </Modal>
  );
}

import { BookOutlined } from "@ant-design/icons";
import { Button, Divider, Form, Modal, Select, Space, Tag, Typography } from "antd";
import type { FormInstance } from "antd/es/form";
import type { Class } from "@shared/types";
import type { TeacherClass, User } from "@entities/user";

const { Text } = Typography;

type Props = {
  open: boolean;
  selectedTeacher: User | null;
  teacherClasses: TeacherClass[];
  availableClasses: Class[];
  form: FormInstance;
  onClose: () => void;
  onAssign: (values: { classId: string }) => Promise<void>;
  onUnassign: (classId: string) => Promise<void>;
};

export function UserAssignClassesModal({
  open,
  selectedTeacher,
  teacherClasses,
  availableClasses,
  form,
  onClose,
  onAssign,
  onUnassign,
}: Props) {
  return (
    <Modal
      title={`${selectedTeacher?.name} — Sinflar`}
      open={open}
      onCancel={onClose}
      footer={null}
      width={500}
    >
      <div style={{ marginBottom: 16 }}>
        <Text strong>Biriktirilgan sinflar:</Text>
        <div style={{ marginTop: 8 }}>
          {teacherClasses.length === 0 ? (
            <Text type="secondary">Hech qanday sinf biriktirilmagan</Text>
          ) : (
            <Space wrap>
              {teacherClasses.map((cls) => (
                <Tag
                  key={cls.id}
                  closable
                  onClose={() => onUnassign(cls.id)}
                  color="blue"
                >
                  <BookOutlined /> {cls.name}
                </Tag>
              ))}
            </Space>
          )}
        </div>
      </div>

      <Divider />

      <Form form={form} layout="inline" onFinish={onAssign}>
        <Form.Item
          name="classId"
          rules={[{ required: true, message: "Sinfni tanlang" }]}
          style={{ flex: 1 }}
        >
          <Select
            placeholder="Sinf tanlang"
            options={availableClasses.map((c) => ({
              value: c.id,
              label: `${c.name} (${c.gradeLevel}-sinf)`,
            }))}
            disabled={availableClasses.length === 0}
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" disabled={availableClasses.length === 0}>
            Biriktirish
          </Button>
        </Form.Item>
      </Form>
    </Modal>
  );
}


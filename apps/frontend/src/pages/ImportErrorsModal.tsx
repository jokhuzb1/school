import { Modal, Typography } from "antd";

const { Text } = Typography;

type Props = {
  open: boolean;
  errors: Array<{ row: number; message: string }>;
  onClose: () => void;
};

export function ImportErrorsModal({ open, errors, onClose }: Props) {
  return (
    <Modal
      title="Import xatolari"
      open={open}
      onCancel={onClose}
      onOk={onClose}
      okText="Yopish"
      cancelButtonProps={{ style: { display: "none" } }}
    >
      <div style={{ maxHeight: 300, overflow: "auto" }}>
        {errors.length === 0 ? (
          <Text type="secondary">Xatoliklar yo'q</Text>
        ) : (
          errors.slice(0, 50).map((e, idx) => (
            <div key={`${e.row}-${idx}`}>
              <Text>
                {e.row}-qatorda: {e.message}
              </Text>
            </div>
          ))
        )}
        {errors.length > 50 && (
          <Text type="secondary">Yana {errors.length - 50} ta xatolik bor</Text>
        )}
      </div>
    </Modal>
  );
}

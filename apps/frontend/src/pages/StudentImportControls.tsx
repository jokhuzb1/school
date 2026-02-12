import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, Space, Switch, Typography } from "antd";
import type { ChangeEvent } from "react";

const { Text } = Typography;

type Props = {
  allowCreateMissingClass: boolean;
  setAllowCreateMissingClass: (value: boolean) => void;
  onImport: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onDownloadTemplate: () => Promise<void>;
  onExport: () => Promise<void>;
};

export function StudentImportControls({
  allowCreateMissingClass,
  setAllowCreateMissingClass,
  onImport,
  onDownloadTemplate,
  onExport,
}: Props) {
  return (
    <>
      <div style={{ display: "inline-block" }}>
        <input type="file" accept=".xlsx" style={{ display: "none" }} id="import-excel" onChange={onImport} />
        <Button icon={<UploadOutlined />} size="small" onClick={() => document.getElementById("import-excel")?.click()}>
          Yuklash
        </Button>
      </div>
      <Space size={4}>
        <Switch size="small" checked={allowCreateMissingClass} onChange={setAllowCreateMissingClass} />
        <Text type="secondary" style={{ fontSize: 12 }}>
          Sinf yo'q bo'lsa yaratish
        </Text>
      </Space>
      <Button size="small" onClick={onDownloadTemplate}>
        Shablon
      </Button>
      <Button icon={<DownloadOutlined />} size="small" onClick={onExport}>
        Eksport
      </Button>
    </>
  );
}

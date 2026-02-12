import { CopyOutlined, EyeInvisibleOutlined, EyeOutlined } from "@ant-design/icons";
import { Button, Input, Tooltip, Typography } from "antd";
import { useState } from "react";

const { Text } = Typography;

type CopyFieldProps = {
  label: string;
  value: string;
  kind: "url" | "secret" | "header";
  ariaCopyLabel: string;
  onCopy: (value: string) => void;
};

const formatWebhookPath = (value?: string) => {
  if (!value) return "";
  if (value.startsWith("/")) return value;
  try {
    const url = new URL(value);
    return `${url.pathname}${url.search}`;
  } catch {
    return value;
  }
};

const maskValue = (value: string, kind: "url" | "secret" | "header") => {
  if (!value) return "";
  if (kind === "url") {
    const formatted = formatWebhookPath(value);
    return formatted.replace(/secret=[^&]+/i, "secret=***");
  }
  return "••••••••••••••••";
};

export function DeviceCopyField({
  label,
  value,
  kind,
  ariaCopyLabel,
  onCopy,
}: CopyFieldProps) {
  const [visible, setVisible] = useState(false);
  const displayValue = visible
    ? kind === "url"
      ? formatWebhookPath(value)
      : value
    : maskValue(value, kind);

  return (
    <div>
      <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
        {label}
      </Text>
      <Input.Group compact>
        <Input value={displayValue} readOnly style={{ width: "calc(100% - 64px)" }} size="small" />
        <Tooltip title={visible ? "Yashirish" : "Ko'rsatish"}>
          <Button
            icon={visible ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            size="small"
            aria-label={`${label} ${visible ? "yashirish" : "ko'rsatish"}`}
            onClick={() => setVisible((v) => !v)}
          />
        </Tooltip>
        <Tooltip title="Nusxalash">
          <Button
            icon={<CopyOutlined />}
            size="small"
            aria-label={ariaCopyLabel}
            onClick={() => onCopy(kind === "url" ? formatWebhookPath(value) : value)}
          />
        </Tooltip>
      </Input.Group>
    </div>
  );
}

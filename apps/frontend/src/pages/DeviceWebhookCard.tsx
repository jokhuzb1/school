import { ApiOutlined } from "@ant-design/icons";
import { Button, Card, Col, Space, Typography } from "antd";
import { DeviceCopyField } from "./DeviceCopyField";

const { Text } = Typography;

type WebhookInfo = {
  enforceSecret: boolean;
  secretHeaderName: string;
  inUrl: string;
  outUrl: string;
  inUrlWithSecret: string;
  outUrlWithSecret: string;
  inSecret: string;
  outSecret: string;
};

type Props = {
  webhookInfo: WebhookInfo | null;
  showWebhookAdvanced: boolean;
  setShowWebhookAdvanced: (updater: (prev: boolean) => boolean) => void;
  copyToClipboard: (value: string) => void;
};

export function DeviceWebhookCard({
  webhookInfo,
  showWebhookAdvanced,
  setShowWebhookAdvanced,
  copyToClipboard,
}: Props) {
  return (
    <Col xs={24} lg={8}>
      <Card
        title={
          <>
            <ApiOutlined /> Webhook manzili
          </>
        }
        size="small"
        styles={{ body: { padding: 12 } }}
      >
        {webhookInfo ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <DeviceCopyField
              label="Kirish webhooki (Hikvision URL)"
              value={webhookInfo.inUrlWithSecret}
              kind="url"
              ariaCopyLabel="Kirish webhook manzilini nusxalash"
              onCopy={copyToClipboard}
            />
            <DeviceCopyField
              label="Chiqish webhooki (Hikvision URL)"
              value={webhookInfo.outUrlWithSecret}
              kind="url"
              ariaCopyLabel="Chiqish webhook manzilini nusxalash"
              onCopy={copyToClipboard}
            />

            <div style={{ marginTop: 4 }}>
              <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 6 }}>
                <Space size={8}>
                  <span>Advanced (header orqali yuborish):</span>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => setShowWebhookAdvanced((v) => !v)}
                    style={{ padding: 0, height: "auto" }}
                  >
                    {showWebhookAdvanced ? "Yashirish" : "Ko'rsatish"}
                  </Button>
                </Space>
              </Text>
              {showWebhookAdvanced && (
                <Space direction="vertical" size={6} style={{ width: "100%" }}>
                  <DeviceCopyField
                    label="Header nomi (key)"
                    value={webhookInfo.secretHeaderName}
                    kind="header"
                    ariaCopyLabel="Webhook header nomini nusxalash"
                    onCopy={copyToClipboard}
                  />
                  <DeviceCopyField
                    label="Kirish secret (value)"
                    value={webhookInfo.inSecret}
                    kind="secret"
                    ariaCopyLabel="Kirish webhook secretni nusxalash"
                    onCopy={copyToClipboard}
                  />
                  <DeviceCopyField
                    label="Chiqish secret (value)"
                    value={webhookInfo.outSecret}
                    kind="secret"
                    ariaCopyLabel="Chiqish webhook secretni nusxalash"
                    onCopy={copyToClipboard}
                  />
                </Space>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 10 }}>
              Hikvision odatda custom header yuborolmaydi, shuning uchun URL (secret bilan) ishlatiladi.
              Server esa header yoki query orqali secretni qabul qiladi.
            </Text>
          </div>
        ) : (
          <Text type="secondary">Yuklanmoqda...</Text>
        )}
      </Card>
    </Col>
  );
}

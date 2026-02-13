import { Icons } from '../../components/ui/Icons';
import type { WebhookInfo } from '../../api';

type WebhookInfoCardProps = {
  webhookLoading: boolean;
  webhookInfo: WebhookInfo | null;
  showWebhookAdvanced: boolean;
  setShowWebhookAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
  formatWebhookUrl: (value?: string) => string;
  maskWebhookValue: (value: string, kind: 'url' | 'secret' | 'header') => string;
  copyToClipboard: (value: string, label: string) => Promise<void>;
  getBackendPortLabel: () => string;
};

export function WebhookInfoCard({
  webhookLoading,
  webhookInfo,
  showWebhookAdvanced,
  setShowWebhookAdvanced,
  formatWebhookUrl,
  maskWebhookValue,
  copyToClipboard,
  getBackendPortLabel,
}: WebhookInfoCardProps) {
  return (
    <div className="card">
      <h2>Webhook manzillari</h2>
      {webhookLoading && <p className="notice">Yuklanmoqda...</p>}
      {!webhookLoading && !webhookInfo && (
        <p className="notice notice-warning">Webhook ma'lumotlari topilmadi</p>
      )}
      {webhookInfo && (
        <div className="webhook-panel">
          <div className="webhook-field">
            <label>Kirish webhooki (Hikvision URL)</label>
            <div className="webhook-row">
              <input
                className="input webhook-input"
                readOnly
                value={showWebhookAdvanced
                  ? formatWebhookUrl(webhookInfo.inUrlWithSecret)
                  : maskWebhookValue(formatWebhookUrl(webhookInfo.inUrlWithSecret), 'url')}
              />
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowWebhookAdvanced((v) => !v)}
                title={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                aria-label={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
              >
                {showWebhookAdvanced ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
              <button
                type="button"
                className="btn-icon btn-primary"
                onClick={() => void copyToClipboard(formatWebhookUrl(webhookInfo.inUrlWithSecret), 'Kirish webhooki')}
                title="Nusxalash"
                aria-label="Nusxalash"
              >
                <Icons.Copy />
              </button>
            </div>
          </div>

          <div className="webhook-field">
            <label>Chiqish webhooki (Hikvision URL)</label>
            <div className="webhook-row">
              <input
                className="input webhook-input"
                readOnly
                value={showWebhookAdvanced
                  ? formatWebhookUrl(webhookInfo.outUrlWithSecret)
                  : maskWebhookValue(formatWebhookUrl(webhookInfo.outUrlWithSecret), 'url')}
              />
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowWebhookAdvanced((v) => !v)}
                title={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                aria-label={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
              >
                {showWebhookAdvanced ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
              <button
                type="button"
                className="btn-icon btn-primary"
                onClick={() => void copyToClipboard(formatWebhookUrl(webhookInfo.outUrlWithSecret), 'Chiqish webhooki')}
                title="Nusxalash"
                aria-label="Nusxalash"
              >
                <Icons.Copy />
              </button>
            </div>
          </div>

          <div className="webhook-advanced">
            <div className="webhook-advanced-header">
              <span>Advanced (header orqali yuborish)</span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setShowWebhookAdvanced((v) => !v)}
                title={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                aria-label={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
              >
                {showWebhookAdvanced ? <Icons.EyeOff /> : <Icons.Eye />}
              </button>
            </div>
            {showWebhookAdvanced && (
              <div className="webhook-advanced-body">
                <div className="webhook-field">
                  <label>Header nomi (key)</label>
                  <div className="webhook-row">
                    <input
                      className="input webhook-input"
                      readOnly
                      value={webhookInfo.secretHeaderName}
                    />
                    <button
                      type="button"
                      className="btn-icon btn-primary"
                      onClick={() => void copyToClipboard(webhookInfo.secretHeaderName, 'Header nomi')}
                      title="Nusxalash"
                      aria-label="Nusxalash"
                    >
                      <Icons.Copy />
                    </button>
                  </div>
                </div>
                <div className="webhook-field">
                  <label>Kirish secret</label>
                  <div className="webhook-row">
                    <input
                      className="input webhook-input"
                      readOnly
                      value={webhookInfo.inSecret}
                    />
                    <button
                      type="button"
                      className="btn-icon btn-primary"
                      onClick={() => void copyToClipboard(webhookInfo.inSecret, 'Kirish secret')}
                      title="Nusxalash"
                      aria-label="Nusxalash"
                    >
                      <Icons.Copy />
                    </button>
                  </div>
                </div>
                <div className="webhook-field">
                  <label>Chiqish secret</label>
                  <div className="webhook-row">
                    <input
                      className="input webhook-input"
                      readOnly
                      value={webhookInfo.outSecret}
                    />
                    <button
                      type="button"
                      className="btn-icon btn-primary"
                      onClick={() => void copyToClipboard(webhookInfo.outSecret, 'Chiqish secret')}
                      title="Nusxalash"
                      aria-label="Nusxalash"
                    >
                      <Icons.Copy />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="webhook-note">
            <div>Webhook endpointlar faqat path ko'rinishida beriladi.</div>
            <div>Port: <strong>{getBackendPortLabel() || 'Noma\'lum'}</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import type { WebhookInfo } from '../../api';
import { Icons } from '../../components/ui/Icons';
import { DeviceListCard } from './DeviceListCard';
import { WebhookInfoCard } from './WebhookInfoCard';

type DevicesPageContentProps = {
  openCreateModal: () => void;
  webhookLoading: boolean;
  webhookInfo: WebhookInfo | null;
  showWebhookAdvanced: boolean;
  setShowWebhookAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
  formatWebhookUrl: (value?: string) => string;
  maskWebhookValue: (value: string, kind: 'url' | 'secret' | 'header') => string;
  copyToClipboard: (value: string, label: string) => Promise<void>;
  getBackendPortLabel: () => string;
  backendDevices: SchoolDeviceInfo[];
  backendLoading: boolean;
  testingId: string | null;
  testStatus: Record<string, 'ok' | 'fail'>;
  loadBackendDevices: () => Promise<void>;
  getCredentialsForBackend: (device: SchoolDeviceInfo) => DeviceConfig | undefined;
  isCredentialsExpired: (device?: DeviceConfig | null) => boolean;
  isBackendOnline: (lastSeenAt?: string | null) => boolean;
  onNavigateDetail: (deviceId: string) => void;
  onTestConnection: (device: SchoolDeviceInfo) => Promise<void>;
  onOpenCredentialsModal: (device: SchoolDeviceInfo) => void;
  onOpenEditModal: (device: SchoolDeviceInfo) => void;
  onOpenCloneModal: (device: SchoolDeviceInfo) => void;
  onOpenDeviceCloneModal: (device: SchoolDeviceInfo) => void;
  onOpenDeleteModal: (device: SchoolDeviceInfo) => void;
};

export function DevicesPageContent({
  openCreateModal,
  webhookLoading,
  webhookInfo,
  showWebhookAdvanced,
  setShowWebhookAdvanced,
  formatWebhookUrl,
  maskWebhookValue,
  copyToClipboard,
  getBackendPortLabel,
  backendDevices,
  backendLoading,
  testingId,
  testStatus,
  loadBackendDevices,
  getCredentialsForBackend,
  isCredentialsExpired,
  isBackendOnline,
  onNavigateDetail,
  onTestConnection,
  onOpenCredentialsModal,
  onOpenEditModal,
  onOpenCloneModal,
  onOpenDeviceCloneModal,
  onOpenDeleteModal,
}: DevicesPageContentProps) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Qurilmalar</h1>
          <p className="page-description">Hikvision qurilmalarini boshqarish</p>
        </div>
        <div className="page-actions">
          <button className="button button-primary" onClick={openCreateModal}>
            <Icons.Plus /> Qurilma qo'shish
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="two-column-layout">
          <WebhookInfoCard
            webhookLoading={webhookLoading}
            webhookInfo={webhookInfo}
            showWebhookAdvanced={showWebhookAdvanced}
            setShowWebhookAdvanced={setShowWebhookAdvanced}
            formatWebhookUrl={formatWebhookUrl}
            maskWebhookValue={maskWebhookValue}
            copyToClipboard={copyToClipboard}
            getBackendPortLabel={getBackendPortLabel}
          />

          <DeviceListCard
            backendDevices={backendDevices}
            backendLoading={backendLoading}
            testingId={testingId}
            testStatus={testStatus}
            loadBackendDevices={loadBackendDevices}
            getCredentialsForBackend={getCredentialsForBackend}
            isCredentialsExpired={isCredentialsExpired}
            isBackendOnline={isBackendOnline}
            onNavigateDetail={onNavigateDetail}
            onTestConnection={onTestConnection}
            onOpenCredentialsModal={onOpenCredentialsModal}
            onOpenEditModal={onOpenEditModal}
            onOpenCloneModal={onOpenCloneModal}
            onOpenDeviceCloneModal={onOpenDeviceCloneModal}
            onOpenDeleteModal={onOpenDeleteModal}
          />
        </div>
      </div>
    </>
  );
}

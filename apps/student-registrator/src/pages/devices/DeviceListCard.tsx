import { Icons } from '../../components/ui/Icons';
import type { DeviceConfig, SchoolDeviceInfo } from '../../types';

type DeviceListCardProps = {
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

export function DeviceListCard({
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
}: DeviceListCardProps) {
  return (
    <div className="card">
      <div className="panel-header">
        <div>
          <div className="panel-title">Qurilmalar ro'yxati</div>
          <div className="panel-subtitle">Tizimdagi qurilmalar ro'yxati</div>
        </div>
        <div className="panel-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={() => void loadBackendDevices()}
            disabled={backendLoading}
            title="Yangilash"
            aria-label="Yangilash"
          >
            <Icons.Refresh />
          </button>
        </div>
      </div>
      {backendDevices.length === 0 ? (
        <div className="empty-state">
          <Icons.Monitor />
          <p>Qurilmalar yo'q</p>
        </div>
      ) : (
        <div className="device-list">
          {backendDevices.map((backend) => {
            const local = getCredentialsForBackend(backend);
            const credentialsExpired = isCredentialsExpired(local);
            const credentialsState = local
              ? credentialsExpired
                ? 'expired'
                : 'ok'
              : 'missing';
            const backendOnline = isBackendOnline(backend.lastSeenAt || undefined);
            const testState = testStatus[backend.id];
            return (
              <div key={backend.id} className="device-item">
                <div className="device-item-header">
                  <strong>{backend.name}</strong>
                  <div className="device-item-meta">
                    {backend.deviceId && <span className="badge">ID: {backend.deviceId}</span>}
                    {backend.type && (
                      <span className="badge">{backend.type === 'ENTRANCE' ? 'Kirish' : 'Chiqish'}</span>
                    )}
                    {backend.location && <span className="badge">{backend.location}</span>}
                    {backend.isActive === false && (
                      <span className="badge badge-warning">Nofaol</span>
                    )}
                    {backend.lastSeenAt && (
                      <span className="badge">
                        Oxirgi: {new Date(backend.lastSeenAt).toLocaleString()}
                      </span>
                    )}
                    <span className={`badge ${backendOnline ? 'badge-success' : 'badge-danger'}`}>
                      {backendOnline ? 'Online' : 'Offline'}
                    </span>
                    {credentialsState === 'ok' && (
                      <span className="badge badge-success">Ulanish sozlangan</span>
                    )}
                    {credentialsState === 'expired' && (
                      <span className="badge badge-warning">Ulanish muddati tugagan</span>
                    )}
                    {credentialsState === 'missing' && (
                      <span className="badge badge-warning">Ulanish sozlanmagan</span>
                    )}
                    {testState === 'ok' && (
                      <span className="badge badge-success">Test: OK</span>
                    )}
                    {testState === 'fail' && (
                      <span className="badge badge-danger">Test: Xato</span>
                    )}
                  </div>
                </div>
                <div className="device-item-actions">
                  <button
                    className="btn-icon"
                    onClick={() => onNavigateDetail(backend.id)}
                    title="Detail"
                    aria-label="Detail"
                  >
                    <Icons.Eye />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => void onTestConnection(backend)}
                    title="Ulanishni tekshirish"
                    aria-label="Ulanishni tekshirish"
                    disabled={testingId === backend.id}
                  >
                    {testingId === backend.id ? <span className="spinner" /> : <Icons.Refresh />}
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => onOpenCredentialsModal(backend)}
                    title="Ulanish sozlamalari"
                    aria-label="Ulanish sozlamalari"
                  >
                    <Icons.Link />
                  </button>
                  <button
                    className="btn-icon btn-primary"
                    onClick={() => onOpenEditModal(backend)}
                    title="Tahrirlash"
                    aria-label="Tahrirlash"
                  >
                    <Icons.Edit />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => onOpenCloneModal(backend)}
                    title="Clone (barcha o'quvchilarni yuklash)"
                    aria-label="Clone (barcha o'quvchilarni yuklash)"
                  >
                    <Icons.Download />
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => onOpenDeviceCloneModal(backend)}
                    title="Clone (qurilmadan qurilmaga)"
                    aria-label="Clone (qurilmadan qurilmaga)"
                  >
                    <Icons.Copy />
                  </button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => onOpenDeleteModal(backend)}
                    title="O'chirish"
                    aria-label="O'chirish"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

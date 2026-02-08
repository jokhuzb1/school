import { Icons } from '../../components/ui/Icons';
import type { DeviceConfig, SchoolDeviceInfo } from '../../api';

type ConfigurationTabProps = {
  schoolDevice: SchoolDeviceInfo;
  localDevice: DeviceConfig | null;
  capabilities: Record<string, unknown> | null;
  configSnapshot: Record<string, unknown> | null;
  timeConfigText: string;
  ntpConfigText: string;
  networkConfigText: string;
  busyAction: string | null;
  onTimeConfigTextChange: (value: string) => void;
  onNtpConfigTextChange: (value: string) => void;
  onNetworkConfigTextChange: (value: string) => void;
  onSaveConfig: (key: 'time' | 'ntpServers' | 'networkInterfaces', text: string) => Promise<void>;
};

export function ConfigurationTab({
  schoolDevice,
  localDevice,
  capabilities,
  configSnapshot,
  timeConfigText,
  ntpConfigText,
  networkConfigText,
  busyAction,
  onTimeConfigTextChange,
  onNtpConfigTextChange,
  onNetworkConfigTextChange,
  onSaveConfig,
}: ConfigurationTabProps) {
  return (
    <div>
      <p><strong>Type:</strong> {schoolDevice.type || '-'}</p>
      <p><strong>Local host:</strong> {localDevice?.host || '-'}</p>
      <p><strong>Local port:</strong> {localDevice?.port || '-'}</p>
      <p className="notice">Capability-driven konfiguratsiya (ISAPI supportga qarab).</p>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="panel-header">
          <div className="panel-title">Capabilities</div>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify((capabilities?.supported as Record<string, unknown>) || {}, null, 2)}
        </pre>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="panel-header">
          <div className="panel-title">Time Config (JSON)</div>
        </div>
        <textarea
          className="input"
          style={{ minHeight: 160, fontFamily: 'monospace' }}
          value={timeConfigText}
          onChange={(e) => onTimeConfigTextChange(e.target.value)}
        />
        <div className="form-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => void onSaveConfig('time', timeConfigText)}
            disabled={busyAction === 'save-config-time'}
          >
            <Icons.Save /> Save Time
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="panel-header">
          <div className="panel-title">NTP Config (JSON)</div>
        </div>
        <textarea
          className="input"
          style={{ minHeight: 160, fontFamily: 'monospace' }}
          value={ntpConfigText}
          onChange={(e) => onNtpConfigTextChange(e.target.value)}
        />
        <div className="form-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => void onSaveConfig('ntpServers', ntpConfigText)}
            disabled={busyAction === 'save-config-ntpServers'}
          >
            <Icons.Save /> Save NTP
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="panel-header">
          <div className="panel-title">Network Config (JSON)</div>
        </div>
        <textarea
          className="input"
          style={{ minHeight: 160, fontFamily: 'monospace' }}
          value={networkConfigText}
          onChange={(e) => onNetworkConfigTextChange(e.target.value)}
        />
        <div className="form-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={() => void onSaveConfig('networkInterfaces', networkConfigText)}
            disabled={busyAction === 'save-config-networkInterfaces'}
          >
            <Icons.Save /> Save Network
          </button>
        </div>
      </div>

      <details style={{ marginTop: 12 }}>
        <summary>Raw snapshot</summary>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          {JSON.stringify(configSnapshot || {}, null, 2)}
        </pre>
      </details>
    </div>
  );
}

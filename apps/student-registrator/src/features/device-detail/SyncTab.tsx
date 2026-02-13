import { Icons } from '../../components/ui/Icons';
import type { SchoolDeviceInfo } from '../../api';

type SyncTabProps = {
  schoolDeviceId?: string;
  allSchoolDevices: SchoolDeviceInfo[];
  sourceCloneId: string;
  busyAction: string | null;
  onSourceCloneChange: (value: string) => void;
  onCloneDbToDevice: () => Promise<void>;
  onCloneDeviceToDevice: () => Promise<void>;
};

export function SyncTab({
  schoolDeviceId,
  allSchoolDevices,
  sourceCloneId,
  busyAction,
  onSourceCloneChange,
  onCloneDbToDevice,
  onCloneDeviceToDevice,
}: SyncTabProps) {
  return (
    <div>
      <p className="notice">Clone operatsiyalari ushbu qurilma kontekstida bajariladi.</p>
      <div className="form-actions">
        <button
          type="button"
          className="button button-primary"
          onClick={() => void onCloneDbToDevice()}
          disabled={busyAction === 'clone-db-device'}
        >
          <Icons.Download /> DB dan shu qurilmaga clone
        </button>
      </div>

      <div className="form-group" style={{ marginTop: 12 }}>
        <label>Manba qurilma (Device to Device clone)</label>
        <select
          className="input"
          value={sourceCloneId}
          onChange={(e) => onSourceCloneChange(e.target.value)}
        >
          <option value="">Tanlang</option>
          {allSchoolDevices
            .filter((item) => item.id !== schoolDeviceId)
            .map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
        </select>
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="button button-secondary"
          onClick={() => void onCloneDeviceToDevice()}
          disabled={busyAction === 'clone-device-device'}
        >
          <Icons.Link /> Manba qurilmadan clone
        </button>
      </div>
    </div>
  );
}

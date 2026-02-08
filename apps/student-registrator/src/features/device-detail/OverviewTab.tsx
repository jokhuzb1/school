import type { SchoolDeviceInfo } from '../../api';

type OverviewTabProps = {
  schoolDevice: SchoolDeviceInfo;
};

export function OverviewTab({ schoolDevice }: OverviewTabProps) {
  return (
    <div>
      <p><strong>Nomi:</strong> {schoolDevice.name}</p>
      <p><strong>Device ID:</strong> {schoolDevice.deviceId || '-'}</p>
      <p><strong>Joylashuv:</strong> {schoolDevice.location || '-'}</p>
      <p><strong>Oxirgi faollik:</strong> {schoolDevice.lastSeenAt ? new Date(schoolDevice.lastSeenAt).toLocaleString() : '-'}</p>
    </div>
  );
}

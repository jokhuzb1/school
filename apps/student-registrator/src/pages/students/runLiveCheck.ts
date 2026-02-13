import { checkStudentOnDevice } from '../../api';
import type { DeviceConfig, SchoolDeviceInfo } from '../../types';
import type { StudentDiagnosticsRow } from '../../types';
import { resolveLocalDeviceForBackend } from '../../utils/deviceResolver';
import type { LiveDeviceResult, LiveStatus, StudentLiveState } from './helpers';

type RunLiveCheckActionParams = {
  row: StudentDiagnosticsRow;
  backendDevices: SchoolDeviceInfo[];
  localDevices: DeviceConfig[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setLiveStateByStudent: (updater: (prev: Record<string, StudentLiveState>) => Record<string, StudentLiveState>) => void;
};

export async function runLiveCheckAction({
  row,
  backendDevices,
  localDevices,
  addToast,
  setLiveStateByStudent,
}: RunLiveCheckActionParams) {
  if (!row.deviceStudentId) {
    addToast("O'quvchida Device ID yo'q", 'error');
    return;
  }

  setLiveStateByStudent((prev) => ({
    ...prev,
    [row.studentId]: {
      running: true,
      byDeviceId: prev[row.studentId]?.byDeviceId || {},
    },
  }));

  const checks = await Promise.all(
    backendDevices.map(async (backendDevice) => {
      const localDevice = resolveLocalDeviceForBackend(backendDevice, localDevices).localDevice;

      if (!localDevice) {
        return { backendDeviceId: backendDevice.id, status: 'NO_CREDENTIALS' as LiveStatus };
      }

      try {
        const result = await checkStudentOnDevice(localDevice.id, row.deviceStudentId || '');
        return {
          backendDeviceId: backendDevice.id,
          status: result.status as LiveStatus,
          message: result.message,
          checkedAt: result.checkedAt,
        };
      } catch (error: unknown) {
        void error;
        return { backendDeviceId: backendDevice.id, status: 'ERROR' as LiveStatus };
      }
    }),
  );

  const byDeviceId: Record<string, LiveDeviceResult> = {};
  checks.forEach((item) => {
    byDeviceId[item.backendDeviceId] = {
      status: item.status,
      message: item.message,
      checkedAt: item.checkedAt,
    };
  });

  setLiveStateByStudent((prev) => ({
    ...prev,
    [row.studentId]: { running: false, byDeviceId },
  }));
}

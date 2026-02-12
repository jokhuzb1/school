import { useEffect } from 'react';
import { fetchUsers, getUserFaceByUrl, type DeviceConfig, type SchoolDeviceInfo } from '../../api';
import type { StudentDiagnosticsRow } from '../../types';
import { resolveLocalDeviceForBackend } from '../../utils/deviceResolver';
import { appLogger } from '../../utils/logger';
import { splitPersonNameWithFather } from '../../utils/name';
import type { DeviceFaceFetchState, DeviceOnlyMeta } from './helpers';

export function useStudentsDeviceDiscovery(params: {
  schoolId: string;
  backendDevices: SchoolDeviceInfo[];
  localDevices: DeviceConfig[];
  filteredDeviceRows: StudentDiagnosticsRow[];
  deviceOnlyMetaByEmployeeNo: Record<string, DeviceOnlyMeta>;
  deviceOnlyFaceFetchStateByEmployeeNo: Record<string, DeviceFaceFetchState>;
  setDeviceDiscoveredRows: (rows: StudentDiagnosticsRow[]) => void;
  setDeviceOnlyMetaByEmployeeNo: (rows: Record<string, DeviceOnlyMeta>) => void;
  setDeviceOnlyFaceByEmployeeNo: (
    updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>),
  ) => void;
  setDeviceOnlyFaceFetchStateByEmployeeNo: (
    updater:
      | Record<string, DeviceFaceFetchState>
      | ((prev: Record<string, DeviceFaceFetchState>) => Record<string, DeviceFaceFetchState>),
  ) => void;
  setDeviceUsersLoading: (next: boolean) => void;
}) {
  const {
    schoolId,
    backendDevices,
    localDevices,
    filteredDeviceRows,
    deviceOnlyMetaByEmployeeNo,
    deviceOnlyFaceFetchStateByEmployeeNo,
    setDeviceDiscoveredRows,
    setDeviceOnlyMetaByEmployeeNo,
    setDeviceOnlyFaceByEmployeeNo,
    setDeviceOnlyFaceFetchStateByEmployeeNo,
    setDeviceUsersLoading,
  } = params;

  useEffect(() => {
    const loadDeviceUsers = async () => {
      if (!schoolId || backendDevices.length === 0 || localDevices.length === 0) {
        setDeviceDiscoveredRows([]);
        setDeviceOnlyMetaByEmployeeNo({});
        setDeviceOnlyFaceByEmployeeNo({});
        setDeviceOnlyFaceFetchStateByEmployeeNo({});
        return;
      }

      setDeviceUsersLoading(true);
      try {
        const byEmployeeNo = new Map<string, StudentDiagnosticsRow>();
        const nextMetaByEmployeeNo: Record<string, DeviceOnlyMeta> = {};

        await Promise.all(
          backendDevices.map(async (backendDevice) => {
            const localDevice = resolveLocalDeviceForBackend(backendDevice, localDevices).localDevice;
            if (!localDevice?.id) return;

            let offset = 0;
            const limit = 100;
            for (;;) {
              const response = await fetchUsers(localDevice.id, { offset, limit });
              const list = response.UserInfoSearch?.UserInfo || [];
              const total = response.UserInfoSearch?.totalMatches || 0;
              if (list.length === 0) break;

              list.forEach((user) => {
                const employeeNo = (user.employeeNo || '').trim();
                if (!employeeNo) return;
                const hasFace = (user.numOfFace || 0) > 0;

                const existing = byEmployeeNo.get(employeeNo);
                if (!existing) {
                  const fullName = (user.name || employeeNo).trim();
                  const nameParts = splitPersonNameWithFather(fullName);
                  nextMetaByEmployeeNo[employeeNo] = {
                    localDeviceId: localDevice.id,
                    hasFace,
                    faceUrl: user.faceURL || undefined,
                  };
                  byEmployeeNo.set(employeeNo, {
                    studentId: `device-only-${employeeNo}`,
                    studentName: fullName,
                    firstName: nameParts.firstName || undefined,
                    lastName: nameParts.lastName || undefined,
                    fatherName: nameParts.fatherName || null,
                    classId: null,
                    className: "Qurilmada (DB yo'q)",
                    deviceStudentId: employeeNo,
                    photoUrl: null,
                    devices: [
                      {
                        deviceId: backendDevice.id,
                        deviceName: backendDevice.name,
                        deviceExternalId: backendDevice.deviceId || null,
                        status: 'SUCCESS',
                        updatedAt: new Date().toISOString(),
                        lastError: null,
                      },
                    ],
                  });
                  return;
                }

                if (!existing.devices.some((item) => item.deviceId === backendDevice.id)) {
                  existing.devices.push({
                    deviceId: backendDevice.id,
                    deviceName: backendDevice.name,
                    deviceExternalId: backendDevice.deviceId || null,
                    status: 'SUCCESS',
                    updatedAt: new Date().toISOString(),
                    lastError: null,
                  });
                }

                const currentMeta = nextMetaByEmployeeNo[employeeNo];
                if (!currentMeta || (!currentMeta.hasFace && hasFace)) {
                  nextMetaByEmployeeNo[employeeNo] = {
                    localDeviceId: localDevice.id,
                    hasFace,
                    faceUrl: user.faceURL || currentMeta?.faceUrl || undefined,
                  };
                }
              });

              offset += list.length;
              if (offset >= total) break;
            }
          }),
        );

        setDeviceDiscoveredRows(Array.from(byEmployeeNo.values()));
        setDeviceOnlyMetaByEmployeeNo(nextMetaByEmployeeNo);
        setDeviceOnlyFaceByEmployeeNo({});
        setDeviceOnlyFaceFetchStateByEmployeeNo({});
      } catch (err: unknown) {
        appLogger.error('Failed to load device-discovered users', err);
        setDeviceDiscoveredRows([]);
        setDeviceOnlyMetaByEmployeeNo({});
        setDeviceOnlyFaceByEmployeeNo({});
        setDeviceOnlyFaceFetchStateByEmployeeNo({});
      } finally {
        setDeviceUsersLoading(false);
      }
    };

    void loadDeviceUsers();
  }, [
    backendDevices,
    localDevices,
    schoolId,
    setDeviceDiscoveredRows,
    setDeviceOnlyFaceByEmployeeNo,
    setDeviceOnlyFaceFetchStateByEmployeeNo,
    setDeviceOnlyMetaByEmployeeNo,
    setDeviceUsersLoading,
  ]);

  useEffect(() => {
    const pending = filteredDeviceRows
      .map((row) => (row.deviceStudentId || '').trim())
      .filter((employeeNo) => {
        if (!employeeNo) return false;
        if (deviceOnlyFaceFetchStateByEmployeeNo[employeeNo]) return false;
        const meta = deviceOnlyMetaByEmployeeNo[employeeNo];
        return Boolean(meta?.localDeviceId && meta.hasFace);
      });

    if (pending.length === 0) return;

    let cancelled = false;
    const run = async () => {
      const queue = [...new Set(pending)];
      setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => {
        const next = { ...prev };
        queue.forEach((employeeNo) => {
          if (!next[employeeNo]) next[employeeNo] = 'loading';
        });
        return next;
      });

      const concurrency = Math.min(2, queue.length);
      let cursor = 0;

      const worker = async () => {
        while (cursor < queue.length) {
          const currentIndex = cursor;
          cursor += 1;
          const employeeNo = queue[currentIndex];
          const meta = deviceOnlyMetaByEmployeeNo[employeeNo];
          if (!meta?.localDeviceId) continue;
          if (!meta.faceUrl) {
            setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: 'failed',
            }));
            continue;
          }
          try {
            const face = await getUserFaceByUrl(meta.localDeviceId, employeeNo, meta.faceUrl);
            if (cancelled) continue;
            if (!face.imageBase64) {
              setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
                ...prev,
                [employeeNo]: 'failed',
              }));
              continue;
            }
            const image = face.imageBase64.startsWith('data:image')
              ? face.imageBase64
              : `data:image/jpeg;base64,${face.imageBase64}`;
            setDeviceOnlyFaceByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: image,
            }));
            setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: 'success',
            }));
          } catch (error: unknown) {
            void error;
            setDeviceOnlyFaceFetchStateByEmployeeNo((prev) => ({
              ...prev,
              [employeeNo]: 'failed',
            }));
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    deviceOnlyFaceFetchStateByEmployeeNo,
    deviceOnlyMetaByEmployeeNo,
    filteredDeviceRows,
    setDeviceOnlyFaceByEmployeeNo,
    setDeviceOnlyFaceFetchStateByEmployeeNo,
  ]);
}

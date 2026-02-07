import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BACKEND_URL,
  cloneDeviceToDevice,
  cloneStudentsToDevice,
  createSchoolStudent,
  deleteUser,
  fetchDevices,
  fetchClasses,
  fetchStudentByDeviceStudentId,
  getDeviceCapabilities,
  getDeviceConfiguration,
  fetchSchoolDevices,
  fetchUsers,
  fileToFaceBase64,
  getDeviceWebhookHealth,
  getAuthUser,
  getUserFace,
  getWebhookInfo,
  recreateUser,
  rotateWebhookSecret,
  testDeviceConnection,
  testWebhookEndpoint,
  updateDeviceConfiguration,
  updateStudentProfile,
  syncStudentToDevices,
  type ClassInfo,
  type DeviceConfig,
  type SchoolDeviceInfo,
  type StudentProfileDetail,
  type UserInfoEntry,
  type WebhookInfo,
} from '../api';
import { Icons } from '../components/ui/Icons';
import { useGlobalToast } from '../hooks/useToast';

type DetailTab = 'overview' | 'configuration' | 'users' | 'webhook' | 'sync';
type ImportRow = {
  employeeNo: string;
  name: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  gender: 'MALE' | 'FEMALE';
  classId: string;
  parentPhone: string;
  hasFace: boolean;
  studentId?: string;
  faceSynced?: boolean;
  status?: 'pending' | 'saved' | 'error';
  error?: string;
};

export function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useGlobalToast();

  const [tab, setTab] = useState<DetailTab>('overview');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [schoolDevice, setSchoolDevice] = useState<SchoolDeviceInfo | null>(null);
  const [localDevice, setLocalDevice] = useState<DeviceConfig | null>(null);
  const [allSchoolDevices, setAllSchoolDevices] = useState<SchoolDeviceInfo[]>([]);
  const [allLocalDevices, setAllLocalDevices] = useState<DeviceConfig[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [users, setUsers] = useState<UserInfoEntry[]>([]);
  const [usersOffset, setUsersOffset] = useState(0);
  const [usersTotal, setUsersTotal] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserInfoEntry | null>(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<StudentProfileDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editFatherName, setEditFatherName] = useState('');
  const [editParentPhone, setEditParentPhone] = useState('');
  const [editClassId, setEditClassId] = useState('');
  const [editGender, setEditGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [editFaceBase64, setEditFaceBase64] = useState<string>('');
  const [editFacePreview, setEditFacePreview] = useState<string>('');
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [importSyncMode, setImportSyncMode] = useState<'none' | 'current' | 'all' | 'selected'>('none');
  const [importSelectedDeviceIds, setImportSelectedDeviceIds] = useState<string[]>([]);
  const [importPullFace, setImportPullFace] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [sourceCloneId, setSourceCloneId] = useState<string>('');
  const [showSecrets, setShowSecrets] = useState(false);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [configSnapshot, setConfigSnapshot] = useState<any>(null);
  const [timeConfigText, setTimeConfigText] = useState('');
  const [ntpConfigText, setNtpConfigText] = useState('');
  const [networkConfigText, setNetworkConfigText] = useState('');
  const [webhookHealth, setWebhookHealth] = useState<{
    lastWebhookEventAt: string | null;
    lastSeenAt: string | null;
  } | null>(null);

  const isOnline = useMemo(() => {
    if (!schoolDevice?.lastSeenAt) return false;
    const last = new Date(schoolDevice.lastSeenAt).getTime();
    if (Number.isNaN(last)) return false;
    return Date.now() - last < 2 * 60 * 60 * 1000;
  }, [schoolDevice?.lastSeenAt]);

  const buildPhotoUrl = (value?: string | null): string => {
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return `${BACKEND_URL}${value.startsWith('/') ? '' : '/'}${value}`;
  };

  const findLocalForBackend = (
    backend: SchoolDeviceInfo,
    localDevices: DeviceConfig[],
  ) => {
    return (
      localDevices.find((item) => item.backendId === backend.id) ||
      (backend.deviceId
        ? localDevices.find(
            (item) =>
              (item.deviceId || '').trim().toLowerCase() ===
              backend.deviceId!.trim().toLowerCase(),
          )
        : null) ||
      null
    );
  };

  const loadDetail = async () => {
    if (!id) return;
    const user = getAuthUser();
    if (!user?.schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }

    setLoading(true);
    try {
      const [backendDevices, localDevices, webhook] = await Promise.all([
        fetchSchoolDevices(user.schoolId),
        fetchDevices(),
        getWebhookInfo(user.schoolId),
      ]);
      setAllSchoolDevices(backendDevices);
      setAllLocalDevices(localDevices);

      const backend = backendDevices.find((item) => item.id === id) || null;
      setSchoolDevice(backend);
      setWebhookInfo(webhook);
      setLocalDevice(backend ? findLocalForBackend(backend, localDevices) : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Qurilma ma\'lumotini yuklab bo\'lmadi';
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async (reset = true) => {
    if (!localDevice?.id) {
      addToast('Local ulanish sozlamasi topilmadi', 'error');
      return;
    }
    setUsersLoading(true);
    try {
      const offset = reset ? 0 : usersOffset;
      const result = await fetchUsers(localDevice.id, { offset, limit: 30 });
      const list = result.UserInfoSearch?.UserInfo || [];
      const total = result.UserInfoSearch?.totalMatches || 0;
      const loaded = offset + list.length;
      setUsers((prev) => (reset ? list : [...prev, ...list]));
      setUsersTotal(total);
      setUsersOffset(loaded);
      setHasMoreUsers(loaded < total);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Qurilma userlarini olishda xato';
      addToast(message, 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  const withBusy = async (key: string, fn: () => Promise<void>) => {
    setBusyAction(key);
    try {
      await fn();
    } finally {
      setBusyAction(null);
    }
  };

  const handleTestConnection = async () => {
    if (!localDevice?.id) {
      addToast('Local ulanish sozlamasi topilmadi', 'error');
      return;
    }
    await withBusy('test-connection', async () => {
      const result = await testDeviceConnection(localDevice.id);
      if (result.ok) {
        addToast('Ulanish muvaffaqiyatli', 'success');
        await loadDetail();
      } else {
        addToast(result.message || 'Ulanish muvaffaqiyatsiz', 'error');
      }
    });
  };

  const handleDeleteUser = async (employeeNo: string) => {
    if (!localDevice?.id) return;
    if (!confirm(`Foydalanuvchini o'chirasizmi? EmployeeNo: ${employeeNo}`)) return;
    await withBusy(`delete-${employeeNo}`, async () => {
      try {
        await deleteUser(localDevice.id, employeeNo);
        addToast('Foydalanuvchi o\'chirildi', 'success');
        await loadUsers(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Delete failed';
        const lower = raw.toLowerCase();
        if (lower.includes('not found')) {
          addToast('Foydalanuvchi topilmadi', 'error');
        } else {
          addToast(raw || 'Foydalanuvchini o\'chirishda xato', 'error');
        }
      }
    });
  };

  const handleRecreateUser = async (user: UserInfoEntry) => {
    if (!localDevice?.id) return;
    await withBusy(`recreate-${user.employeeNo}`, async () => {
      try {
        const result = await recreateUser(
          localDevice.id,
          user.employeeNo,
          user.name,
          (user.gender || 'male').toLowerCase(),
          false,
          true,
        );
        if (result.faceUpload?.ok) {
          addToast(`User recreate qilindi: ${result.employeeNo}`, 'success');
        } else {
          const lower = (result.faceUpload?.errorMsg || '').toLowerCase();
          if (lower.includes('duplicate') || lower.includes('exist')) {
            addToast('Foydalanuvchi allaqachon mavjud', 'error');
          } else {
            addToast(result.faceUpload?.errorMsg || 'Recreate qisman bajarildi', 'error');
          }
        }
        await loadUsers(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Recreate failed';
        const lower = raw.toLowerCase();
        if (lower.includes('not found')) {
          addToast('Foydalanuvchi topilmadi', 'error');
        } else if (lower.includes('upload')) {
          addToast('Face uploadda xato', 'error');
        } else {
          addToast(raw || 'Recreate jarayonida xato', 'error');
        }
      }
    });
  };

  const handleSelectUser = async (user: UserInfoEntry) => {
    setSelectedUser(user);
    setSelectedStudentDetail(null);
    setIsEditingUser(false);
    setEditFaceBase64('');
    setEditFacePreview('');

    const auth = getAuthUser();
    if (!auth?.schoolId || !user.employeeNo) return;

    setDetailLoading(true);
    try {
      const detail = await fetchStudentByDeviceStudentId(auth.schoolId, user.employeeNo);
      setSelectedStudentDetail(detail);
      setEditFirstName(detail.firstName || '');
      setEditLastName(detail.lastName || '');
      setEditFatherName(detail.fatherName || '');
      setEditParentPhone(detail.parentPhone || '');
      setEditClassId(detail.classId || '');
      setEditGender((detail.gender || 'MALE') as 'MALE' | 'FEMALE');
      setEditFacePreview(buildPhotoUrl(detail.photoUrl));
    } catch {
      setSelectedStudentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleFaceFileChange = async (file?: File) => {
    if (!file) return;
    try {
      const base64 = await fileToFaceBase64(file);
      setEditFaceBase64(base64);
      setEditFacePreview(`data:image/jpeg;base64,${base64}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rasmni qayta ishlashda xato';
      addToast(message, 'error');
    }
  };

  const handleSaveUserEdit = async () => {
    if (!selectedUser?.employeeNo || !selectedStudentDetail?.id || !localDevice?.id) {
      addToast('Edit uchun ma\'lumot yetarli emas', 'error');
      return;
    }

    const oldState = {
      firstName: selectedStudentDetail.firstName || '',
      lastName: selectedStudentDetail.lastName || '',
      fatherName: selectedStudentDetail.fatherName || '',
      parentPhone: selectedStudentDetail.parentPhone || '',
      classId: selectedStudentDetail.classId || '',
      gender: selectedStudentDetail.gender || 'MALE',
      photoUrl: selectedStudentDetail.photoUrl || '',
    };

    const fullName = `${editLastName} ${editFirstName}`.trim();
    await withBusy(`save-edit-${selectedUser.employeeNo}`, async () => {
      try {
        await updateStudentProfile(selectedStudentDetail.id, {
          firstName: editFirstName,
          lastName: editLastName,
          fatherName: editFatherName || undefined,
          parentPhone: editParentPhone || undefined,
          classId: editClassId || undefined,
          gender: editGender,
          deviceStudentId: selectedUser.employeeNo,
          faceImageBase64: editFaceBase64 || undefined,
        });

        const recreate = await recreateUser(
          localDevice.id,
          selectedUser.employeeNo,
          fullName,
          editGender.toLowerCase(),
          false,
          !editFaceBase64,
          editFaceBase64 || undefined,
        );

        if (!recreate.faceUpload?.ok) {
          throw new Error(recreate.faceUpload?.errorMsg || 'Device edit failed');
        }

        addToast('DB + Device edit muvaffaqiyatli', 'success');
        setIsEditingUser(false);
        await Promise.all([loadUsers(true), handleSelectUser({ ...selectedUser, name: fullName })]);
      } catch (err) {
        await updateStudentProfile(selectedStudentDetail.id, {
          firstName: oldState.firstName,
          lastName: oldState.lastName,
          fatherName: oldState.fatherName || undefined,
          parentPhone: oldState.parentPhone || undefined,
          classId: oldState.classId || undefined,
          gender: oldState.gender as 'MALE' | 'FEMALE',
          deviceStudentId: selectedUser.employeeNo,
        }).catch(() => undefined);
        const message = err instanceof Error ? err.message : 'Edit jarayonida xato';
        addToast(`Edit rollback: ${message}`, 'error');
      }
    });
  };

  const handleRotateSecret = async (direction: 'in' | 'out') => {
    const auth = getAuthUser();
    if (!auth?.schoolId) return;
    if (!confirm(`${direction.toUpperCase()} webhook secretni yangilaysizmi?`)) return;
    await withBusy(`rotate-${direction}`, async () => {
      const result = await rotateWebhookSecret(auth.schoolId!, direction);
      setWebhookInfo(result.info);
      addToast(`Webhook secret yangilandi (${direction})`, 'success');
    });
  };

  const handleTestWebhook = async (direction: 'in' | 'out') => {
    const auth = getAuthUser();
    if (!auth?.schoolId) return;
    await withBusy(`test-webhook-${direction}`, async () => {
      const result = await testWebhookEndpoint(auth.schoolId!, direction);
      addToast(`Webhook test tayyor: ${result.path}`, 'success');
      if (schoolDevice?.id) {
        const health = await getDeviceWebhookHealth(schoolDevice.id);
        setWebhookHealth({
          lastWebhookEventAt: health.lastWebhookEventAt,
          lastSeenAt: health.lastSeenAt,
        });
      }
    });
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(`${label} nusxalandi`, 'success');
    } catch {
      addToast('Nusxalashda xato', 'error');
    }
  };

  const saveConfig = async (
    key: 'time' | 'ntpServers' | 'networkInterfaces',
    text: string,
  ) => {
    if (!localDevice?.id) return;
    await withBusy(`save-config-${key}`, async () => {
      try {
        const payload = JSON.parse(text);
        await updateDeviceConfiguration({
          deviceId: localDevice.id,
          configType: key,
          payload,
        });
        addToast(`${key} sozlamasi saqlandi`, 'success');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Config save xato';
        addToast(message, 'error');
      }
    });
  };

  const handleCloneDbToDevice = async () => {
    if (!schoolDevice?.id) return;
    await withBusy('clone-db-device', async () => {
      const result = await cloneStudentsToDevice({ backendDeviceId: schoolDevice.id });
      addToast(
        `Clone yakunlandi: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`,
        result.failed > 0 ? 'error' : 'success',
      );
    });
  };

  const handleCloneDeviceToDevice = async () => {
    if (!sourceCloneId || !localDevice?.id) {
      addToast('Manba qurilmani tanlang', 'error');
      return;
    }
    const sourceBackend = allSchoolDevices.find((d) => d.id === sourceCloneId);
    if (!sourceBackend) {
      addToast('Manba qurilma topilmadi', 'error');
      return;
    }
    const sourceLocal = findLocalForBackend(sourceBackend, allLocalDevices);
    if (!sourceLocal?.id) {
      addToast('Manba qurilmaning local ulanish sozlamasi topilmadi', 'error');
      return;
    }
    await withBusy('clone-device-device', async () => {
      const result = await cloneDeviceToDevice({
        sourceDeviceId: sourceLocal.id,
        targetDeviceId: localDevice.id,
      });
      addToast(
        `Clone yakunlandi: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`,
        result.failed > 0 ? 'error' : 'success',
      );
    });
  };

  const splitName = (value: string): { firstName: string; lastName: string } => {
    const cleaned = (value || '').trim();
    if (!cleaned) return { firstName: '', lastName: '' };
    const parts = cleaned.split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
  };

  const openImportWizard = async () => {
    const auth = getAuthUser();
    if (!auth?.schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }
    if (users.length === 0) {
      addToast('Import uchun avval qurilmadan userlarni yuklang', 'error');
      return;
    }

    try {
      const classes = await fetchClasses(auth.schoolId);
      setAvailableClasses(classes);
      setImportRows(
        users.map((u) => {
          const nameParts = splitName(u.name || '');
          return {
            employeeNo: u.employeeNo || '',
            name: u.name || '',
            firstName: nameParts.firstName,
            lastName: nameParts.lastName,
            fatherName: '',
            gender: (String(u.gender || '').toLowerCase().startsWith('f') ? 'FEMALE' : 'MALE'),
            classId: '',
            parentPhone: '',
            hasFace: (u.numOfFace || 0) > 0,
            status: 'pending',
          };
        }),
      );
      setImportSyncMode('none');
      setImportSelectedDeviceIds(schoolDevice?.id ? [schoolDevice.id] : []);
      setImportPullFace(true);
      setIsImportOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import wizard ochishda xato';
      addToast(message, 'error');
    }
  };

  const updateImportRow = (idx: number, patch: Partial<ImportRow>) => {
    setImportRows((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const resolveImportTargetDeviceIds = (): string[] => {
    if (importSyncMode === 'none') return [];
    if (importSyncMode === 'current') return schoolDevice?.id ? [schoolDevice.id] : [];
    if (importSyncMode === 'all') return allSchoolDevices.map((d) => d.id);
    return importSelectedDeviceIds;
  };

  const saveImportRows = async () => {
    const auth = getAuthUser();
    if (!auth?.schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }
    const invalidIndexes = importRows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => !r.employeeNo || !r.firstName || !r.lastName || !r.classId);
    if (invalidIndexes.length > 0) {
      addToast(`Majburiy maydonlar to'ldirilmagan qatorlar: ${invalidIndexes.length}`, 'error');
      return;
    }
    if (importSyncMode === 'selected' && importSelectedDeviceIds.length === 0) {
      addToast('Sync mode selected uchun kamida 1 ta qurilma tanlang', 'error');
      return;
    }

    setImportLoading(true);
    let success = 0;
    let failed = 0;
    let synced = 0;
    const nextRows = [...importRows];
    const targetDeviceIds = resolveImportTargetDeviceIds();

    try {
      for (let i = 0; i < nextRows.length; i++) {
        const row = nextRows[i];
        try {
          let existing: StudentProfileDetail | null = null;
          try {
            existing = await fetchStudentByDeviceStudentId(auth.schoolId, row.employeeNo);
          } catch {
            existing = null;
          }

          let studentId = existing?.id || '';
          let faceImageBase64: string | undefined;
          if (importPullFace && row.hasFace && localDevice?.id) {
            try {
              const face = await getUserFace(localDevice.id, row.employeeNo);
              faceImageBase64 = face.imageBase64;
            } catch {
              // face sync is optional for import flow
            }
          }

          if (existing?.id) {
            await updateStudentProfile(existing.id, {
              firstName: row.firstName,
              lastName: row.lastName,
              fatherName: row.fatherName || undefined,
              classId: row.classId,
              parentPhone: row.parentPhone || undefined,
              gender: row.gender,
              deviceStudentId: row.employeeNo,
              faceImageBase64,
            });
            studentId = existing.id;
          } else {
            const created = await createSchoolStudent(auth.schoolId, {
              firstName: row.firstName,
              lastName: row.lastName,
              fatherName: row.fatherName || undefined,
              classId: row.classId,
              parentPhone: row.parentPhone || undefined,
              gender: row.gender,
              deviceStudentId: row.employeeNo,
            });
            studentId = created.id;
            if (faceImageBase64) {
              await updateStudentProfile(created.id, {
                faceImageBase64,
                classId: row.classId,
                firstName: row.firstName,
                lastName: row.lastName,
                fatherName: row.fatherName || undefined,
                parentPhone: row.parentPhone || undefined,
                gender: row.gender,
                deviceStudentId: row.employeeNo,
              });
            }
          }

          if (studentId && targetDeviceIds.length > 0) {
            const ok = await syncStudentToDevices(studentId, targetDeviceIds);
            if (ok) synced += 1;
          }

          nextRows[i] = {
            ...row,
            studentId,
            faceSynced: Boolean(faceImageBase64),
            status: 'saved',
            error: undefined,
          };
          success += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Saqlashda xato';
          nextRows[i] = { ...row, status: 'error', error: msg };
          failed += 1;
        }
      }

      setImportRows(nextRows);
      addToast(
        `Import yakunlandi: ${success} success, ${failed} failed, ${synced} sync`,
        failed > 0 ? 'error' : 'success',
      );
      if (success > 0) {
        await loadUsers(true);
      }
    } finally {
      setImportLoading(false);
    }
  };

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === 'users') {
      setSelectedUser(null);
      setSelectedStudentDetail(null);
      setIsEditingUser(false);
      loadUsers(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, localDevice?.id]);

  useEffect(() => {
    const loadHealth = async () => {
      if (tab !== 'webhook' || !schoolDevice?.id) return;
      try {
        const health = await getDeviceWebhookHealth(schoolDevice.id);
        setWebhookHealth({
          lastWebhookEventAt: health.lastWebhookEventAt,
          lastSeenAt: health.lastSeenAt,
        });
      } catch {
        setWebhookHealth(null);
      }
    };
    loadHealth();
  }, [tab, schoolDevice?.id]);

  useEffect(() => {
    const loadConfigData = async () => {
      if (tab !== 'configuration' || !localDevice?.id) return;
      try {
        const [caps, config] = await Promise.all([
          getDeviceCapabilities(localDevice.id),
          getDeviceConfiguration(localDevice.id),
        ]);
        setCapabilities(caps);
        setConfigSnapshot(config);
        setTimeConfigText(JSON.stringify(config?.time || {}, null, 2));
        setNtpConfigText(JSON.stringify(config?.ntpServers || {}, null, 2));
        setNetworkConfigText(JSON.stringify(config?.networkInterfaces || {}, null, 2));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Configuration yuklashda xato';
        addToast(message, 'error');
      }
    };
    loadConfigData();
  }, [tab, localDevice?.id, addToast]);

  if (loading) {
    return (
      <div className="page">
        <p className="notice">Yuklanmoqda...</p>
      </div>
    );
  }

  if (!schoolDevice) {
    return (
      <div className="page">
        <p className="notice notice-warning">Qurilma topilmadi</p>
        <button type="button" className="button button-secondary" onClick={() => navigate('/devices')}>
          <Icons.ChevronLeft /> Ortga
        </button>
      </div>
    );
  }

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'overview', label: 'Overview' },
    { key: 'configuration', label: 'Config' },
    { key: 'users', label: 'Users' },
    { key: 'webhook', label: 'Webhook' },
    { key: 'sync', label: 'Sync' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button type="button" className="button button-secondary" onClick={() => navigate('/devices')}>
            <Icons.ChevronLeft /> Qurilmalar ro'yxati
          </button>
          <h1 className="page-title" style={{ marginTop: 12 }}>{schoolDevice.name}</h1>
          <p className="page-description">Qurilma detail boshqaruvi</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleTestConnection}
            disabled={busyAction === 'test-connection'}
          >
            <Icons.Refresh /> Ulanishni tekshirish
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="device-item-meta">
          <span className="badge">ID: {schoolDevice.deviceId || '-'}</span>
          <span className="badge">{schoolDevice.type || '-'}</span>
          <span className={`badge ${isOnline ? 'badge-success' : 'badge-danger'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {localDevice ? <span className="badge badge-success">Local ulanish bor</span> : <span className="badge badge-warning">Local ulanish yo'q</span>}
        </div>
      </div>

      <div className="card">
        <div className="panel-header">
          <div className="panel-title">Bo'limlar</div>
          <div className="panel-actions" style={{ gap: 8 }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`button ${tab === t.key ? 'button-primary' : 'button-secondary'}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'overview' && (
          <div>
            <p><strong>Nomi:</strong> {schoolDevice.name}</p>
            <p><strong>Device ID:</strong> {schoolDevice.deviceId || '-'}</p>
            <p><strong>Joylashuv:</strong> {schoolDevice.location || '-'}</p>
            <p><strong>Oxirgi faollik:</strong> {schoolDevice.lastSeenAt ? new Date(schoolDevice.lastSeenAt).toLocaleString() : '-'}</p>
          </div>
        )}

        {tab === 'configuration' && (
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
                {JSON.stringify(capabilities?.supported || {}, null, 2)}
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
                onChange={(e) => setTimeConfigText(e.target.value)}
              />
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => saveConfig('time', timeConfigText)}
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
                onChange={(e) => setNtpConfigText(e.target.value)}
              />
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => saveConfig('ntpServers', ntpConfigText)}
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
                onChange={(e) => setNetworkConfigText(e.target.value)}
              />
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => saveConfig('networkInterfaces', networkConfigText)}
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
        )}

        {tab === 'users' && (
          <div>
            <p className="notice">
              Minimal ro'yxat: {usersOffset}/{usersTotal || users.length} yuklandi. Detail ma'lumot row bosilganda olinadi.
            </p>
            <div className="form-actions" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={openImportWizard}
                disabled={usersLoading || users.length === 0}
              >
                <Icons.Download /> Device usersni DB ga import qilish
              </button>
            </div>
            {usersLoading && <p className="notice">Userlar yuklanmoqda...</p>}
            {!usersLoading && users.length === 0 && <p className="notice">User topilmadi</p>}
            {!usersLoading && users.length > 0 && (
              <div className="device-list">
                {users.map((user) => (
                  <div className="device-item" key={`${user.employeeNo}-${user.name}`}>
                    <div className="device-item-header">
                      <strong>{user.name}</strong>
                      <div className="device-item-meta">
                        <span className="badge">EmployeeNo: {user.employeeNo}</span>
                        <span className="badge">Gender: {user.gender || '-'}</span>
                        <span className={`badge ${(user.numOfFace || 0) > 0 ? 'badge-success' : 'badge-warning'}`}>
                          {(user.numOfFace || 0) > 0 ? 'Rasm bor' : 'Rasm yo\'q'}
                        </span>
                      </div>
                    </div>
                    <div className="device-item-actions">
                      <button
                        className="btn-icon"
                        title="Detail"
                        onClick={() => handleSelectUser(user)}
                      >
                        <Icons.Eye />
                      </button>
                      <button
                        className="btn-icon"
                        title="Recreate"
                        onClick={() => handleRecreateUser(user)}
                        disabled={busyAction === `recreate-${user.employeeNo}`}
                      >
                        <Icons.Refresh />
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        title="Delete"
                        onClick={() => handleDeleteUser(user.employeeNo)}
                        disabled={busyAction === `delete-${user.employeeNo}`}
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="form-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => loadUsers(false)}
                disabled={usersLoading || !hasMoreUsers}
              >
                <Icons.ChevronDown /> {hasMoreUsers ? 'Yana yuklash' : 'Hammasi yuklandi'}
              </button>
            </div>
            {selectedUser && (
              <div className="card" style={{ marginTop: 12 }}>
                <div className="panel-header">
                  <div className="panel-title">User detail</div>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => {
                      setSelectedUser(null);
                      setSelectedStudentDetail(null);
                      setIsEditingUser(false);
                    }}
                  >
                    <Icons.X />
                  </button>
                </div>
                <p><strong>Ism:</strong> {selectedUser.name}</p>
                <p><strong>EmployeeNo:</strong> {selectedUser.employeeNo}</p>
                <p><strong>Gender:</strong> {selectedUser.gender || '-'}</p>
                <p><strong>Face count:</strong> {selectedUser.numOfFace ?? '-'}</p>
                {detailLoading && <p className="notice">DB detail yuklanmoqda...</p>}
                {!detailLoading && !selectedStudentDetail && (
                  <p className="notice notice-warning">DB da mos o'quvchi topilmadi (device-only user).</p>
                )}
                <div className="form-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setIsEditingUser((prev) => !prev)}
                    disabled={!selectedStudentDetail}
                    title={!selectedStudentDetail ? "Avval user DB bilan bog'langan bo'lishi kerak" : ''}
                  >
                    <Icons.Edit /> {isEditingUser ? 'Editni yopish' : 'DB + Device Edit'}
                  </button>
                </div>
                {!detailLoading && selectedStudentDetail && (
                  <>
                    <p><strong>DB Student ID:</strong> {selectedStudentDetail.id}</p>
                    <p><strong>Sinf:</strong> {selectedStudentDetail.class?.name || '-'}</p>
                    <p><strong>Telefon:</strong> {selectedStudentDetail.parentPhone || '-'}</p>
                    {selectedStudentDetail.photoUrl && !editFacePreview && (
                      <img src={buildPhotoUrl(selectedStudentDetail.photoUrl)} alt="student" className="student-avatar" />
                    )}
                    {editFacePreview && (
                      <img src={editFacePreview} alt="student preview" className="student-avatar" />
                    )}
                  </>
                )}
                {isEditingUser && selectedStudentDetail && (
                  <div style={{ marginTop: 12 }}>
                    <div className="form-group">
                      <label>Familiya</label>
                      <input className="input" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Ism</label>
                      <input className="input" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Otasining ismi</label>
                      <input className="input" value={editFatherName} onChange={(e) => setEditFatherName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Telefon</label>
                      <input className="input" value={editParentPhone} onChange={(e) => setEditParentPhone(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Class ID</label>
                      <input className="input" value={editClassId} onChange={(e) => setEditClassId(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Jins</label>
                      <select
                        className="input"
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value as 'MALE' | 'FEMALE')}
                      >
                        <option value="MALE">MALE</option>
                        <option value="FEMALE">FEMALE</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Yangi rasm (ixtiyoriy)</label>
                      <input
                        className="input"
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={(e) => handleFaceFileChange(e.target.files?.[0])}
                      />
                    </div>
                    <div className="form-actions">
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={handleSaveUserEdit}
                        disabled={busyAction === `save-edit-${selectedUser.employeeNo}`}
                      >
                        <Icons.Save /> Saqlash (DB + Device)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'webhook' && (
          <div>
            {!webhookInfo && <p className="notice notice-warning">Webhook ma'lumotlari yo'q</p>}
            {webhookInfo && (
              <div className="device-list">
                <div className="device-item">
                  <div className="device-item-header">
                    <strong>Webhook health</strong>
                    <div className="device-item-meta">
                      <span className="badge">
                        Last event: {webhookHealth?.lastWebhookEventAt ? new Date(webhookHealth.lastWebhookEventAt).toLocaleString() : '-'}
                      </span>
                      <span className="badge">
                        Last seen: {webhookHealth?.lastSeenAt ? new Date(webhookHealth.lastSeenAt).toLocaleString() : '-'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="form-actions" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setShowSecrets((prev) => !prev)}
                  >
                    {showSecrets ? 'Secretlarni yashirish' : 'Secretlarni ko\'rsatish'}
                  </button>
                </div>
                <div className="device-item">
                  <div className="device-item-header">
                    <strong>Kirish webhook</strong>
                    <div className="device-item-meta">
                      <span className="badge">
                        {showSecrets
                          ? webhookInfo.inUrlWithSecret
                          : webhookInfo.inUrlWithSecret.replace(/secret=[^&]+/i, 'secret=***')}
                      </span>
                    </div>
                  </div>
                  <div className="device-item-actions">
                    <button className="btn-icon" onClick={() => copyToClipboard(webhookInfo.inUrlWithSecret, 'Kirish webhook')}>
                      <Icons.Copy />
                    </button>
                    <button className="btn-icon" onClick={() => handleTestWebhook('in')} disabled={busyAction === 'test-webhook-in'}>
                      <Icons.Refresh />
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => handleRotateSecret('in')} disabled={busyAction === 'rotate-in'}>
                      <Icons.Edit />
                    </button>
                  </div>
                </div>

                <div className="device-item">
                  <div className="device-item-header">
                    <strong>Chiqish webhook</strong>
                    <div className="device-item-meta">
                      <span className="badge">
                        {showSecrets
                          ? webhookInfo.outUrlWithSecret
                          : webhookInfo.outUrlWithSecret.replace(/secret=[^&]+/i, 'secret=***')}
                      </span>
                    </div>
                  </div>
                  <div className="device-item-actions">
                    <button className="btn-icon" onClick={() => copyToClipboard(webhookInfo.outUrlWithSecret, 'Chiqish webhook')}>
                      <Icons.Copy />
                    </button>
                    <button className="btn-icon" onClick={() => handleTestWebhook('out')} disabled={busyAction === 'test-webhook-out'}>
                      <Icons.Refresh />
                    </button>
                    <button className="btn-icon btn-danger" onClick={() => handleRotateSecret('out')} disabled={busyAction === 'rotate-out'}>
                      <Icons.Edit />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'sync' && (
          <div>
            <p className="notice">Clone operatsiyalari ushbu qurilma kontekstida bajariladi.</p>
            <div className="form-actions">
              <button
                type="button"
                className="button button-primary"
                onClick={handleCloneDbToDevice}
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
                onChange={(e) => setSourceCloneId(e.target.value)}
              >
                <option value="">Tanlang</option>
                {allSchoolDevices
                  .filter((d) => d.id !== schoolDevice.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
              </select>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={handleCloneDeviceToDevice}
                disabled={busyAction === 'clone-device-device'}
              >
                <Icons.Link /> Manba qurilmadan clone
              </button>
            </div>
          </div>
        )}
      </div>

      {isImportOpen && (
        <div className="modal-overlay" onClick={() => setIsImportOpen(false)}>
          <div className="modal modal-provisioning" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h3>Device Users Import (DB)</h3>
                <p className="text-secondary text-xs">Qolgan maydonlarni to'ldirib, batch saqlang.</p>
              </div>
              <button className="modal-close" onClick={() => setIsImportOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <div className="notice">EmployeeNo, ism/familiya, sinf majburiy.</div>
              <div className="form-group" style={{ marginTop: 10 }}>
                <label>Saqlash siyosati (Sync mode)</label>
                <select
                  className="input"
                  value={importSyncMode}
                  onChange={(e) => setImportSyncMode(e.target.value as 'none' | 'current' | 'all' | 'selected')}
                >
                  <option value="none">Faqat DB</option>
                  <option value="current">DB + joriy qurilma</option>
                  <option value="all">DB + barcha active qurilmalar</option>
                  <option value="selected">DB + tanlangan qurilmalar</option>
                </select>
              </div>
              {importSyncMode === 'selected' && (
                <div className="card" style={{ marginBottom: 10 }}>
                  <div className="panel-header">
                    <div className="panel-title">Target qurilmalar</div>
                  </div>
                  <div className="device-list">
                    {allSchoolDevices.map((d) => {
                      const checked = importSelectedDeviceIds.includes(d.id);
                      return (
                        <label key={d.id} className="device-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setImportSelectedDeviceIds((prev) =>
                                checked ? prev.filter((id) => id !== d.id) : [...prev, d.id],
                              )
                            }
                          />
                          <span>{d.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
              <label className="checkbox" style={{ marginBottom: 8 }}>
                <input
                  type="checkbox"
                  checked={importPullFace}
                  onChange={(e) => setImportPullFace(e.target.checked)}
                />
                <span>Qurilmadagi mavjud rasmni ham olib `photoUrl`ga sync qilish</span>
              </label>
              <div style={{ maxHeight: 420, overflow: 'auto', marginTop: 8 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>EmployeeNo</th>
                      <th>Ism</th>
                      <th>Familiya</th>
                      <th>Otasining ismi</th>
                      <th>Sinf</th>
                      <th>Jins</th>
                      <th>Face</th>
                      <th>Holat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row, idx) => (
                      <tr key={`${row.employeeNo}-${idx}`}>
                        <td>{row.employeeNo}</td>
                        <td>
                          <input className="input" value={row.firstName} onChange={(e) => updateImportRow(idx, { firstName: e.target.value })} />
                        </td>
                        <td>
                          <input className="input" value={row.lastName} onChange={(e) => updateImportRow(idx, { lastName: e.target.value })} />
                        </td>
                        <td>
                          <input className="input" value={row.fatherName} onChange={(e) => updateImportRow(idx, { fatherName: e.target.value })} />
                        </td>
                        <td>
                          <select className="input" value={row.classId} onChange={(e) => updateImportRow(idx, { classId: e.target.value })}>
                            <option value="">Tanlang</option>
                            {availableClasses.map((cls) => (
                              <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select className="input" value={row.gender} onChange={(e) => updateImportRow(idx, { gender: e.target.value as 'MALE' | 'FEMALE' })}>
                            <option value="MALE">MALE</option>
                            <option value="FEMALE">FEMALE</option>
                          </select>
                        </td>
                        <td>
                          <span className={`badge ${row.hasFace ? 'badge-success' : 'badge-warning'}`}>
                            {row.hasFace ? 'Bor' : "Yo'q"}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${
                            row.status === 'saved'
                              ? 'badge-success'
                              : row.status === 'error'
                              ? 'badge-danger'
                              : ''
                          }`}>
                            {row.status || 'pending'}
                          </span>
                          {row.error && <div className="text-xs text-danger">{row.error}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button button-primary"
                onClick={saveImportRows}
                disabled={importLoading || importRows.length === 0}
              >
                <Icons.Save /> {importLoading ? 'Saqlanmoqda...' : 'DB ga saqlash'}
              </button>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setIsImportOpen(false)}
                disabled={importLoading}
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

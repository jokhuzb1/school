import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  BACKEND_URL,
  cloneDeviceToDevice,
  cloneStudentsToDevice,
  commitDeviceImport,
  createImportAuditLog,
  deleteUser,
  fetchDevices,
  fetchClasses,
  getImportJob,
  getImportMetrics,
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
  previewDeviceImport,
  recreateUser,
  retryImportJob,
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
  faceError?: string;
  syncResults?: Array<{
    backendDeviceId: string;
    deviceName?: string;
    status: string;
    lastError?: string | null;
  }>;
  status?: 'pending' | 'saved' | 'error';
  error?: string;
};

type ImportJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

type ImportJob = {
  id: string;
  status: ImportJobStatus;
  retryCount: number;
  startedAt: string;
  finishedAt?: string;
  lastError?: string;
  processed: number;
  success: number;
  failed: number;
  synced: number;
};

type ImportPreview = {
  total: number;
  createCount: number;
  updateCount: number;
  skipCount: number;
  invalidCount: number;
  duplicateCount: number;
  classErrorCount: number;
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
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [importAuditTrail, setImportAuditTrail] = useState<Array<{ at: string; stage: string; message: string }>>([]);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMetrics, setImportMetrics] = useState<{
    totalRuns: number;
    totalSuccess: number;
    totalFailed: number;
    totalSynced: number;
    successRate: number;
    retryRate: number;
    meanLatencyMs: number;
  } | null>(null);
  const importIdempotencyRef = useRef<string | null>(null);
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
      const nextRows = users.map((u) => {
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
        } as ImportRow;
      });
      setImportRows(nextRows);
      setImportSyncMode('none');
      setImportSelectedDeviceIds(schoolDevice?.id ? [schoolDevice.id] : []);
      setImportPullFace(true);
      setImportJob(null);
      setImportAuditTrail([]);
      setImportPreview(null);
      setIsImportOpen(true);
      await Promise.all([refreshImportPreview(nextRows), loadImportMetrics()]);
      await pushImportAudit('DEVICE_IMPORT_WIZARD_OPEN', 'Import wizard opened', {
        users: users.length,
        sourceDeviceId: schoolDevice?.id || null,
      });
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

  const getImportDeviceStatus = (device: SchoolDeviceInfo): 'online' | 'offline' | 'no_credentials' => {
    const local = findLocalForBackend(device, allLocalDevices);
    if (!local?.id) return 'no_credentials';
    if (!device.lastSeenAt) return 'offline';
    const lastSeen = new Date(device.lastSeenAt).getTime();
    if (Number.isNaN(lastSeen)) return 'offline';
    return Date.now() - lastSeen < 2 * 60 * 60 * 1000 ? 'online' : 'offline';
  };

  const previewStats = useMemo(() => {
    const total = importRows.length;
    const invalid = importRows.filter((r) => !r.employeeNo || !r.firstName || !r.lastName || !r.classId).length;
    const done = importRows.filter((r) => r.status === 'saved').length;
    const failed = importRows.filter((r) => r.status === 'error').length;
    const pending = total - done - failed;
    return { total, invalid, done, failed, pending };
  }, [importRows]);

  const validateImportRows = (): { ok: boolean; rows: ImportRow[]; errors: number } => {
    const seen = new Set<string>();
    const classSet = new Set(availableClasses.map((c) => c.id));
    let errors = 0;
    const next = importRows.map((row) => {
      let error = '';
      const key = `${row.employeeNo}`.trim();
      if (!row.employeeNo || !row.firstName || !row.lastName || !row.classId) {
        error = 'Majburiy maydonlar to\'liq emas';
      } else if (seen.has(key)) {
        error = 'Duplicate employeeNo import ichida';
      } else if (!classSet.has(row.classId)) {
        error = 'Class topilmadi';
      }
      seen.add(key);
      if (error) errors += 1;
      return { ...row, error: error || row.error };
    });
    return { ok: errors === 0, rows: next, errors };
  };

  const pushImportAudit = async (
    stage: string,
    message: string,
    payload?: Record<string, unknown>,
  ) => {
    const auth = getAuthUser();
    const at = new Date().toISOString();
    setImportAuditTrail((prev) => [...prev, { at, stage, message }]);
    if (!auth?.schoolId) return;
    try {
      await createImportAuditLog(auth.schoolId, {
        stage,
        status: 'INFO',
        message,
        payload,
      });
    } catch {
      // best-effort audit
    }
  };

  const loadImportMetrics = async () => {
    const auth = getAuthUser();
    if (!auth?.schoolId) return;
    try {
      const metrics = await getImportMetrics(auth.schoolId);
      setImportMetrics(metrics);
    } catch {
      setImportMetrics(null);
    }
  };

  const refreshImportPreview = async (rowsOverride?: ImportRow[]) => {
    const auth = getAuthUser();
    if (!auth?.schoolId) return;
    const baseRows = rowsOverride || importRows;
    try {
      const preview = await previewDeviceImport(
        auth.schoolId,
        baseRows.map((row) => ({
          employeeNo: row.employeeNo,
          firstName: row.firstName,
          lastName: row.lastName,
          fatherName: row.fatherName || undefined,
          classId: row.classId,
          parentPhone: row.parentPhone || undefined,
          gender: row.gender,
        })),
      );
      setImportPreview({
        total: preview.total,
        createCount: preview.createCount,
        updateCount: preview.updateCount,
        skipCount: preview.skipCount,
        invalidCount: preview.invalidCount,
        duplicateCount: preview.duplicateCount,
        classErrorCount: preview.classErrorCount,
      });
    } catch {
      setImportPreview(null);
    }
  };

  const processImportRows = async (targetIndexes?: number[], retryOnly = false) => {
    const auth = getAuthUser();
    if (!auth?.schoolId) {
      addToast('Maktab topilmadi', 'error');
      return;
    }
    if (importLoading) {
      addToast('Import jarayoni allaqachon ishlayapti', 'error');
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

    const queue = (targetIndexes && targetIndexes.length > 0)
      ? targetIndexes
      : importRows.map((_, idx) => idx);
    const validation = validateImportRows();
    setImportRows(validation.rows);
    const invalidInQueue = queue.some((idx) => Boolean(validation.rows[idx]?.error));
    if ((!retryOnly && !validation.ok) || invalidInQueue) {
      addToast(`Validation xatolari: ${validation.errors}`, 'error');
      return;
    }

    if (retryOnly && importJob?.id) {
      await retryImportJob(auth.schoolId, importJob.id).catch(() => undefined);
    }

    const commitRows = queue
      .map((idx) => validation.rows[idx])
      .filter(Boolean)
      .map((row) => ({
        employeeNo: row.employeeNo,
        firstName: row.firstName,
        lastName: row.lastName,
        fatherName: row.fatherName || undefined,
        classId: row.classId,
        parentPhone: row.parentPhone || undefined,
        gender: row.gender,
      }));
    const targetDeviceIds = resolveImportTargetDeviceIds();
    const idempotencyKey = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    importIdempotencyRef.current = idempotencyKey;

    setImportLoading(true);
    const startedAt = new Date().toISOString();
    setImportJob({
      id: idempotencyKey,
      status: 'PROCESSING',
      retryCount: retryOnly ? (importJob?.retryCount || 0) + 1 : 0,
      startedAt,
      processed: 0,
      success: 0,
      failed: 0,
      synced: 0,
    });
    await pushImportAudit('DEVICE_IMPORT_START', 'Import started', {
      idempotencyKey,
      syncMode: importSyncMode,
      targetDeviceIds,
      pullFace: importPullFace,
      retryOnly,
      targetIndexes: targetIndexes || null,
    });

    try {
      const commitResult = await commitDeviceImport(auth.schoolId, {
        rows: commitRows,
        idempotencyKey,
        sourceDeviceId: schoolDevice?.id,
        syncMode: importSyncMode,
        targetDeviceIds,
        retryMode: retryOnly,
      });
      if (commitResult.jobId) {
        const remoteJob = await getImportJob(auth.schoolId, commitResult.jobId).catch(() => null);
        if (remoteJob) {
          setImportJob({
            id: remoteJob.id,
            status: remoteJob.status,
            retryCount: remoteJob.retryCount,
            startedAt: remoteJob.startedAt,
            finishedAt: remoteJob.finishedAt || undefined,
            lastError: remoteJob.lastError || undefined,
            processed: remoteJob.processed,
            success: remoteJob.success,
            failed: remoteJob.failed,
            synced: remoteJob.synced,
          });
        }
      }
      const nextRows = [...validation.rows];
      const studentByEmployeeNo = new Map(
        commitResult.students.map((student) => [String(student.deviceStudentId || ''), student]),
      );

      let success = 0;
      let failed = 0;
      let synced = 0;
      for (const i of queue) {
        const row = nextRows[i];
        if (!row) continue;
        try {
          const student = studentByEmployeeNo.get(row.employeeNo);
          if (!student?.id) {
            throw new Error('Commit natijasida student topilmadi');
          }

          let faceImageBase64: string | undefined;
          let faceError: string | undefined;
          if (importPullFace && row.hasFace && localDevice?.id) {
            try {
              const face = await getUserFace(localDevice.id, row.employeeNo);
              faceImageBase64 = face.imageBase64;
            } catch (err) {
              faceError = err instanceof Error ? err.message : 'Face sync xato';
            }
          }
          if (faceError) {
            throw new Error(`Face sync xato: ${faceError}`);
          }
          if (faceImageBase64) {
            await updateStudentProfile(student.id, {
              firstName: row.firstName,
              lastName: row.lastName,
              fatherName: row.fatherName || undefined,
              classId: row.classId,
              parentPhone: row.parentPhone || undefined,
              gender: row.gender,
              deviceStudentId: row.employeeNo,
              faceImageBase64,
            });
          }

          let syncResults: ImportRow["syncResults"] = [];
          if (targetDeviceIds.length > 0) {
            const syncResult = await syncStudentToDevices(student.id, targetDeviceIds);
            syncResults = syncResult.perDeviceResults.map((item) => ({
              backendDeviceId: item.backendDeviceId,
              deviceName: item.deviceName,
              status: item.status,
              lastError: item.lastError,
            }));
            const hasSyncFailure =
              !syncResult.ok ||
              syncResults.some((item) => item.status.toUpperCase() !== 'SUCCESS');
            if (hasSyncFailure) {
              throw new Error(
                syncResults
                  .filter((item) => item.status.toUpperCase() !== 'SUCCESS')
                  .map((item) => `${item.deviceName || item.backendDeviceId}: ${item.lastError || item.status}`)
                  .join('; ') || 'Qurilmaga sync xato',
              );
            }
            synced += 1;
          }

          nextRows[i] = {
            ...row,
            studentId: student.id,
            faceSynced: Boolean(faceImageBase64),
            syncResults,
            faceError: undefined,
            status: 'saved',
            error: undefined,
          };
          success += 1;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Saqlashda xato';
          nextRows[i] = {
            ...row,
            status: 'error',
            error: msg,
          };
          failed += 1;
        }
        setImportJob((prev) =>
          prev
            ? {
                ...prev,
                processed: prev.processed + 1,
                success,
                failed,
                synced,
              }
            : prev,
        );
      }

      setImportRows(nextRows);
      const finishedAt = new Date().toISOString();
      setImportJob((prev) => prev ? {
        ...prev,
        status: failed > 0 ? 'FAILED' : 'SUCCESS',
        finishedAt,
        success,
        failed,
        synced,
      } : prev);
      await pushImportAudit('DEVICE_IMPORT_FINISH', 'Import finished', {
        idempotencyKey,
        success,
        failed,
        synced,
      });
      addToast(
        `Import yakunlandi: ${success} success, ${failed} failed, ${synced} sync`,
        failed > 0 ? 'error' : 'success',
      );
      await Promise.all([refreshImportPreview(nextRows), loadImportMetrics()]);
      if (success > 0) {
        await loadUsers(true);
      }
      importIdempotencyRef.current = null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Importda xato';
      setImportJob((prev) =>
        prev
          ? {
              ...prev,
              status: 'FAILED',
              finishedAt: new Date().toISOString(),
              lastError: message,
            }
          : prev,
      );
      await pushImportAudit('DEVICE_IMPORT_FAIL', message);
      addToast(message, 'error');
    } finally {
      setImportLoading(false);
    }
  };

  const saveImportRows = async () => processImportRows();

  const retryFailedImportRows = async () => {
    const failedIndexes = importRows
      .map((r, idx) => ({ r, idx }))
      .filter(({ r }) => r.status === 'error')
      .map(({ idx }) => idx);
    if (failedIndexes.length === 0) {
      addToast('Retry uchun xato qatorlar yo\'q', 'error');
      return;
    }
    await processImportRows(failedIndexes, true);
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
              <div className="device-item-meta" style={{ marginBottom: 8 }}>
                <span className="badge">Total: {previewStats.total}</span>
                <span className="badge">Pending: {previewStats.pending}</span>
                <span className="badge badge-success">Saved: {previewStats.done}</span>
                <span className={`badge ${previewStats.failed > 0 ? 'badge-danger' : ''}`}>Failed: {previewStats.failed}</span>
                <span className={`badge ${previewStats.invalid > 0 ? 'badge-danger' : ''}`}>Invalid: {previewStats.invalid}</span>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => refreshImportPreview()}
                  disabled={importLoading}
                >
                  <Icons.Refresh /> Previewni yangilash
                </button>
              </div>
              {importPreview && (
                <div className="device-item-meta" style={{ marginBottom: 8 }}>
                  <span className="badge">Create: {importPreview.createCount}</span>
                  <span className="badge">Update: {importPreview.updateCount}</span>
                  <span className="badge">Skip: {importPreview.skipCount}</span>
                  <span className={`badge ${importPreview.invalidCount > 0 ? 'badge-danger' : ''}`}>
                    Invalid: {importPreview.invalidCount}
                  </span>
                  <span className={`badge ${importPreview.duplicateCount > 0 ? 'badge-danger' : ''}`}>
                    Dup: {importPreview.duplicateCount}
                  </span>
                  <span className={`badge ${importPreview.classErrorCount > 0 ? 'badge-danger' : ''}`}>
                    Class error: {importPreview.classErrorCount}
                  </span>
                </div>
              )}
              {importMetrics && (
                <div className="notice" style={{ marginBottom: 8 }}>
                  Metrics: success {(importMetrics.successRate * 100).toFixed(1)}% | retry {(importMetrics.retryRate * 100).toFixed(1)}% | mean latency {Math.round(importMetrics.meanLatencyMs)} ms
                </div>
              )}
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
                      const status = getImportDeviceStatus(d);
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
                          <span className={`badge ${
                            status === 'online' ? 'badge-success' : status === 'offline' ? 'badge-danger' : 'badge-warning'
                          }`}>
                            {status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : 'No credentials'}
                          </span>
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
                          {row.syncResults && row.syncResults.length > 0 && (
                            <div className="text-xs">
                              {row.syncResults.map((s) => (
                                <div key={`${row.employeeNo}-${s.backendDeviceId}`}>
                                  {(s.deviceName || s.backendDeviceId)}: {s.status}
                                  {s.lastError ? ` (${s.lastError})` : ''}
                                </div>
                              ))}
                            </div>
                          )}
                          {row.status === 'error' && (
                            <button
                              type="button"
                              className="button button-secondary"
                              style={{ marginTop: 6 }}
                              onClick={() => processImportRows([idx], true)}
                              disabled={importLoading}
                            >
                              Retry row
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              {importJob && (
                <div className="notice" style={{ marginRight: 'auto' }}>
                  Job: {importJob.status} | processed {importJob.processed} | success {importJob.success} | failed {importJob.failed} | synced {importJob.synced}
                </div>
              )}
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
                onClick={retryFailedImportRows}
                disabled={importLoading || importRows.every((r) => r.status !== 'error')}
              >
                <Icons.Refresh /> Failedlarni retry
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
            {importAuditTrail.length > 0 && (
              <div className="modal-body" style={{ borderTop: '1px solid var(--border-color)' }}>
                <div className="panel-title">Audit trail</div>
                <div style={{ maxHeight: 120, overflow: 'auto' }}>
                  {importAuditTrail.map((item, idx) => (
                    <div key={`${item.at}-${idx}`} className="text-xs">
                      [{new Date(item.at).toLocaleTimeString()}] {item.stage}: {item.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

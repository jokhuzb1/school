import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  cloneDeviceToDevice,
  cloneStudentsToDevice,
  deleteUser,
  fetchDevices,
  getDeviceCapabilities,
  getDeviceConfiguration,
  fetchSchoolDevices,
  fetchUsers,
  getDeviceWebhookHealth,
  getAuthUser,
  getWebhookInfo,
  recreateUser,
  rotateWebhookSecret,
  testDeviceConnection,
  testWebhookEndpoint,
  updateDeviceConfiguration,
  type DeviceConfig,
  type SchoolDeviceInfo,
  type UserInfoEntry,
  type WebhookInfo,
} from '../api';
import { Icons } from '../components/ui/Icons';
import { useGlobalToast } from '../hooks/useToast';

type DetailTab = 'overview' | 'configuration' | 'users' | 'webhook' | 'sync';

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
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserInfoEntry | null>(null);
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
      setUsers((prev) => (reset ? list : [...prev, ...list]));
      setUsersOffset(offset + list.length);
      setHasMoreUsers(list.length >= 30);
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

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (tab === 'users') {
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
                      </div>
                    </div>
                    <div className="device-item-actions">
                      <button
                        className="btn-icon"
                        title="Detail"
                        onClick={() => setSelectedUser(user)}
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
                    onClick={() => setSelectedUser(null)}
                  >
                    <Icons.X />
                  </button>
                </div>
                <p><strong>Ism:</strong> {selectedUser.name}</p>
                <p><strong>EmployeeNo:</strong> {selectedUser.employeeNo}</p>
                <p><strong>Gender:</strong> {selectedUser.gender || '-'}</p>
                <p><strong>Face count:</strong> {selectedUser.numOfFace ?? '-'}</p>
                <p><strong>Face URL:</strong> {selectedUser.faceURL || '-'}</p>
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
    </div>
  );
}

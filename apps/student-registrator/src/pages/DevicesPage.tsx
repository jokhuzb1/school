import { useState, useEffect, useMemo } from 'react';
import {
  fetchDevices,
  createDevice,
  updateDevice,
  testDeviceConnection,
  getAuthUser,
  fetchSchoolDevices,
  createSchoolDevice,
  updateSchoolDevice,
  getWebhookInfo,
  BACKEND_URL,
} from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { Icons } from '../components/ui/Icons';
import type { DeviceConfig, SchoolDeviceInfo } from '../types';
import type { WebhookInfo } from '../api';

export function DevicesPage() {
  const [credentials, setCredentials] = useState<DeviceConfig[]>([]);
  const [editingBackendId, setEditingBackendId] = useState<string | null>(null);
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    location: '',
    port: 80,
    username: '',
    password: '',
    deviceType: 'ENTRANCE',
    deviceId: '',
  });
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'ok' | 'fail'>>({});
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [showWebhookAdvanced, setShowWebhookAdvanced] = useState(false);
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [backendLoading, setBackendLoading] = useState(false);
  const { addToast } = useGlobalToast();

  useEffect(() => {
    loadCredentials();
    loadWebhookInfo();
    loadBackendDevices();
  }, []);

  const loadCredentials = async () => {
    try {
      const data = await fetchDevices();
      setCredentials(data);
    } catch (err) {
      console.error('Failed to load devices:', err);
      addToast('Ulanish sozlamalarini yuklashda xato', 'error');
    }
  };

  const loadWebhookInfo = async () => {
    const user = getAuthUser();
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    setWebhookLoading(true);
    try {
      const info = await getWebhookInfo(schoolId);
      setWebhookInfo(info);
    } catch (err) {
      console.error('Failed to load webhook info:', err);
      addToast('Webhook ma\'lumotlarini yuklashda xato', 'error');
    } finally {
      setWebhookLoading(false);
    }
  };

  const loadBackendDevices = async () => {
    const user = getAuthUser();
    const schoolId = user?.schoolId;
    if (!schoolId) return;
    setBackendLoading(true);
    try {
      const localCredentials =
        credentials.length > 0 ? credentials : await fetchDevices().catch(() => []);
      const data = await fetchSchoolDevices(schoolId);
      setBackendDevices(data);
      // Agar eski credentiallarda backendId yo'q bo'lsa, deviceId orqali bog'lab qo'yamiz
      if (localCredentials.length > 0) {
        const byDeviceId = new Map<string, DeviceConfig>();
        localCredentials.forEach((device) => {
          if (device.deviceId) {
            byDeviceId.set(normalize(device.deviceId), device);
          }
        });
        const toUpdate = data
          .map((backend) => {
            if (!backend.deviceId) return null;
            const match = byDeviceId.get(normalize(backend.deviceId));
            if (!match) return null;
            if (match.backendId === backend.id) return null;
            return { backend, match };
          })
          .filter(Boolean) as Array<{ backend: SchoolDeviceInfo; match: DeviceConfig }>;

        if (toUpdate.length > 0) {
          await Promise.all(
            toUpdate.map(({ backend, match }) =>
              updateDevice(match.id, {
                backendId: backend.id,
                host: match.host,
                port: match.port,
                username: match.username,
                password: match.password,
                deviceId: match.deviceId,
              }),
            ),
          );
          await loadCredentials();
        }
      }
    } catch (err) {
      console.error('Failed to load backend devices:', err);
      addToast('Qurilmalarni yuklashda xato', 'error');
    } finally {
      setBackendLoading(false);
    }
  };

  const normalize = (value?: string | null) => (value || '').trim().toLowerCase();

  const credentialsByBackendId = useMemo(() => {
    const map = new Map<string, DeviceConfig>();
    credentials.forEach((device) => {
      if (device.backendId) {
        map.set(device.backendId, device);
      }
    });
    return map;
  }, [credentials]);

  const credentialsByDeviceId = useMemo(() => {
    const map = new Map<string, DeviceConfig>();
    credentials.forEach((device) => {
      if (device.deviceId) {
        map.set(normalize(device.deviceId), device);
      }
    });
    return map;
  }, [credentials]);

  const getCredentialsForBackend = (device: SchoolDeviceInfo) => {
    const byBackend = credentialsByBackendId.get(device.id);
    if (byBackend) return byBackend;
    if (device.deviceId) {
      return credentialsByDeviceId.get(normalize(device.deviceId));
    }
    return undefined;
  };

  const isCredentialsExpired = (device?: DeviceConfig | null) => {
    if (!device?.credentialsExpiresAt) return false;
    const expires = new Date(device.credentialsExpiresAt).getTime();
    if (Number.isNaN(expires)) return false;
    return Date.now() > expires;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const isCredentialsOnlyMode = isCredentialsModalOpen && !isModalOpen;
      const trimmedName = formData.name.trim();
      const trimmedDeviceId = formData.deviceId.trim();
      if (!isCredentialsOnlyMode && !trimmedName) {
        addToast('Qurilma nomi majburiy', 'error');
        return;
      }

      const user = getAuthUser();
      const schoolId = user?.schoolId;
      if (!schoolId) {
        addToast('Maktab topilmadi', 'error');
        return;
      }

      let backendDevice: SchoolDeviceInfo | null = null;
      if (isCredentialsOnlyMode) {
        backendDevice = backendDevices.find((item) => item.id === editingBackendId) || null;
        if (!backendDevice) {
          addToast('Qurilma topilmadi', 'error');
          return;
        }
      } else {
        if (editingBackendId) {
          backendDevice = await updateSchoolDevice(editingBackendId, {
            name: trimmedName,
            deviceId: trimmedDeviceId || undefined,
            type: formData.deviceType,
            location: formData.location.trim() || undefined,
          });
          addToast('Qurilma yangilandi', 'success');
        } else {
          if (!trimmedDeviceId) {
            addToast('Device ID majburiy', 'error');
            return;
          }
          backendDevice = await createSchoolDevice(schoolId, {
            name: trimmedName,
            deviceId: trimmedDeviceId,
            type: formData.deviceType,
            location: formData.location.trim() || undefined,
          });
          addToast('Qurilma qo\'shildi', 'success');
        }
        await loadBackendDevices();
      }

      const credentialsProvided =
        formData.host.trim() && formData.username.trim() && formData.password.trim();
      const hostKey = formData.host.trim().toLowerCase();
      const usernameKey = formData.username.trim().toLowerCase();

      const existingLocal =
        (editingLocalId ? credentials.find((item) => item.id === editingLocalId) : null) ||
        (backendDevice ? getCredentialsForBackend(backendDevice) : undefined) ||
        credentials.find((item) => {
          const sameBackend = backendDevice ? item.backendId === backendDevice.id : false;
          const unlinked = !item.backendId;
          const endpointMatch =
            hostKey.length > 0 &&
            usernameKey.length > 0 &&
            item.host.trim().toLowerCase() === hostKey &&
            item.port === formData.port &&
            item.username.trim().toLowerCase() === usernameKey;
          return (sameBackend || unlinked) && endpointMatch;
        });

      if (credentialsProvided && backendDevice) {
        let savedLocal: DeviceConfig | null = null;
        if (!existingLocal && credentials.length >= 6) {
          addToast('Ulanish sozlamalari limiti (6 ta) to\'ldi', 'error');
        } else {
          const payload: Omit<DeviceConfig, 'id'> = {
            backendId: backendDevice.id,
            host: formData.host.trim(),
            port: formData.port,
            username: formData.username.trim(),
            password: formData.password,
            deviceId: backendDevice.deviceId || trimmedDeviceId || undefined,
          };

          if (existingLocal) {
            savedLocal = await updateDevice(existingLocal.id, payload);
          } else {
            savedLocal = await createDevice(payload);
          }
          await loadCredentials();
          addToast('Ulanish sozlamalari saqlandi', 'success');

          // Avtomatik test + deviceId sync
          if (savedLocal) {
            try {
              const test = await testDeviceConnection(savedLocal.id);
              console.log('[Device Test] auto test result', {
                localId: savedLocal.id,
                backendId: backendDevice.id,
                deviceIdFromTest: test.deviceId,
                ok: test.ok,
              });
              if (test.ok && test.deviceId) {
                if (!backendDevice.deviceId || backendDevice.deviceId !== test.deviceId) {
                  await updateSchoolDevice(backendDevice.id, { deviceId: test.deviceId });
                }
                if (savedLocal.deviceId !== test.deviceId || savedLocal.backendId !== backendDevice.id) {
                  await updateDevice(savedLocal.id, {
                    backendId: backendDevice.id,
                    host: savedLocal.host,
                    port: savedLocal.port,
                    username: savedLocal.username,
                    password: savedLocal.password,
                    deviceId: test.deviceId,
                  });
                }
                await Promise.all([loadBackendDevices(), loadCredentials()]);
              } else {
                console.warn('[Device Test] deviceId missing after test', {
                  ok: test.ok,
                  deviceId: test.deviceId,
                });
              }
            } catch (err) {
              console.error('Auto test/sync error:', err);
            }
          }
        }
      }

      setFormData({
        name: '',
        host: '',
        location: '',
        port: 80,
        username: '',
        password: '',
        deviceType: 'ENTRANCE',
        deviceId: '',
      });
      setEditingBackendId(null);
      setEditingLocalId(null);
      setIsModalOpen(false);
      setIsCredentialsModalOpen(false);
    } catch (err) {
      addToast('Xatolik yuz berdi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (device: SchoolDeviceInfo) => {
    const local = getCredentialsForBackend(device);
      setEditingBackendId(device.id);
      setEditingLocalId(local?.id || null);
      setIsModalOpen(true);
      setFormData({
        name: device.name,
        host: local?.host || '',
        location: device.location || '',
        port: local?.port || 80,
        username: local?.username || '',
        password: local?.password || '',
        deviceType: device.type || 'ENTRANCE',
        deviceId: device.deviceId || local?.deviceId || '',
      });
    };

  const openCredentialsModal = (device: SchoolDeviceInfo) => {
    const local = getCredentialsForBackend(device);
    setEditingBackendId(device.id);
    setEditingLocalId(local?.id || null);
    setIsCredentialsModalOpen(true);
    setFormData({
      name: device.name,
      host: local?.host || '',
      location: device.location || '',
      port: local?.port || 80,
      username: local?.username || '',
      password: local?.password || '',
      deviceType: device.type || 'ENTRANCE',
      deviceId: device.deviceId || local?.deviceId || '',
    });
  };

  const handleTestConnection = async (device: SchoolDeviceInfo) => {
    const local = getCredentialsForBackend(device);
    if (!local) {
      addToast('Ulanish sozlamalari topilmadi', 'error');
      return;
    }
    if (isCredentialsExpired(local)) {
      addToast('Ulanish sozlamalari muddati tugagan. Qayta kiriting.', 'error');
      return;
    }
    setTestingId(device.id);
    try {
      const result = await testDeviceConnection(local.id);
      const ok = result.ok;
      setTestStatus((prev) => ({ ...prev, [device.id]: ok ? 'ok' : 'fail' }));
      addToast(ok ? 'Ulanish muvaffaqiyatli' : 'Ulanish muvaffaqiyatsiz', ok ? 'success' : 'error');

      if (ok) {
        const updates: Partial<Pick<SchoolDeviceInfo, 'deviceId' | 'isActive' | 'lastSeenAt'>> = {
          isActive: true,
          lastSeenAt: new Date().toISOString(),
        };
        if (result.deviceId && result.deviceId !== device.deviceId) {
          updates.deviceId = result.deviceId;
        }
        try {
          await updateSchoolDevice(device.id, updates);
          await loadBackendDevices();
          await loadCredentials();
        } catch (err) {
          console.error('Backend sync error:', err);
        }
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [device.id]: 'fail' }));
      const message = err instanceof Error ? err.message : String(err);
      addToast(message || 'Ulanishni tekshirishda xato', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const deviceLimitReached = credentials.length >= 6;
  const openCreateModal = () => {
    setEditingBackendId(null);
    setEditingLocalId(null);
    setFormData({ name: '', host: '', location: '', port: 80, username: '', password: '', deviceType: 'ENTRANCE', deviceId: '' });
    setIsModalOpen(true);
  };

  const isBackendOnline = (lastSeenAt?: string | null) => {
    if (!lastSeenAt) return false;
    const last = new Date(lastSeenAt).getTime();
    if (Number.isNaN(last)) return false;
    return Date.now() - last < 2 * 60 * 60 * 1000;
  };

  const formatWebhookUrl = (value?: string) => {
    if (!value) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) {
      try {
        const url = new URL(value);
        return `${url.pathname}${url.search}`;
      } catch {
        return value;
      }
    }
    if (value.startsWith('/')) return value;
    return `/${value}`;
  };

  const getBackendPortLabel = () => {
    try {
      const url = new URL(BACKEND_URL);
      if (url.port) return url.port;
      return url.protocol === 'https:' ? '443' : '80';
    } catch {
      return '';
    }
  };

  const maskWebhookValue = (value: string, kind: 'url' | 'secret' | 'header') => {
    if (!value) return '';
    if (kind === 'url') {
      return value.replace(/secret=[^&]+/i, 'secret=***');
    }
    return '****************';
  };

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(`${label} nusxalandi`, 'success');
    } catch (err) {
      addToast('Nusxalashda xato', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Qurilmalar</h1>
          <p className="page-description">Hikvision qurilmalarini boshqarish</p>
        </div>
        <div className="page-actions">
          <button
            className="button button-primary"
            onClick={openCreateModal}
          >
            <Icons.Plus /> Qurilma qo'shish
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="two-column-layout">
          {/* Webhook */}
          <div className="card">
            <h2>Webhook manzillari</h2>
            {webhookLoading && <p className="notice">Yuklanmoqda...</p>}
            {!webhookLoading && !webhookInfo && (
              <p className="notice notice-warning">Webhook ma'lumotlari topilmadi</p>
            )}
            {webhookInfo && (
              <div className="webhook-panel">
                <div className="webhook-field">
                  <label>Kirish webhooki (Hikvision URL)</label>
                  <div className="webhook-row">
                    <input
                      className="input webhook-input"
                      readOnly
                      value={showWebhookAdvanced
                        ? formatWebhookUrl(webhookInfo.inUrlWithSecret)
                        : maskWebhookValue(formatWebhookUrl(webhookInfo.inUrlWithSecret), 'url')}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setShowWebhookAdvanced((v) => !v)}
                      title={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                      aria-label={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                    >
                      {showWebhookAdvanced ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-primary"
                      onClick={() => copyToClipboard(formatWebhookUrl(webhookInfo.inUrlWithSecret), 'Kirish webhooki')}
                      title="Nusxalash"
                      aria-label="Nusxalash"
                    >
                      <Icons.Copy />
                    </button>
                  </div>
                </div>

                <div className="webhook-field">
                  <label>Chiqish webhooki (Hikvision URL)</label>
                  <div className="webhook-row">
                    <input
                      className="input webhook-input"
                      readOnly
                      value={showWebhookAdvanced
                        ? formatWebhookUrl(webhookInfo.outUrlWithSecret)
                        : maskWebhookValue(formatWebhookUrl(webhookInfo.outUrlWithSecret), 'url')}
                    />
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setShowWebhookAdvanced((v) => !v)}
                      title={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                      aria-label={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                    >
                      {showWebhookAdvanced ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                    <button
                      type="button"
                      className="btn-icon btn-primary"
                      onClick={() => copyToClipboard(formatWebhookUrl(webhookInfo.outUrlWithSecret), 'Chiqish webhooki')}
                      title="Nusxalash"
                      aria-label="Nusxalash"
                    >
                      <Icons.Copy />
                    </button>
                  </div>
                </div>

                <div className="webhook-advanced">
                  <div className="webhook-advanced-header">
                    <span>Advanced (header orqali yuborish)</span>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setShowWebhookAdvanced((v) => !v)}
                      title={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                      aria-label={showWebhookAdvanced ? 'Yashirish' : "Ko'rsatish"}
                    >
                      {showWebhookAdvanced ? <Icons.EyeOff /> : <Icons.Eye />}
                    </button>
                  </div>
                  {showWebhookAdvanced && (
                    <div className="webhook-advanced-body">
                      <div className="webhook-field">
                        <label>Header nomi (key)</label>
                        <div className="webhook-row">
                          <input
                            className="input webhook-input"
                            readOnly
                            value={webhookInfo.secretHeaderName}
                          />
                          <button
                            type="button"
                            className="btn-icon btn-primary"
                            onClick={() => copyToClipboard(webhookInfo.secretHeaderName, 'Header nomi')}
                            title="Nusxalash"
                            aria-label="Nusxalash"
                          >
                            <Icons.Copy />
                          </button>
                        </div>
                      </div>
                      <div className="webhook-field">
                        <label>Kirish secret</label>
                        <div className="webhook-row">
                          <input
                            className="input webhook-input"
                            readOnly
                            value={webhookInfo.inSecret}
                          />
                          <button
                            type="button"
                            className="btn-icon btn-primary"
                            onClick={() => copyToClipboard(webhookInfo.inSecret, 'Kirish secret')}
                            title="Nusxalash"
                            aria-label="Nusxalash"
                          >
                            <Icons.Copy />
                          </button>
                        </div>
                      </div>
                      <div className="webhook-field">
                        <label>Chiqish secret</label>
                        <div className="webhook-row">
                          <input
                            className="input webhook-input"
                            readOnly
                            value={webhookInfo.outSecret}
                          />
                          <button
                            type="button"
                            className="btn-icon btn-primary"
                            onClick={() => copyToClipboard(webhookInfo.outSecret, 'Chiqish secret')}
                            title="Nusxalash"
                            aria-label="Nusxalash"
                          >
                            <Icons.Copy />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="webhook-note">
                  <div>Webhook endpointlar faqat path ko'rinishida beriladi.</div>
                  <div>Port: <strong>{getBackendPortLabel() || 'Noma\'lum'}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Device List */}
          <div className="card">
            <div className="panel-header">
              <div>
                <div className="panel-title">Qurilmalar ro'yxati</div>
                <div className="panel-subtitle">
                  Tizimdagi qurilmalar ro'yxati
                </div>
              </div>
              <div className="panel-actions">
                <button
                  type="button"
                  className="btn-icon"
                  onClick={loadBackendDevices}
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
                          onClick={() => handleTestConnection(backend)}
                          title="Ulanishni tekshirish"
                          disabled={testingId === backend.id}
                        >
                          {testingId === backend.id ? <span className="spinner" /> : <Icons.Refresh />}
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => openCredentialsModal(backend)}
                          title="Ulanish sozlamalari"
                        >
                          <Icons.Link />
                        </button>
                        <button
                          className="btn-icon btn-primary"
                          onClick={() => openEditModal(backend)}
                          title="Tahrirlash"
                        >
                          <Icons.Edit />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingBackendId ? 'Qurilmani tahrirlash' : 'Yangi qurilma'}</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Nomi *</label>
                  <input
                    className="input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Asosiy kirish"
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Joylashuv</label>
                  <input
                    className="input"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Masalan: 1-qavat, asosiy kirish"
                  />
                </div>

                <div className="form-group">
                  <label>Device ID (Hikvision) {!editingBackendId ? '*' : ''}</label>
                  <input
                    className="input"
                    value={formData.deviceId}
                    onChange={(e) => setFormData({ ...formData, deviceId: e.target.value })}
                    placeholder="Masalan: 1maktab"
                    required={!editingBackendId}
                  />
                </div>

                <div className="form-group">
                  <label>Turi</label>
                  <select
                    className="input"
                    value={formData.deviceType}
                    onChange={(e) => setFormData({ ...formData, deviceType: e.target.value })}
                  >
                    <option value="ENTRANCE">Kirish</option>
                    <option value="EXIT">Chiqish</option>
                  </select>
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={loading}
                  >
                    {editingBackendId ? <><Icons.Edit /> Saqlash</> : <><Icons.Plus /> Qo'shish</>}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setIsModalOpen(false)}
                  >
                    <Icons.X /> Bekor qilish
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isCredentialsModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCredentialsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ulanish sozlamalari</h3>
              <button className="modal-close" onClick={() => setIsCredentialsModalOpen(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>IP manzil</label>
                    <input
                      className="input"
                      value={formData.host}
                      onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                      placeholder="192.168.1.100"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label>Port</label>
                    <input
                      className="input"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Username</label>
                    <input
                      className="input"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Parol</label>
                    <input
                      className="input"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                  </div>
                </div>

                <p className="notice">
                  Login va parol backendga yuborilmaydi. Faqat shu kompyuterda saqlanadi va 30 kun amal qiladi.
                </p>

                <div className="form-actions">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={loading}
                  >
                    <><Icons.Edit /> Saqlash</>
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setIsCredentialsModalOpen(false)}
                  >
                    <Icons.X /> Bekor qilish
                  </button>
                </div>

                {deviceLimitReached && !editingLocalId && (
                  <p className="notice notice-warning">
                    Ulanish sozlamalari limiti 6 ta. Yangi login/parol qo'shishda limit tekshiriladi.
                  </p>
                )}
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

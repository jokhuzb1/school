import { useState, useEffect } from 'react';
import {
  fetchDevices,
  createDevice,
  updateDevice,
  deleteDevice,
  testDeviceConnection,
  getAuthUser,
  fetchSchoolDevices,
  createSchoolDevice,
  updateSchoolDevice,
} from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { Icons } from '../components/ui/Icons';
import type { DeviceConfig } from '../types';

export function DevicesPage() {
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    port: 80,
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<Record<string, 'ok' | 'fail'>>({});
  const { addToast } = useGlobalToast();

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      const data = await fetchDevices();
      setDevices(data);
    } catch (err) {
      console.error('Failed to load devices:', err);
      addToast('Qurilmalarni yuklashda xato', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let localDevice: DeviceConfig | null = null;
      if (editingId) {
        const updated = await updateDevice(editingId, formData);
        setDevices(prev => prev.map(d => d.id === editingId ? updated : d));
        addToast('Qurilma yangilandi', 'success');
        localDevice = updated;
      } else {
        const created = await createDevice(formData);
        setDevices(prev => [...prev, created]);
        addToast('Qurilma qo\'shildi', 'success');
        localDevice = created;
      }

      // Backendga sync qilish uchun test connection kerak
      if (localDevice) {
        try {
          const result = await testDeviceConnection(localDevice.id);
          if (result.ok && result.deviceId) {
            const user = getAuthUser();
            const schoolId = user?.schoolId;
            if (schoolId) {
              const backendDevices = await fetchSchoolDevices(schoolId);
              const existing = backendDevices.find((d) => d.deviceId === result.deviceId);
              if (existing) {
                await updateSchoolDevice(existing.id, {
                  name: localDevice.name,
                  deviceId: result.deviceId,
                  location: localDevice.host,
                  isActive: true,
                  lastSeenAt: new Date().toISOString(),
                });
              } else {
                await createSchoolDevice(schoolId, {
                  name: localDevice.name,
                  deviceId: result.deviceId,
                  location: localDevice.host,
                  type: 'ENTRANCE',
                });
              }
              addToast('Backendga sync qilindi', 'success');
            }
          } else {
            addToast('Backendga sync uchun qurilma online bo\'lishi kerak', 'error');
          }
        } catch (err) {
          console.error('Backend sync error:', err);
          addToast('Backend syncda xato', 'error');
        }
      }

      // Reset form
      setFormData({ name: '', host: '', port: 80, username: '', password: '' });
      setEditingId(null);
    } catch (err) {
      addToast('Xatolik yuz berdi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (device: DeviceConfig) => {
    setEditingId(device.id);
    setFormData({
      name: device.name,
      host: device.host,
      port: device.port,
      username: device.username,
      password: device.password,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Bu qurilmani o\'chirmoqchimisiz?')) return;

    try {
      const target = devices.find((d) => d.id === id) || null;
      await deleteDevice(id);
      setDevices(prev => prev.filter(d => d.id !== id));
      addToast('Qurilma o\'chirildi', 'success');
      if (target?.deviceId) {
        const user = getAuthUser();
        const schoolId = user?.schoolId;
        if (schoolId) {
          try {
            const backendDevices = await fetchSchoolDevices(schoolId);
            const existing = backendDevices.find((d) => d.deviceId === target.deviceId);
            if (existing) {
              await updateSchoolDevice(existing.id, { isActive: false });
              addToast('Backendda nofaol qilindi', 'success');
            }
          } catch (err) {
            console.error('Backend deactivate error:', err);
            addToast('Backendda nofaol qilishda xato', 'error');
          }
        }
      }
      if (editingId === id) {
        setEditingId(null);
        setFormData({ name: '', host: '', port: 80, username: '', password: '' });
      }
    } catch (err) {
      addToast('O\'chirishda xato', 'error');
    }
  };

  const handleTestConnection = async (device: DeviceConfig) => {
    setTestingId(device.id);
    try {
      const result = await testDeviceConnection(device.id);
      const ok = result.ok;
      setTestStatus((prev) => ({ ...prev, [device.id]: ok ? 'ok' : 'fail' }));
      addToast(ok ? 'Ulanish muvaffaqiyatli' : 'Ulanish muvaffaqiyatsiz', ok ? 'success' : 'error');

      if (ok && result.deviceId) {
        const user = getAuthUser();
        const schoolId = user?.schoolId;
        if (schoolId) {
          const backendDevices = await fetchSchoolDevices(schoolId);
          const existing = backendDevices.find((d) => d.deviceId === result.deviceId);
          if (existing) {
            await updateSchoolDevice(existing.id, {
              name: device.name,
              deviceId: result.deviceId,
              location: device.host,
              isActive: true,
              lastSeenAt: new Date().toISOString(),
            });
          } else {
            await createSchoolDevice(schoolId, {
              name: device.name,
              deviceId: result.deviceId,
              location: device.host,
              type: 'ENTRANCE',
            });
          }
        }
      }
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [device.id]: 'fail' }));
      addToast('Ulanishni tekshirishda xato', 'error');
    } finally {
      setTestingId(null);
    }
  };

  const deviceLimitReached = devices.length >= 6;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Qurilmalar</h1>
          <p className="page-description">Hikvision qurilmalarini boshqarish</p>
        </div>
      </div>

      <div className="page-content">
        <div className="two-column-layout">
          {/* Form */}
          <div className="card">
            <h2>Qurilma {editingId ? 'tahrirlash' : 'qo\'shish'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nomi *</label>
                <input
                  className="input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Asosiy kirish"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>IP manzil *</label>
                  <input
                    className="input"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    placeholder="192.168.1.100"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Port</label>
                  <input
                    className="input"
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Username *</label>
                  <input
                    className="input"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Parol *</label>
                  <input
                    className="input"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="submit" 
                  className="button button-primary"
                  disabled={loading || (!editingId && deviceLimitReached)}
                >
                  {editingId ? <><Icons.Edit /> Yangilash</> : <><Icons.Plus /> Qo'shish</>}
                </button>
                {editingId && (
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ name: '', host: '', port: 80, username: '', password: '' });
                    }}
                  >
                    <Icons.X /> Bekor qilish
                  </button>
                )}
              </div>

              {deviceLimitReached && !editingId && (
                <p className="notice notice-warning">Maksimal 6 ta qurilma qo'shish mumkin</p>
              )}
            </form>
          </div>

          {/* Device List */}
          <div className="card">
            <h2>Qurilmalar ro'yxati</h2>
            {devices.length === 0 ? (
              <div className="empty-state">
                <Icons.Monitor />
                <p>Qurilmalar yo'q</p>
              </div>
            ) : (
              <div className="device-list">
                {devices.map(device => (
                  <div key={device.id} className="device-item">
                    <div className="device-item-header">
                      <strong>{device.name}</strong>
                      <div className="device-item-meta">
                        <span className="badge">{device.host}:{device.port}</span>
                        {testStatus[device.id] === 'ok' && (
                          <span className="badge badge-success">Online</span>
                        )}
                        {testStatus[device.id] === 'fail' && (
                          <span className="badge badge-danger">Xato</span>
                        )}
                      </div>
                    </div>
                    <div className="device-item-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleTestConnection(device)}
                        title="Ulanishni tekshirish"
                        disabled={testingId === device.id}
                      >
                        {testingId === device.id ? <span className="spinner" /> : <Icons.Refresh />}
                      </button>
                      <button
                        className="btn-icon btn-primary"
                        onClick={() => handleEdit(device)}
                        title="Tahrirlash"
                      >
                        <Icons.Edit />
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(device.id)}
                        title="O'chirish"
                      >
                        <Icons.Trash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

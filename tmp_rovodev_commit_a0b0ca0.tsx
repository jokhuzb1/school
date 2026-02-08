import { useState, useEffect, useMemo } from 'react';
import { fetchDevices, fetchSchoolDevices, fetchUsers, deleteUser, recreateUser, fileToFaceBase64, getAuthUser } from '../api';
import { useGlobalToast } from '../hooks/useToast';
import { Icons } from '../components/ui/Icons';
import type { DeviceConfig, SchoolDeviceInfo, UserInfoEntry, UserInfoSearchResponse } from '../types';
export function StudentsPage() {
  const [backendDevices, setBackendDevices] = useState<SchoolDeviceInfo[]>([]);
  const [credentials, setCredentials] = useState<DeviceConfig[]>([]);
  const [selectedBackendId, setSelectedBackendId] = useState<string>('');
  const [userList, setUserList] = useState<UserInfoSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState<UserInfoEntry | null>(null);
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('unknown');
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editNewId, setEditNewId] = useState(false);
  const [editReuseFace, setEditReuseFace] = useState(true);
  const { addToast } = useGlobalToast();

  const normalize = (value?: string | null) => (value || '').trim().toLowerCase();
  const credentialsByBackendId = useMemo(() => {
    const map = new Map<string, DeviceConfig>();
    credentials.forEach((device) => {
      if (device.backendId) map.set(device.backendId, device);
    });
    return map;
  }, [credentials]);
  const credentialsByDeviceId = useMemo(() => {
    const map = new Map<string, DeviceConfig>();
    credentials.forEach((device) => {
      if (device.deviceId) map.set(normalize(device.deviceId), device);
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

  const selectedBackend = useMemo(
    () => backendDevices.find((device) => device.id === selectedBackendId),
    [backendDevices, selectedBackendId],
  );
  const selectedLocal = useMemo(() => {
    if (!selectedBackend) return undefined;
    const local = getCredentialsForBackend(selectedBackend);
    if (!local) return undefined;
    if (isCredentialsExpired(local)) return undefined;
    return local;
  }, [selectedBackend, credentialsByBackendId, credentialsByDeviceId]);
  const selectedDeviceId = selectedLocal?.id ?? '';
  const editPreviewUrl = useMemo(() => (editFile ? URL.createObjectURL(editFile) : null), [editFile]);
  useEffect(() => {
    return () => {
      if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    };
  }, [editPreviewUrl]);
  useEffect(() => {
    const loadDevices = async () => {
      const user = getAuthUser();
      const schoolId = user?.schoolId;
      if (!schoolId) {
        addToast('Maktab topilmadi', 'error');
        return;
      }
      try {
        const [backend, local] = await Promise.all([
          fetchSchoolDevices(schoolId),
          fetchDevices(),
        ]);
        setBackendDevices(backend);
        setCredentials(local);
      } catch (err) {
        console.error('Failed to load devices:', err);
        addToast('Qurilmalarni yuklashda xato', 'error');
      }
    };
    loadDevices();
  }, [addToast]);
  useEffect(() => {
    if (selectedBackendId || backendDevices.length === 0) return;
    const firstWithCredentials = backendDevices.find((device) => {
      const local = getCredentialsForBackend(device);
      return local && !isCredentialsExpired(local);
    });
    setSelectedBackendId(firstWithCredentials?.id || backendDevices[0].id);
  }, [backendDevices, selectedBackendId, credentialsByBackendId, credentialsByDeviceId]);
  useEffect(() => {
    if (!selectedDeviceId) {
      setUserList(null);
      return;
    }
    const loadUsers = async () => {
      setLoading(true);
      try {
        const data = await fetchUsers(selectedDeviceId);
        setUserList(data);
      } catch (err) {
        console.error('Failed to load users:', err);
        addToast('Foydalanuvchilarni yuklashda xato', 'error');
      } finally {
        setLoading(false);
      }
    };
    loadUsers();
  }, [selectedDeviceId, addToast]);
  const filteredUsers = userList?.UserInfoSearch?.UserInfo?.filter(user => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return user.name.toLowerCase().includes(query) || 
           user.employeeNo.toLowerCase().includes(query);
  }) || [];
  const handleDeleteUser = async (employeeNo: string) => {
    if (!selectedDeviceId) return;
    if (!window.confirm('Bu foydalanuvchini qurilmadan o\'chirmoqchimisiz?')) return;
    try {
      await deleteUser(selectedDeviceId, employeeNo);
      addToast('Foydalanuvchi o\'chirildi', 'success');
      // Reload users
      const data = await fetchUsers(selectedDeviceId);
      setUserList(data);
    } catch (err) {
      addToast('O\'chirishda xato', 'error');
    }
  };
  const startEditUser = (user: UserInfoEntry) => {
    setEditingUser(user);
    setEditName(user.name || '');
    setEditGender(user.gender || 'unknown');
    setEditFile(null);
    setEditNewId(false);
    setEditReuseFace(true);
  };
  const cancelEditUser = () => {
    setEditingUser(null);
    setEditFile(null);
  };
  const handleSaveEdit = async () => {
    if (!selectedDeviceId || !editingUser) return;
    if (!editName.trim()) {
      addToast("Ism majburiy", "error");
      return;
    }
    if (!editReuseFace && !editFile) {
      addToast("Yangi rasm tanlang yoki avvalgi rasmni ishlating", "error");
      return;
    }

    try {
      const faceImageBase64 = editFile ? await fileToFaceBase64(editFile) : undefined;
      await recreateUser(
        selectedDeviceId,
        editingUser.employeeNo,
        editName.trim(),
        editGender,
        editNewId,
        editReuseFace,
        faceImageBase64,
      );
      addToast("Foydalanuvchi qayta yaratildi", "success");
      cancelEditUser();
      const data = await fetchUsers(selectedDeviceId);
      setUserList(data);
    } catch (err) {
      console.error("Failed to recreate user:", err);
      addToast("Qayta yaratishda xato", "error");
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">O'quvchilar</h1>
          <p className="page-description">Qurilmadagi foydalanuvchilar ro'yxati</p>
        </div>
      </div>

      <div className="filter-bar">
        <div className="form-group">
          <label>Qurilma:</label>
          <select 
            className="input"
            value={selectedBackendId}
            onChange={(e) => setSelectedBackendId(e.target.value)}
          >
            <option value="">Tanlang</option>
            {backendDevices.map(device => {
              const local = getCredentialsForBackend(device);
              const expired = isCredentialsExpired(local);
              const statusLabel = !local
                ? " - Sozlanmagan"
                : expired
                ? " - Muddati tugagan"
                : "";
              return (
                <option key={device.id} value={device.id}>
                  {device.name}{device.deviceId ? ` (${device.deviceId})` : ''}{statusLabel}
                </option>
              );
            })}
          </select>
        </div>

        <div className="form-group">
          <label>Qidirish:</label>
          <input
            className="input"
            placeholder="Ism yoki ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="page-content">
        {editingUser && (
          <div className="card edit-user-panel">
            <h2>Foydalanuvchini qayta yaratish</h2>
            <div className="form-row">
              <div className="form-group">
                <label>Ism</label>
                <input
                  className="input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ism va familiya"
                />
              </div>
              <div className="form-group">
                <label>Jinsi</label>
                <select
                  className="input"
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={editReuseFace}
                    onChange={(e) => setEditReuseFace(e.target.checked)}
                  />
                  Avvalgi rasmni ishlatish
                </label>
              </div>
              <div className="form-group">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={editNewId}
                    onChange={(e) => setEditNewId(e.target.checked)}
                  />
                  Yangi ID berish
                </label>
              </div>
            </div>

            {!editReuseFace && (
              <div className="form-row">
                <div className="form-group">
                  <label>Yangi rasm</label>
                  <input
                    type="file"
                    className="input"
                    accept="image/*"
                    onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  />
                </div>
                <div className="form-group">
                  <label>Preview</label>
                  {editPreviewUrl ? (
                    <img
                      src={editPreviewUrl}
                      alt="Preview"
                      className="image-preview"
                    />
                  ) : (
                    <div className="empty-state">
                      <Icons.Image />
                      <p>Rasm tanlanmagan</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="form-actions">
              <button className="button button-primary" onClick={handleSaveEdit}>
                <Icons.Check /> Saqlash
              </button>
              <button className="button button-secondary" onClick={cancelEditUser}>
                <Icons.X /> Bekor qilish
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">Yuklanmoqda...</div>
        ) : !selectedBackendId ? (
          <div className="empty-state">
            <Icons.Monitor />
            <p>Qurilma tanlang</p>
          </div>
        ) : !selectedDeviceId ? (
          <div className="empty-state">
            <Icons.AlertCircle />
            <p>Ulanish sozlamalari topilmadi</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Icons.Users />
            <p>Foydalanuvchilar topilmadi</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Employee No</th>
                  <th>Ism</th>
                  <th>Jinsi</th>
                  <th>Yuzlar soni</th>
                  <th>Amallar</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.employeeNo}>
                    <td>{user.employeeNo}</td>
                    <td>{user.name}</td>
                    <td>{user.gender || '-'}</td>
                    <td>{user.numOfFace || 0}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-icon btn-primary"
                          onClick={() => startEditUser(user)}
                          title="Qayta yaratish"
                        >
                          <Icons.Refresh />
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDeleteUser(user.employeeNo)}
                          title="O'chirish"
                        >
                          <Icons.Trash />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

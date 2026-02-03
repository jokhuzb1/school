import { useEffect, useMemo, useState } from "react";
import {
  createDevice,
  deleteDevice,
  deleteUser,
  fetchDevices,
  fetchUsers,
  recreateUser,
  registerStudent,
  updateDevice,
  type DeviceConfig,
  type RegisterResult,
  type UserInfoEntry,
  type UserInfoSearchResponse,
} from "./api";

const emptyDevice: Omit<DeviceConfig, "id"> = {
  name: "",
  host: "",
  port: 80,
  username: "",
  password: "",
};

const genders = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Unknown" },
];

function App() {
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [deviceForm, setDeviceForm] = useState<Omit<DeviceConfig, "id">>(emptyDevice);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [registerName, setRegisterName] = useState("");
  const [registerGender, setRegisterGender] = useState("male");
  const [registerFile, setRegisterFile] = useState<File | null>(null);
  const [registerResult, setRegisterResult] = useState<RegisterResult | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [userList, setUserList] = useState<UserInfoSearchResponse | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<UserInfoEntry | null>(null);
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("unknown");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editNewId, setEditNewId] = useState(false);
  const [editReuseFace, setEditReuseFace] = useState(true);

  useEffect(() => {
    fetchDevices()
      .then(setDevices)
      .catch((err) => setDeviceError(String(err)));
  }, []);

  useEffect(() => {
    if (!selectedDeviceId && devices.length > 0) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  const deviceLimitReached = devices.length >= 6;
  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  const handleDeviceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeviceError(null);
    try {
      if (editingId) {
        const updated = await updateDevice(editingId, deviceForm);
        setDevices((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
      } else {
        const created = await createDevice(deviceForm);
        setDevices((prev) => [...prev, created]);
      }
      setDeviceForm(emptyDevice);
      setEditingId(null);
    } catch (err) {
      setDeviceError(String(err));
    }
  };

  const handleDeviceEdit = (device: DeviceConfig) => {
    setEditingId(device.id);
    setDeviceForm({
      name: device.name,
      host: device.host,
      port: device.port,
      username: device.username,
      password: device.password,
    });
  };

  const handleDeviceDelete = async (id: string) => {
    setDeviceError(null);
    try {
      await deleteDevice(id);
      setDevices((prev) => prev.filter((device) => device.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setDeviceForm(emptyDevice);
      }
    } catch (err) {
      setDeviceError(String(err));
    }
  };

  const handleRegisterSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setRegisterError(null);
    setRegisterResult(null);
    if (!registerFile) {
      setRegisterError("Face image is required.");
      return;
    }

    setRegisterLoading(true);
    try {
      const formData = new FormData();
      formData.append("name", registerName.trim());
      formData.append("gender", registerGender);
      formData.append("faceImage", registerFile);
      const result = await registerStudent(formData);
      setRegisterResult(result);
      setRegisterName("");
      setRegisterFile(null);
      if (selectedDeviceId) {
        handleFetchUsers();
      }
    } catch (err) {
      setRegisterError(String(err));
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleFetchUsers = async () => {
    if (!selectedDeviceId) return;
    setUserError(null);
    setUserLoading(true);
    try {
      const data = await fetchUsers(selectedDeviceId);
      setUserList(data);
    } catch (err) {
      setUserError(String(err));
    } finally {
      setUserLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedDeviceId) {
      setUserList(null);
      return;
    }
    handleFetchUsers();
  }, [selectedDeviceId]);

  const startEditUser = (user: UserInfoEntry) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditGender(user.gender ?? "unknown");
    setEditFile(null);
    setEditNewId(false);
    setEditReuseFace(true);
  };

  const cancelEditUser = () => {
    setEditingUser(null);
    setEditName("");
    setEditGender("unknown");
    setEditFile(null);
    setEditNewId(false);
    setEditReuseFace(true);
  };

  const saveEditUser = async () => {
    if (!selectedDeviceId || !editingUser) return;
    setUserError(null);
    if (!editFile && !editReuseFace) {
      setUserError("Face image is required when reuse is off.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("name", editName.trim());
      formData.append("gender", editGender);
      formData.append("newEmployeeNo", String(editNewId));
      formData.append("reuseExistingFace", String(editReuseFace));
      if (editFile) {
        formData.append("faceImage", editFile);
      }
      await recreateUser(selectedDeviceId, editingUser.employeeNo, formData);
      cancelEditUser();
      handleFetchUsers();
    } catch (err) {
      setUserError(String(err));
    }
  };

  const handleDeleteUser = async (employeeNo: string) => {
    if (!selectedDeviceId) return;
    if (!window.confirm("Delete this user from the device?")) return;
    setUserError(null);
    try {
      await deleteUser(selectedDeviceId, employeeNo);
      handleFetchUsers();
    } catch (err) {
      setUserError(String(err));
    }
  };

  return (
    <div className="app">
      <div className="header">
        <h1>Student Register</h1>
        <p>Register students to up to 6 Hikvision devices on the same LAN.</p>
      </div>

      <div className="grid">
        <section className="card">
          <h2>Devices</h2>
          <p className="notice">
            Add up to 6 devices. Credentials are stored locally on this machine.
          </p>
          {deviceError && <p className="notice error">{deviceError}</p>}
          <form onSubmit={handleDeviceSubmit} className="device-form">
            <label className="label">Device Name</label>
            <input
              className="input"
              value={deviceForm.name}
              onChange={(event) =>
                setDeviceForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Main Entrance"
              required
            />
            <div className="row">
              <div>
                <label className="label">Host (IP)</label>
                <input
                  className="input"
                  value={deviceForm.host}
                  onChange={(event) =>
                    setDeviceForm((prev) => ({ ...prev, host: event.target.value }))
                  }
                  placeholder="192.168.100.55"
                  required
                />
              </div>
              <div>
                <label className="label">Port</label>
                <input
                  className="input"
                  type="number"
                  value={deviceForm.port}
                  onChange={(event) =>
                    setDeviceForm((prev) => ({
                      ...prev,
                      port: Number(event.target.value),
                    }))
                  }
                  required
                />
              </div>
            </div>
            <div className="row">
              <div>
                <label className="label">Username</label>
                <input
                  className="input"
                  value={deviceForm.username}
                  onChange={(event) =>
                    setDeviceForm((prev) => ({
                      ...prev,
                      username: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <input
                  className="input"
                  type="password"
                  value={deviceForm.password}
                  onChange={(event) =>
                    setDeviceForm((prev) => ({
                      ...prev,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            </div>
            <button
              className="button"
              type="submit"
              disabled={!editingId && deviceLimitReached}
            >
              {editingId ? "Update Device" : "Add Device"}
            </button>
            {deviceLimitReached && !editingId && (
              <p className="notice">Device limit reached (6).</p>
            )}
          </form>

          <div className="device-list">
            {devices.map((device) => (
              <div className="device-item" key={device.id}>
                <div className="device-item-header">
                  <strong>{device.name}</strong>
                  <span className="badge">{device.host}</span>
                </div>
                <div>Port: {device.port}</div>
                <div>Username: {device.username}</div>
                <div className="row">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => handleDeviceEdit(device)}
                  >
                    Edit
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => handleDeviceDelete(device.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Register Student</h2>
          <p className="notice">
            The system will send data only to devices reachable on the current LAN.
          </p>
          {registerError && <p className="notice error">{registerError}</p>}
          {registerResult && (
            <div className="notice success">
              <div>Employee ID: {registerResult.employeeNo}</div>
              <div>
                {registerResult.results.map((result) => (
                  <div key={result.deviceId}>
                    {result.deviceName}: {result.connection.ok ? "Connected" : "Offline"}
                    {result.userCreate && !result.userCreate.ok &&
                      ` - User failed (${result.userCreate.statusString || "error"})`}
                    {result.faceUpload && !result.faceUpload.ok &&
                      ` - Face failed (${result.faceUpload.statusString || "error"})`}
                  </div>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={handleRegisterSubmit}>
            <label className="label">Student Name</label>
            <input
              className="input"
              value={registerName}
              onChange={(event) => setRegisterName(event.target.value)}
              placeholder="Full name"
              required
            />
            <label className="label">Gender</label>
            <select
              className="select"
              value={registerGender}
              onChange={(event) => setRegisterGender(event.target.value)}
            >
              {genders.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <label className="label">Face Image (JPG/PNG)</label>
            <input
              className="input"
              type="file"
              accept="image/*"
              onChange={(event) =>
                setRegisterFile(event.target.files ? event.target.files[0] : null)
              }
              required
            />
            <button className="button" type="submit" disabled={registerLoading}>
              {registerLoading ? "Registering..." : "Register Student"}
            </button>
          </form>
        </section>

        <section className="card">
          <h2>Registered Users</h2>
          <div className="row">
            <select
              className="select"
              value={selectedDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
            >
              <option value="">Select device</option>
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name}
                </option>
              ))}
            </select>
          </div>
          {selectedDevice && (
            <p className="notice">Showing users for {selectedDevice.name}</p>
          )}
          {userLoading && <p className="notice">Loading users...</p>}
          {userError && <p className="notice error">{userError}</p>}
          {userList && (
            <table className="table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Faces</th>
                  <th>Face URL</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {userList.UserInfoSearch?.UserInfo?.map((user) => (
                    <tr key={user.employeeNo}>
                      <td>{user.employeeNo}</td>
                      <td>
                        {editingUser?.employeeNo === user.employeeNo ? (
                          <div className="row">
                            <input
                              className="input"
                              value={editName}
                              onChange={(event) => setEditName(event.target.value)}
                            />
                            <input
                              className="input"
                              type="file"
                              accept="image/*"
                              onChange={(event) =>
                                setEditFile(event.target.files ? event.target.files[0] : null)
                              }
                              disabled={editReuseFace}
                            />
                          </div>
                        ) : (
                          user.name
                        )}
                      </td>
                      <td>
                        {editingUser?.employeeNo === user.employeeNo ? (
                          <div className="row">
                            <select
                              className="select"
                              value={editGender}
                              onChange={(event) => setEditGender(event.target.value)}
                            >
                              {genders.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            <label className="label">
                              <input
                                type="checkbox"
                                checked={editNewId}
                                onChange={(event) => setEditNewId(event.target.checked)}
                              />
                              New ID
                            </label>
                            <label className="label">
                              <input
                                type="checkbox"
                                checked={editReuseFace}
                                onChange={(event) => setEditReuseFace(event.target.checked)}
                              />
                              Reuse face
                            </label>
                          </div>
                        ) : (
                          user.gender ?? "-"
                        )}
                      </td>
                      <td>{user.numOfFace ?? "-"}</td>
                      <td>
                        {user.faceURL ? (
                          <a href={user.faceURL} target="_blank" rel="noreferrer">
                            View
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        {editingUser?.employeeNo === user.employeeNo ? (
                          <div className="row">
                            <button className="button" type="button" onClick={saveEditUser}>
                              Save
                            </button>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={cancelEditUser}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="row">
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => startEditUser(user)}
                            >
                              Recreate
                            </button>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => handleDeleteUser(user.employeeNo)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;

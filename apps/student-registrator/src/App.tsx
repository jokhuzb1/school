import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import ExcelJS from "exceljs";
import boySampleImg from "./assets/boy_sample.png";
import girlSampleImg from "./assets/girl_sample.png";
import {
  createDevice,
  deleteDevice,
  deleteUser,
  fetchDevices,
  fetchUsers,
  registerStudent,
  updateDevice,
  fileToBase64,
  recreateUser,
  type DeviceConfig,
  type RegisterResult,
  type UserInfoEntry,
  type UserInfoSearchResponse,
} from "./api";

// Icons as inline SVGs
const Icons = {
  Plus: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Edit: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  ),
  Trash: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  User: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Monitor: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
  Image: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  Search: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  ),
  Check: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  X: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  ),
  Sun: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  Moon: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Upload: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  ),
  Refresh: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
  AlertCircle: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  ),
  FileSpreadsheet: () => (
    <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
    </svg>
  ),
};

// Toast notification types
interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

// Excel import types
interface ExcelRow {
  name: string;
  gender: string;
  className?: string;
  parentName?: string;
  parentPhone?: string;
  imageBase64?: string;
  status: "pending" | "success" | "error";
  error?: string;
}

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

// Sample class list - should come from API
const classes = [
  { value: "", label: "Select Class" },
  { value: "1-A", label: "1-A" },
  { value: "1-B", label: "1-B" },
  { value: "2-A", label: "2-A" },
  { value: "2-B", label: "2-B" },
  { value: "3-A", label: "3-A" },
  { value: "3-B", label: "3-B" },
  { value: "4-A", label: "4-A" },
  { value: "4-B", label: "4-B" },
  { value: "5-A", label: "5-A" },
  { value: "5-B", label: "5-B" },
];

function App() {
  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("theme");
    return (saved as "light" | "dark") || "light";
  });

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const [serverStatus, setServerStatus] = useState<"checking" | "online" | "offline">(
    "checking",
  );
  const [devices, setDevices] = useState<DeviceConfig[]>([]);
  const [deviceForm, setDeviceForm] = useState<Omit<DeviceConfig, "id">>(emptyDevice);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [registerName, setRegisterName] = useState("");
  const [registerGender, setRegisterGender] = useState("male");
  const [registerClass, setRegisterClass] = useState("");
  const [registerParentName, setRegisterParentName] = useState("");
  const [registerParentPhone, setRegisterParentPhone] = useState("");
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
  const [searchQuery, setSearchQuery] = useState("");

  // Excel import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<ExcelRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Image preview URLs
  const registerPreviewUrl = useMemo(
    () => (registerFile ? URL.createObjectURL(registerFile) : null),
    [registerFile]
  );

  const editPreviewUrl = useMemo(
    () => (editFile ? URL.createObjectURL(editFile) : null),
    [editFile]
  );

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
      if (registerPreviewUrl) URL.revokeObjectURL(registerPreviewUrl);
    };
  }, [registerPreviewUrl]);

  useEffect(() => {
    return () => {
      if (editPreviewUrl) URL.revokeObjectURL(editPreviewUrl);
    };
  }, [editPreviewUrl]);

  useEffect(() => {
    fetchDevices()
      .then(setDevices)
      .catch((err) => setDeviceError(String(err)));
  }, []);

  // Health check disabled - Tauri app doesn't need external backend
  useEffect(() => {
    setServerStatus("online"); // Always online for Tauri app
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

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!userList?.UserInfoSearch?.UserInfo) return [];
    if (!searchQuery.trim()) return userList.UserInfoSearch.UserInfo;
    const query = searchQuery.toLowerCase();
    return userList.UserInfoSearch.UserInfo.filter(
      (user) =>
        user.name.toLowerCase().includes(query) ||
        user.employeeNo.toLowerCase().includes(query)
    );
  }, [userList, searchQuery]);

  const handleDeviceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setDeviceError(null);
    setDeviceLoading(true);
    try {
      if (editingId) {
        const updated = await updateDevice(editingId, deviceForm);
        setDevices((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        addToast("Device updated successfully", "success");
      } else {
        const created = await createDevice(deviceForm);
        setDevices((prev) => [...prev, created]);
        addToast("Device added successfully", "success");
      }
      setDeviceForm(emptyDevice);
      setEditingId(null);
    } catch (err) {
      setDeviceError(String(err));
      addToast("Failed to save device", "error");
    } finally {
      setDeviceLoading(false);
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
      addToast("Device removed", "success");
    } catch (err) {
      setDeviceError(String(err));
      addToast("Failed to remove device", "error");
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
      const faceImageBase64 = await fileToBase64(registerFile);
      const result = await registerStudent(
        registerName.trim(),
        registerGender,
        faceImageBase64,
      );
      setRegisterResult(result);
      setRegisterName("");
      setRegisterClass("");
      setRegisterParentName("");
      setRegisterParentPhone("");
      setRegisterFile(null);
      addToast("Student registered successfully", "success");
      if (selectedDeviceId) {
        handleFetchUsers();
      }
    } catch (err) {
      setRegisterError(String(err));
      addToast("Registration failed", "error");
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
      let faceImageBase64: string | undefined;
      if (editFile) {
        faceImageBase64 = await fileToBase64(editFile);
      }
      
      await recreateUser(
        selectedDeviceId,
        editingUser.employeeNo,
        editName.trim(),
        editGender,
        editNewId,
        editReuseFace,
        faceImageBase64,
      );
      cancelEditUser();
      handleFetchUsers();
      addToast("User updated successfully", "success");
    } catch (err) {
      setUserError(String(err));
      addToast("Failed to update user", "error");
    }
  };

  const handleDeleteUser = async (employeeNo: string) => {
    if (!selectedDeviceId) return;
    if (!window.confirm("Delete this user from the device?")) return;
    setUserError(null);
    try {
      await deleteUser(selectedDeviceId, employeeNo);
      handleFetchUsers();
      addToast("User deleted", "success");
    } catch (err) {
      setUserError(String(err));
      addToast("Failed to delete user", "error");
    }
  };

  // Excel import functions
  const parseExcelFile = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new Error("No worksheet found");
    
    // Get images from workbook
    const media = (workbook.model as { media?: Array<{ type: string; name: string; buffer: ArrayBuffer }> }).media || [];
    const worksheetImages = worksheet.getImages();
    
    // Create image map by row
    const imageByRow: Record<number, string> = {};
    for (const img of worksheetImages) {
      const rowNum = img.range.tl.nativeRow + 1; // 1-indexed
      const mediaIndex = typeof img.imageId === 'number' ? img.imageId : parseInt(img.imageId, 10);
      
      // ExcelJS stores media with 0-based index
      const mediaItem = media[mediaIndex];
      if (mediaItem && mediaItem.buffer) {
        const uint8Array = new Uint8Array(mediaItem.buffer);
        let binary = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);
        imageByRow[rowNum] = base64;
      }
    }
    
    // Skip header row and parse data
    const rows: ExcelRow[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      
      const name = String(row.getCell(1).value || "").trim();
      const gender = String(row.getCell(2).value || "unknown").toLowerCase();
      const className = String(row.getCell(3).value || "").trim();
      const parentName = String(row.getCell(4).value || "").trim();
      const parentPhone = String(row.getCell(5).value || "").trim();
      
      if (name) {
        rows.push({
          name,
          gender,
          className: className || undefined,
          parentName: parentName || undefined,
          parentPhone: parentPhone || undefined,
          imageBase64: imageByRow[rowNumber],
          status: "pending",
        });
      }
    });
    
    return rows;
  };

  const handleImportFileSelect = async (file: File) => {
    setImportFile(file);
    try {
      const rows = await parseExcelFile(file);
      setImportData(rows);
    } catch (err) {
      addToast("Failed to parse Excel file", "error");
      setImportFile(null);
    }
  };

  const handleImportDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      handleImportFileSelect(file);
    }
  };

  const startBatchImport = async () => {
    if (importData.length === 0) return;
    
    setIsImporting(true);
    setImportProgress(0);
    setImportTotal(importData.length);
    
    const updatedData = [...importData];
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < updatedData.length; i++) {
      const row = updatedData[i];
      try {
        // Register with face image if available
        await registerStudent(row.name, row.gender, row.imageBase64 || "");
        updatedData[i] = { ...row, status: "success" };
        successCount++;
      } catch (err) {
        updatedData[i] = { ...row, status: "error", error: String(err) };
        errorCount++;
      }
      setImportProgress(i + 1);
      setImportData([...updatedData]);
    }
    
    setIsImporting(false);
    addToast(`Import complete: ${successCount} success, ${errorCount} failed`, successCount > 0 ? "success" : "error");
    
    if (selectedDeviceId) {
      handleFetchUsers();
    }
  };

  const closeImportModal = () => {
    if (isImporting) return;
    setShowImportModal(false);
    setImportFile(null);
    setImportData([]);
    setImportProgress(0);
    setImportTotal(0);
  };

  const downloadTemplate = async () => {
    // Create template workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Students");
    
    // Set column widths
    worksheet.getColumn(1).width = 25; // Name
    worksheet.getColumn(2).width = 12; // Gender
    worksheet.getColumn(3).width = 10; // Class
    worksheet.getColumn(4).width = 25; // Parent Name
    worksheet.getColumn(5).width = 18; // Parent Phone
    worksheet.getColumn(6).width = 15; // Image
    
    // Add header row
    const headerRow = worksheet.addRow(["Name", "Gender", "Class", "Parent Name", "Parent Phone", "Image"]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E7FF" },
    };
    
    // Add sample data rows using array format
    worksheet.addRow(["Aliyev Vali", "male", "5-A", "Aliyev Sobir", "+998901234567", ""]);
    worksheet.addRow(["Karimova Nodira", "female", "3-B", "Karimov Anvar", "+998907654321", ""]);
    
    // Set row heights for images
    worksheet.getRow(2).height = 80;
    worksheet.getRow(3).height = 80;
    
    // Fetch and add images
    try {
      const boyResponse = await fetch(boySampleImg);
      const boyArrayBuffer = await boyResponse.arrayBuffer();
      
      const boyImageId = workbook.addImage({
        buffer: boyArrayBuffer,
        extension: "png",
      });
      worksheet.addImage(boyImageId, {
        tl: { col: 5, row: 1 },
        ext: { width: 60, height: 75 },
      });
      
      const girlResponse = await fetch(girlSampleImg);
      const girlArrayBuffer = await girlResponse.arrayBuffer();
      
      const girlImageId = workbook.addImage({
        buffer: girlArrayBuffer,
        extension: "png",
      });
      worksheet.addImage(girlImageId, {
        tl: { col: 5, row: 2 },
        ext: { width: 60, height: 75 },
      });
    } catch (err) {
      console.error("Could not add sample images:", err);
    }
    
    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "students_template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      {/* Theme Toggle */}
      <button
        className="theme-toggle"
        onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
        title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      >
        {theme === "light" ? <Icons.Moon /> : <Icons.Sun />}
      </button>

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === "success" ? <Icons.Check /> : <Icons.AlertCircle />}
            {toast.message}
          </div>
        ))}
      </div>

      <div className="header">
        <h1>Student Register</h1>
        <p>Register students to up to 6 Hikvision devices on the same LAN.</p>
        <div className="status">
          <span className={`status-dot ${serverStatus}`} />
          {serverStatus === "checking" && "Checking local server..."}
          {serverStatus === "online" && "Local server online"}
          {serverStatus === "offline" && "Local server offline"}
        </div>
      </div>

      <div className="grid">
        <section className="card">
          <h2>Devices</h2>
          <p className="notice">
            Add up to 6 devices. Credentials are stored locally on this machine.
          </p>
          {deviceError && <p className="notice error">{deviceError}</p>}
          <form onSubmit={handleDeviceSubmit} className="device-form">
            <div className="form-group">
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
            </div>
            <div className="row">
              <div className="form-group">
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
              <div className="form-group">
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
              <div className="form-group">
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
              <div className="form-group">
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
              disabled={(!editingId && deviceLimitReached) || deviceLoading}
            >
              {deviceLoading && <span className="spinner" />}
              {editingId ? (
                <>
                  <Icons.Edit />
                  Update Device
                </>
              ) : (
                <>
                  <Icons.Plus />
                  Add Device
                </>
              )}
            </button>
            {deviceLimitReached && !editingId && (
              <p className="notice">Device limit reached (6).</p>
            )}
          </form>

          <div className="device-list">
            {devices.length === 0 ? (
              <div className="empty-state">
                <Icons.Monitor />
                <div className="empty-state-title">No devices added</div>
                <div className="empty-state-text">Add a device to get started</div>
              </div>
            ) : (
              devices.map((device) => (
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
                      <Icons.Edit />
                      Edit
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => handleDeviceDelete(device.id)}
                    >
                      <Icons.Trash />
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
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
          <form onSubmit={handleRegisterSubmit} className="device-form">
            <div className="form-group">
              <label className="label">Student Name</label>
              <input
                className="input"
                value={registerName}
                onChange={(event) => setRegisterName(event.target.value)}
                placeholder="Full name"
                required
              />
            </div>
            <div className="form-group">
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
            </div>
            <div className="form-group">
              <label className="label">Class</label>
              <select
                className="select"
                value={registerClass}
                onChange={(event) => setRegisterClass(event.target.value)}
              >
                {classes.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="row">
              <div className="form-group">
                <label className="label">Parent Name</label>
                <input
                  className="input"
                  value={registerParentName}
                  onChange={(event) => setRegisterParentName(event.target.value)}
                  placeholder="Parent full name"
                />
              </div>
              <div className="form-group">
                <label className="label">Parent Phone</label>
                <input
                  className="input"
                  type="tel"
                  value={registerParentPhone}
                  onChange={(event) => setRegisterParentPhone(event.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </div>
            </div>
            <div className="form-group">
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
              <div className="image-preview">
                {registerPreviewUrl ? (
                  <img src={registerPreviewUrl} alt="Preview" />
                ) : (
                  <div className="image-preview-placeholder">
                    <Icons.Image />
                    <span>No image selected</span>
                  </div>
                )}
              </div>
            </div>
            <button className="button" type="submit" disabled={registerLoading}>
              {registerLoading && <span className="spinner" />}
              <Icons.Upload />
              {registerLoading ? "Registering..." : "Register Student"}
            </button>
          </form>

          <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--neutral-200)" }}>
            <button
              className="button secondary"
              type="button"
              onClick={() => setShowImportModal(true)}
              style={{ width: "100%" }}
            >
              <Icons.FileSpreadsheet />
              Import from Excel
            </button>
          </div>
        </section>

        <section className="card">
          <h2>Registered Users</h2>
          <div className="form-group">
            <label className="label">Select Device</label>
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
            <div className="form-group">
              <div className="search-wrapper">
                <Icons.Search />
                <input
                  className="input"
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}

          {userLoading && <p className="notice">Loading users...</p>}
          {userError && <p className="notice error">{userError}</p>}
          
          {!selectedDeviceId ? (
            <div className="empty-state">
              <Icons.Monitor />
              <div className="empty-state-title">No device selected</div>
              <div className="empty-state-text">Select a device to view users</div>
            </div>
          ) : userList && filteredUsers.length === 0 ? (
            <div className="empty-state">
              <Icons.User />
              <div className="empty-state-title">No users found</div>
              <div className="empty-state-text">
                {searchQuery ? "Try a different search term" : "Register a student to see them here"}
              </div>
            </div>
          ) : userList && filteredUsers.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Gender</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.employeeNo}>
                    <td>{user.employeeNo}</td>
                    <td>
                      {editingUser?.employeeNo === user.employeeNo ? (
                        <input
                          className="input"
                          value={editName}
                          onChange={(event) => setEditName(event.target.value)}
                        />
                      ) : (
                        user.name
                      )}
                    </td>
                    <td>
                      {editingUser?.employeeNo === user.employeeNo ? (
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
                      ) : (
                        user.gender ?? "-"
                      )}
                    </td>
                    <td>
                      {editingUser?.employeeNo === user.employeeNo ? (
                        <div className="row">
                          <button className="button" type="button" onClick={saveEditUser}>
                            <Icons.Check />
                            Save
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={cancelEditUser}
                          >
                            <Icons.X />
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
                            <Icons.Refresh />
                            Recreate
                          </button>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => handleDeleteUser(user.employeeNo)}
                          >
                            <Icons.Trash />
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

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={closeImportModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import from Excel</h3>
              <button className="modal-close" onClick={closeImportModal} disabled={isImporting}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              {!importFile ? (
                <>
                  <div
                    className={`drop-zone ${dragOver ? "dragover" : ""}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleImportDrop}
                    onClick={() => importInputRef.current?.click()}
                  >
                    <Icons.FileSpreadsheet />
                    <div className="drop-zone-text">Drop Excel file here or click to browse</div>
                    <div className="drop-zone-hint">Supports .xlsx and .xls files</div>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      style={{ display: "none" }}
                      onChange={(e) => e.target.files?.[0] && handleImportFileSelect(e.target.files[0])}
                    />
                  </div>
                  <button
                    type="button"
                    className="button secondary"
                    style={{ width: "100%", marginTop: "12px" }}
                    onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
                  >
                    Download Template
                  </button>
                </>
              ) : (
                <>
                  <div className="drop-zone-file">
                    <Icons.FileSpreadsheet />
                    {importFile.name} ({importData.length} students)
                  </div>

                  {isImporting && (
                    <div className="progress-container">
                      <div className="progress-info">
                        <span>Importing...</span>
                        <span>{importProgress} / {importTotal}</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: `${(importProgress / importTotal) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {importData.length > 0 && (
                    <>
                      <div className="import-preview">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Image</th>
                              <th>Name</th>
                              <th>Gender</th>
                              <th>Class</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importData.slice(0, 10).map((row, idx) => (
                              <tr key={idx}>
                                <td>
                                  {row.imageBase64 ? (
                                    <img 
                                      src={`data:image/png;base64,${row.imageBase64}`} 
                                      alt="Preview" 
                                      style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }}
                                    />
                                  ) : (
                                    <span style={{ color: "var(--neutral-400)" }}>—</span>
                                  )}
                                </td>
                                <td>{row.name}</td>
                                <td>{row.gender}</td>
                                <td>{row.className || "—"}</td>
                                <td title={row.error || ""}>
                                  {row.status === "pending" && "—"}
                                  {row.status === "success" && <span style={{ color: "var(--success-600)" }}>✓</span>}
                                  {row.status === "error" && <span style={{ color: "var(--error-600)" }} title={row.error}>✗</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {importData.length > 10 && (
                        <div style={{ fontSize: "13px", color: "var(--neutral-500)", marginTop: "8px" }}>
                          ... and {importData.length - 10} more
                        </div>
                      )}

                      <div className="import-stats">
                        <div className="import-stat success">
                          <Icons.Check />
                          {importData.filter((r) => r.status === "success").length} success
                        </div>
                        <div className="import-stat error">
                          <Icons.X />
                          {importData.filter((r) => r.status === "error").length} failed
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="button secondary" onClick={closeImportModal} disabled={isImporting}>
                Cancel
              </button>
              <button
                className="button"
                onClick={startBatchImport}
                disabled={importData.length === 0 || isImporting}
              >
                {isImporting && <span className="spinner" />}
                {isImporting ? "Importing..." : "Start Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

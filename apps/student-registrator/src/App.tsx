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
  fileToFaceBase64,
  recreateUser,
  base64ToResizedBase64,
  login,
  logout,
  getAuthUser,
  getProvisioning,
  retryProvisioning,

  fetchSchools,
  fetchClasses,
  createClass,
  type DeviceConfig,
  type RegisterResult,
  type ProvisioningDetails,
  type UserInfoEntry,
  type UserInfoSearchResponse,
  type AuthUser,
  type SchoolInfo,
  type ClassInfo,
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
  classId?: string;
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

// Classes come from backend based on selected school

// ============ Login Screen Component ============
interface LoginScreenProps {
  onLogin: (user: AuthUser) => void;
}

function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    
    try {
      const result = await login(email, password);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Student Registrator</h1>
          <p>Tizimga kirish</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="login-error">{error}</div>}
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Parol</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          <button type="submit" className="button" disabled={loading}>
            {loading ? "Kirish..." : "Kirish"}
          </button>
        </form>
      </div>
    </div>
  );
}

function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getAuthUser());
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<string>("");

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

  // Load schools and classes when logged in
  useEffect(() => {
    if (!currentUser) return;
    
    fetchSchools()
      .then((data) => {
        setSchools(data);
        if (data.length === 1) {
          setSelectedSchool(data[0].id);
        }
      })
      .catch((err) => console.error("Failed to fetch schools:", err));
  }, [currentUser]);

  useEffect(() => {
    if (!selectedSchool) {
      setAvailableClasses([]);
      return;
    }
    
    fetchClasses(selectedSchool)
      .then(setAvailableClasses)
      .catch((err) => console.error("Failed to fetch classes:", err));
  }, [selectedSchool]);

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
    setSchools([]);
    setAvailableClasses([]);
    setSelectedSchool("");
  };

  // Show login screen if not authenticated
  if (!currentUser) {
    return <LoginScreen onLogin={setCurrentUser} />;
  }

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
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState<ProvisioningDetails | null>(null);
  const [provLoading, setProvLoading] = useState(false);
  const [provError, setProvError] = useState<string | null>(null);

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

  // Template modal state
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateSelectedSchool, setTemplateSelectedSchool] = useState<string>("");
  const [templateClasses, setTemplateClasses] = useState<ClassInfo[]>([]);
  const [templateSelectedClasses, setTemplateSelectedClasses] = useState<string[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");

  // Import mapping modal state
  const [importSheetMappings, setImportSheetMappings] = useState<{sheet: string; classId: string; className: string; rowCount: number}[]>([]);
  const [importMappingsReady, setImportMappingsReady] = useState(false);
  const [importMappingFilter, setImportMappingFilter] = useState<"all" | "unmapped">("unmapped");
  const [importMappingQuery, setImportMappingQuery] = useState("");

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
    setProvError(null);
    if (!registerFile) {
      setRegisterError("Face image is required.");
      return;
    }

    setRegisterLoading(true);
    try {
      const faceImageBase64 = await fileToFaceBase64(registerFile);
      const result = await registerStudent(
        registerName.trim(),
        registerGender,
        faceImageBase64,
        {
          parentName: registerParentName.trim() || undefined,
          parentPhone: registerParentPhone.trim() || undefined,
          classId: registerClass || undefined,
        },
      );
      setRegisterResult(result);
      if (result.provisioningId) {
        setProvisioningId(result.provisioningId);
      }
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
        faceImageBase64 = await fileToFaceBase64(editFile);
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
    
    // Get images from workbook
    const media = (workbook.model as { media?: Array<{ type: string; name: string; buffer: ArrayBuffer }> }).media || [];
    console.log(`[Parse] Workbook media count: ${media.length}`);
    
    const allRows: ExcelRow[] = [];
    
    // Process each worksheet (each represents a class)
    for (const worksheet of workbook.worksheets) {
      const sheetName = worksheet.name; // This is the class name
      console.log(`[Parse] Processing sheet: "${sheetName}"`);
      
      // Create image map by row for this worksheet
      const worksheetImages = worksheet.getImages();
      console.log(`[Parse] Sheet "${sheetName}" has ${worksheetImages.length} images`);
      const imageByRow: Record<number, string> = {};
      
      for (const img of worksheetImages) {
        const rowNum = img.range.tl.nativeRow + 1; // 1-indexed
        const mediaIndex = typeof img.imageId === 'number' ? img.imageId : parseInt(img.imageId, 10);
        console.log(`[Parse] Image at row ${rowNum}, mediaIndex: ${mediaIndex}`);
        
        const mediaItem = media[mediaIndex];
        if (mediaItem && mediaItem.buffer) {
          const uint8Array = new Uint8Array(mediaItem.buffer);
          console.log(`[Parse] Image buffer size: ${uint8Array.length} bytes`);
          let binary = '';
          for (let i = 0; i < uint8Array.length; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          const base64 = btoa(binary);
          imageByRow[rowNum] = base64;
          console.log(`[Parse] Image added to row ${rowNum}, base64 length: ${base64.length}`);
        } else {
          console.log(`[Parse] No media found for index ${mediaIndex}`);
        }
      }
      
      // Find data start row (skip header rows)
      // New template has: Row 1 (title), Row 2 (info), Row 3 (spacer), Row 4 (headers), Row 5+ (data)
      // Old template: Row 1 (headers), Row 2+ (data)
      let dataStartRow = 2; // Default for old template
      
      worksheet.eachRow((row, rowNumber) => {
        const firstCell = String(row.getCell(1).value || "").trim();
        // Check if this is the header row by looking for "#" or "Name"
        if (firstCell === "#" || firstCell.toLowerCase() === "name" || firstCell.toLowerCase() === "full name") {
          dataStartRow = rowNumber + 1;
        }
      });
      
      // Parse data rows
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber < dataStartRow) return; // Skip header rows
        
        // Determine column layout based on template
        // New: #, Full Name, Gender, Parent Name, Parent Phone, Photo
        // Old: Name, Gender, Class, Parent Name, Parent Phone, Image
        const hasNumberColumn = String(row.getCell(1).value || "").trim().match(/^\d+$/);
        
        let name: string, gender: string, parentName: string, parentPhone: string;
        
        if (hasNumberColumn) {
          // New template layout
          name = String(row.getCell(2).value || "").trim();
          gender = String(row.getCell(3).value || "unknown").toLowerCase();
          parentName = String(row.getCell(4).value || "").trim();
          parentPhone = String(row.getCell(5).value || "").trim();
        } else {
          // Old template layout
          name = String(row.getCell(1).value || "").trim();
          gender = String(row.getCell(2).value || "unknown").toLowerCase();
          // Skip old class column (3), use sheet name instead
          parentName = String(row.getCell(4).value || "").trim();
          parentPhone = String(row.getCell(5).value || "").trim();
        }
        
        if (name && !name.startsWith("📚") && !name.startsWith("📖") && !name.startsWith("💡")) {
          console.log(`[Parse] Row ${rowNumber}: name="${name}", gender="${gender}", class="${sheetName}", hasImage=${!!imageByRow[rowNumber]}`);
          allRows.push({
            name,
            gender,
            className: sheetName, // Use worksheet name as class
            parentName: parentName || undefined,
            parentPhone: parentPhone || undefined,
            imageBase64: imageByRow[rowNumber],
            status: "pending",
          });
        }
      });
    }
    
    console.log(`[Parse] Total rows parsed: ${allRows.length}`);
    return allRows;
  };

	  const handleImportFileSelect = async (file: File) => {
	    console.log(`[Import] File selected: ${file.name}`);
	    setImportFile(file);
	    try {
	      const rows = await parseExcelFile(file);
	      console.log(`[Import] Parsed ${rows.length} rows`);
	      setImportData(rows);
          buildImportMappings(rows);
	    } catch (err) {
	      console.error(`[Import] Parse error:`, err);
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

  const buildImportMappings = (rows: ExcelRow[]) => {
    const classCounts = new Map<string, number>();
    rows.forEach((row) => {
      if (!row.className) return;
      const key = row.className.trim();
      if (!key) return;
      classCounts.set(key, (classCounts.get(key) || 0) + 1);
    });

    const classIdByName = new Map(
      availableClasses.map((cls) => [cls.name.toLowerCase(), cls.id]),
    );

    const mappings = Array.from(classCounts.entries()).map(([sheet, rowCount]) => {
      const matchedId = classIdByName.get(sheet.toLowerCase()) || "";
      const matchedName =
        availableClasses.find((c) => c.id === matchedId)?.name || "";
      return {
        sheet,
        classId: matchedId,
        className: matchedName,
        rowCount,
      };
    });

    setImportSheetMappings(mappings);
    setImportMappingsReady(mappings.length > 0 && mappings.every((m) => m.classId));
  };

  const startBatchImport = async () => {
    if (importData.length === 0) return;
    if (!importMappingsReady) {
      addToast("Sinf moslashni to'liq belgilang", "error");
      return;
    }
    
    setIsImporting(true);
    setImportProgress(0);
    setImportTotal(importData.length);
    
    const updatedData = [...importData];
    let successCount = 0;
    let errorCount = 0;
    
    const classIdByName = new Map(
      importSheetMappings.map((m) => [m.sheet.toLowerCase(), m.classId]),
    );

    for (let i = 0; i < updatedData.length; i++) {
      const row = updatedData[i];
      console.log(`[Import] Processing ${i+1}/${updatedData.length}: ${row.name}`);
      try {
        // Resize image if too large (>200KB)
        let imageBase64 = row.imageBase64 || "";
        if (imageBase64) {
          try {
            imageBase64 = await base64ToResizedBase64(imageBase64);
          } catch (resizeErr) {
            console.warn(`[Import] Could not resize image for ${row.name}:`, resizeErr);
            // Continue without image
            imageBase64 = "";
          }
        }
        
        // Register with face image if available
        console.log(`[Import] Calling registerStudent: name="${row.name}", gender="${row.gender}", hasImage=${!!imageBase64}`);
        const classId = row.className
          ? classIdByName.get(row.className.toLowerCase())
          : undefined;
        if (row.className && !classId) {
          throw new Error(`Class mapping missing: ${row.className}`);
        }

        await registerStudent(row.name, row.gender, imageBase64, {
          parentName: row.parentName,
          parentPhone: row.parentPhone,
          classId,
        });
        console.log(`[Import] Success: ${row.name}`);
        updatedData[i] = { ...row, status: "success" };
        successCount++;
      } catch (err) {
        console.error(`[Import] Error for ${row.name}:`, err);
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
    setImportSheetMappings([]);
    setImportMappingsReady(false);
  };

  // Open template modal and load classes for selected school
  const openTemplateModal = async () => {
    setShowTemplateModal(true);
    setTemplateSelectedClasses([]);
    
    // If user has schoolId, pre-select it
    const schoolId = currentUser?.schoolId || selectedSchool;
    if (schoolId) {
      setTemplateSelectedSchool(schoolId);
      setTemplateLoading(true);
      try {
        const classes = await fetchClasses(schoolId);
        setTemplateClasses(classes);
      } catch (err) {
        console.error("Failed to fetch classes:", err);
        addToast("Sinflarni yuklashda xato", "error");
      } finally {
        setTemplateLoading(false);
      }
    }
  };

  const handleTemplateSchoolChange = async (schoolId: string) => {
    setTemplateSelectedSchool(schoolId);
    setTemplateSelectedClasses([]);
    setTemplateClasses([]);
    
    if (!schoolId) return;
    
    setTemplateLoading(true);
    try {
      const classes = await fetchClasses(schoolId);
      setTemplateClasses(classes);
    } catch (err) {
      console.error("Failed to fetch classes:", err);
      addToast("Sinflarni yuklashda xato", "error");
    } finally {
      setTemplateLoading(false);
    }
  };

  const toggleTemplateClass = (classId: string) => {
    setTemplateSelectedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const selectAllTemplateClasses = () => {
    setTemplateSelectedClasses(templateClasses.map(c => c.id));
  };

  const deselectAllTemplateClasses = () => {
    setTemplateSelectedClasses([]);
  };

  const updateImportMapping = (sheet: string, classId: string) => {
    const className = availableClasses.find((c) => c.id === classId)?.name || "";
    const updated = importSheetMappings.map((m) =>
      m.sheet === sheet ? { ...m, classId, className } : m,
    );
    setImportSheetMappings(updated);
    setImportMappingsReady(updated.length > 0 && updated.every((m) => m.classId));
  };

  const applyImportMappings = () => {
    const classIdBySheet = new Map(
      importSheetMappings.map((m) => [m.sheet.toLowerCase(), m.classId]),
    );
    const updatedRows = importData.map((row) => ({
      ...row,
      classId: row.className
        ? classIdBySheet.get(row.className.toLowerCase())
        : undefined,
    }));
    setImportData(updatedRows);
    setImportMappingFilter("unmapped");
    setImportMappingQuery("");
  };

  const autoMatchImportMappings = () => {
    const classIdByName = new Map(
      availableClasses.map((cls) => [cls.name.toLowerCase(), cls.id]),
    );
    const updated = importSheetMappings.map((m) => {
      if (m.classId) return m;
      const matchedId = classIdByName.get(m.sheet.toLowerCase()) || "";
      const matchedName =
        availableClasses.find((c) => c.id === matchedId)?.name || "";
      return { ...m, classId: matchedId, className: matchedName };
    });
    setImportSheetMappings(updated);
    setImportMappingsReady(updated.length > 0 && updated.every((m) => m.classId));
  };


  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      addToast("Sinf nomini kiriting", "error");
      return;
    }
    
    // Default grade level (parse from name or 0)
    const gradeLevel = parseInt(newClassName) || 0;
    
    setTemplateLoading(true);
    try {
      await createClass(templateSelectedSchool, newClassName, gradeLevel);
      addToast("Sinf muvaffaqiyatli yaratildi", "success");
      setNewClassName("");
      setIsCreatingClass(false);
      
      // Refresh classes
      const classes = await fetchClasses(templateSelectedSchool);
      setTemplateClasses(classes);
    } catch (err: any) {
      console.error("Failed to create class:", err);
      addToast(err.message || "Sinf yaratishda xato", "error");
    } finally {
      setTemplateLoading(false);
    }
  };

  const downloadTemplate = async (classNames: string[]) => {
    // Minimalist soft colors
    const colors = {
      headerBg: "FFF1F5F9",     // Very light gray
      headerText: "FF334155",   // Slate gray
      border: "FFE2E8F0",       // Light border
      white: "FFFFFFFF",
    };

    if (classNames.length === 0) {
      addToast("Kamida bitta sinf tanlang", "error");
      return;
    }
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Student Registrator";
    workbook.created = new Date();

    // Fetch sample images once
    let boyImageId: number | undefined;
    let girlImageId: number | undefined;
    try {
      console.log("[Template] Loading sample images...", { boySampleImg, girlSampleImg });
      const boyResponse = await fetch(boySampleImg);
      const boyArrayBuffer = await boyResponse.arrayBuffer();
      console.log("[Template] Boy image loaded:", boyArrayBuffer.byteLength, "bytes");
      boyImageId = workbook.addImage({ buffer: boyArrayBuffer, extension: "png" });
      
      const girlResponse = await fetch(girlSampleImg);
      const girlArrayBuffer = await girlResponse.arrayBuffer();
      console.log("[Template] Girl image loaded:", girlArrayBuffer.byteLength, "bytes");
      girlImageId = workbook.addImage({ buffer: girlArrayBuffer, extension: "png" });
      console.log("[Template] Images added to workbook:", { boyImageId, girlImageId });
    } catch (err) {
      console.error("Could not load sample images:", err);
    }

    // Create a sheet for each class
    for (const className of classNames) {
      const worksheet = workbook.addWorksheet(className);
      
      // Set column widths
      worksheet.getColumn(1).width = 5;  // #
      worksheet.getColumn(2).width = 28; // Name
      worksheet.getColumn(3).width = 10; // Gender
      worksheet.getColumn(4).width = 24; // Parent Name
      worksheet.getColumn(5).width = 18; // Parent Phone
      worksheet.getColumn(6).width = 14; // Photo

      // Row 1: Column headers (simple, no merged cells)
      const headers = ["#", "Full Name", "Gender", "Parent Name", "Parent Phone", "Photo"];
      const headerRow = worksheet.addRow(headers);
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, size: 10, color: { argb: colors.headerText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colors.headerBg } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          bottom: { style: "thin", color: { argb: colors.border } },
        };
      });
      headerRow.height = 24;

      // Sample data rows
      const sampleData = [
        { name: "Aliyev Vali", gender: "male", parent: "Aliyev Sobir", phone: "+998901234567" },
        { name: "Karimova Nodira", gender: "female", parent: "Karimova Malika", phone: "+998907654321" },
      ];

      sampleData.forEach((student, index) => {
        const row = worksheet.addRow([
          index + 1,
          student.name,
          student.gender,
          student.parent,
          student.phone,
          "",
        ]);
        
        row.height = 65;
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: colNumber === 1 ? "center" : "left", vertical: "middle" };
          cell.border = {
            bottom: { style: "thin", color: { argb: colors.border } },
          };
        });

        // Add sample image using ImagePosition format (tl + ext)
        if (boyImageId !== undefined && girlImageId !== undefined) {
          const imageId = student.gender === "male" ? boyImageId : girlImageId;
          const rowIndex = row.number - 1; // 0-indexed
          worksheet.addImage(imageId, {
            tl: { col: 5, row: rowIndex },
            ext: { width: 60, height: 60 },
          });
        }
      });

      // Add empty rows for user to fill
      for (let i = 0; i < 10; i++) {
        const row = worksheet.addRow([sampleData.length + i + 1, "", "", "", "", ""]);
        row.height = 65;
        row.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: colNumber === 1 ? "center" : "left", vertical: "middle" };
          cell.border = {
            bottom: { style: "thin", color: { argb: colors.border } },
          };
        });
      }
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

  const fetchProvisioning = useCallback(async () => {
    if (!provisioningId) return;
    setProvLoading(true);
    setProvError(null);
    try {
      const data = await getProvisioning(provisioningId);
      setProvisioning(data);
    } catch (err) {
      setProvError(String(err));
    } finally {
      setProvLoading(false);
    }
  }, [provisioningId]);

  const retryFailed = async () => {
    if (!provisioningId || !provisioning?.devices) return;
    const failed = provisioning.devices
      .filter((d) => d.status === "FAILED")
      .map((d) => d.deviceId);
    if (failed.length === 0) {
      addToast("No failed devices to retry", "error");
      return;
    }
    try {
      await retryProvisioning(provisioningId, failed);
      addToast("Retry requested", "success");
      fetchProvisioning();
    } catch (err) {
      addToast(`Retry failed: ${String(err)}`, "error");
    }
  };

  useEffect(() => {
    if (provisioningId) fetchProvisioning();
  }, [provisioningId, fetchProvisioning]);

  const provisioningSummary = useMemo(() => {
    if (!provisioning?.devices) return null;
    const total = provisioning.devices.length;
    const success = provisioning.devices.filter((d) => d.status === "SUCCESS")
      .length;
    const failed = provisioning.devices.filter((d) => d.status === "FAILED")
      .length;
    const pending = total - success - failed;
    return { total, success, failed, pending };
  }, [provisioning]);

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
        <div>
          <h1>Student Register</h1>
          <p>Register students to up to 6 Hikvision devices on the same LAN.</p>
          <div className="status">
            <span className={`status-dot ${serverStatus}`} />
            {serverStatus === "checking" && "Checking local server..."}
            {serverStatus === "online" && "Local server online"}
            {serverStatus === "offline" && "Local server offline"}
          </div>
        </div>
        <div className="user-info">
          <div>
            <div className="user-info-name">{currentUser.name}</div>
            <div className="user-info-role">{currentUser.role}</div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            Chiqish
          </button>
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
          {provisioningId && (
            <div className="notice">
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <strong>Provisioning:</strong> {provisioningId}
                </div>
                <div>
                  <strong>Status:</strong>{" "}
                  {provisioning?.status || (provLoading ? "Loading..." : "Unknown")}
                </div>
                <button
                  type="button"
                  className="button secondary"
                  onClick={fetchProvisioning}
                  disabled={provLoading}
                >
                  <Icons.Refresh />
                  Refresh
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={retryFailed}
                  disabled={provLoading || !provisioningSummary?.failed}
                >
                  <Icons.Refresh />
                  Retry Failed
                </button>
              </div>

              {provError && <p className="notice error" style={{ marginTop: 8 }}>{provError}</p>}

              {provisioningSummary && (
                <div style={{ marginTop: 8, fontSize: 13, color: "var(--neutral-600)" }}>
                  Total: {provisioningSummary.total} | Success: {provisioningSummary.success} | Failed:{" "}
                  {provisioningSummary.failed} | Pending: {provisioningSummary.pending}
                </div>
              )}

              {provisioning?.devices && provisioning.devices.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Device</th>
                        <th>Status</th>
                        <th>Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provisioning.devices.map((link) => (
                        <tr key={link.id}>
                          <td>{link.device?.name || link.deviceId}</td>
                          <td>{link.status}</td>
                          <td>{link.lastError || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
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
                <option value="">Select Class</option>
                {availableClasses.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
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
                    onClick={(e) => { e.stopPropagation(); openTemplateModal(); }}
                  >
                    Shablon Yuklab Olish
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
                  <div style={{ marginTop: "12px" }}>
                    <div style={{ fontWeight: 600, marginBottom: "8px" }}>Sinf Moslash</div>
                    <div className="row" style={{ marginBottom: "12px" }}>
                      <input
                        className="input"
                        placeholder="Sheet nomini qidiring..."
                        value={importMappingQuery}
                        onChange={(e) => setImportMappingQuery(e.target.value)}
                      />
                      <select
                        className="select"
                        value={importMappingFilter}
                        onChange={(e) => setImportMappingFilter(e.target.value as "all" | "unmapped")}
                        style={{ maxWidth: "180px" }}
                      >
                        <option value="unmapped">Faqat moslanmaganlar</option>
                        <option value="all">Barchasi</option>
                      </select>
                      <button
                        type="button"
                        className="button secondary"
                        onClick={autoMatchImportMappings}
                        disabled={availableClasses.length === 0}
                      >
                        Avto-moslash
                      </button>
                      <button
                        type="button"
                        className="button"
                        onClick={applyImportMappings}
                        disabled={!importMappingsReady}
                      >
                        Moslashni saqlash
                      </button>
                    </div>
                    {importSheetMappings.length === 0 ? (
                      <div style={{ color: "var(--neutral-500)" }}>
                        Sinf moslash topilmadi.
                      </div>
                    ) : (
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Sheet</th>
                            <th>Qatorlar</th>
                            <th>Sinf</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importSheetMappings
                            .filter((m) =>
                              importMappingFilter === "unmapped" ? !m.classId : true,
                            )
                            .filter((m) =>
                              importMappingQuery.trim()
                                ? m.sheet.toLowerCase().includes(importMappingQuery.toLowerCase())
                                : true,
                            )
                            .map((m) => (
                              <tr key={m.sheet}>
                                <td>{m.sheet}</td>
                                <td>{m.rowCount}</td>
                                <td>
                                  <select
                                    className="select"
                                    value={m.classId}
                                    onChange={(e) => updateImportMapping(m.sheet, e.target.value)}
                                  >
                                    <option value="">Sinf tanlang</option>
                                    {availableClasses.map((cls) => (
                                      <option key={cls.id} value={cls.id}>
                                        {cls.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    )}
                  </div>

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

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="modal-overlay" onClick={() => setShowTemplateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Shablon Yaratish</h2>
              <button className="modal-close" onClick={() => setShowTemplateModal(false)}>
                <Icons.X />
              </button>
            </div>
            <div className="modal-body">
              {/* School selection */}
              <div className="form-group">
                <label className="label">Maktab</label>
                <select
                  className="select"
                  value={templateSelectedSchool}
                  onChange={(e) => handleTemplateSchoolChange(e.target.value)}
                >
                  <option value="">Tanlang...</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class selection */}
              {templateSelectedSchool && (
                <div className="form-group" style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label className="label">Sinflar</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button type="button" className="button secondary" style={{ padding: "4px 8px", fontSize: "12px" }} onClick={selectAllTemplateClasses}>
                        Barchasi
                      </button>
                      <button type="button" className="button secondary" style={{ padding: "4px 8px", fontSize: "12px" }} onClick={deselectAllTemplateClasses}>
                        Hech biri
                      </button>
                    </div>
                  </div>
                  
                  {templateLoading ? (
                    <div style={{ padding: "20px", textAlign: "center" }}>
                      <span className="spinner" /> Yuklanmoqda...
                    </div>
                  ) : templateClasses.length === 0 ? (
                    <div style={{ padding: "20px", textAlign: "center", color: "var(--neutral-500)" }}>
                      Sinflar topilmadi
                    </div>
                  ) : (
                    <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--neutral-200)", borderRadius: "8px", padding: "8px" }}>
                      {templateClasses.map((cls) => (
                        <label
                          key={cls.id}
                          className="label"
                          style={{ display: "flex", alignItems: "center", padding: "8px", cursor: "pointer", borderRadius: "4px" }}
                        >
                          <input
                            type="checkbox"
                            checked={templateSelectedClasses.includes(cls.id)}
                            onChange={() => toggleTemplateClass(cls.id)}
                          />
                          <span style={{ marginLeft: "8px" }}>
                            {cls.name} {cls.totalStudents ? `(${cls.totalStudents} o'quvchi)` : ""}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create new class */}
              {templateSelectedSchool && (
                <div style={{ marginTop: "16px", borderTop: "1px solid var(--neutral-200)", paddingTop: "16px" }}>
                  {!isCreatingClass ? (
                    <button 
                      type="button" 
                      className="button secondary" 
                      onClick={() => setIsCreatingClass(true)}
                      style={{ width: "100%" }}
                    >
                      <Icons.Plus /> Yangi sinf qo'shish
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        className="input"
                        placeholder="Sinf nomi (masalan: 7-A)"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        autoFocus
                      />
                      <button 
                        type="button" 
                        className="button" 
                        onClick={handleCreateClass}
                        disabled={templateLoading}
                      >
                        {templateLoading ? <span className="spinner" /> : "Saqlash"}
                      </button>
                      <button 
                        type="button" 
                        className="button secondary" 
                        onClick={() => {
                          setIsCreatingClass(false);
                          setNewClassName("");
                        }}
                        disabled={templateLoading}
                      >
                        <Icons.X />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="button secondary" onClick={() => setShowTemplateModal(false)}>
                Bekor qilish
              </button>
              <button
                className="button"
                onClick={() => {
                  const selectedClassNames = templateClasses
                    .filter((c) => templateSelectedClasses.includes(c.id))
                    .map((c) => c.name);
                  downloadTemplate(selectedClassNames);
                  setShowTemplateModal(false);
                }}
                disabled={templateSelectedClasses.length === 0}
              >
                <Icons.FileSpreadsheet />
                Yuklab olish ({templateSelectedClasses.length} sinf)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

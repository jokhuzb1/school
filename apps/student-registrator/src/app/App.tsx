import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getAuthUser, logout } from "../api";
import { LoginScreen } from "../components/auth/LoginScreen";
import { ToastContainer } from "../components/ui/Toast";
import { useTheme } from "../hooks/useTheme";
import { AddStudentsPage } from "../pages/AddStudentsPage";
import { AuditLogsPage } from "../pages/AuditLogsPage";
import { ClassesPage } from "../pages/ClassesPage";
import { DeviceDetailPage } from "../pages/DeviceDetailPage";
import { DevicesPage } from "../pages/DevicesPage";
import { StudentsPage } from "../pages/StudentsPage";
import { ToastContext } from "./providers/toast/ToastContext";
import { useToastState } from "../shared/hooks/useToastState";
import type { AuthUser } from "../types";
import { Layout } from "../widgets/layout";

const ALLOWED_DESKTOP_ROLES = new Set(["SCHOOL_ADMIN", "TEACHER"]);

function getAllowedAuthUser(): AuthUser | null {
  const user = getAuthUser();
  if (!user) return null;
  if (!ALLOWED_DESKTOP_ROLES.has(user.role)) {
    logout();
    return null;
  }
  return user;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getAllowedAuthUser());
  const { theme, toggleTheme } = useTheme();
  const toastState = useToastState();

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  useEffect(() => {
    if (!currentUser) return;
    if (ALLOWED_DESKTOP_ROLES.has(currentUser.role)) return;
    logout();
    setCurrentUser(null);
  }, [currentUser]);

  if (!currentUser) {
    return (
      <ToastContext.Provider value={toastState}>
        <LoginScreen onLogin={setCurrentUser} />
        <ToastContainer toasts={toastState.toasts} />
      </ToastContext.Provider>
    );
  }

  return (
    <ToastContext.Provider value={toastState}>
      <BrowserRouter>
        <Layout user={currentUser} theme={theme} onToggleTheme={toggleTheme} onLogout={handleLogout}>
          <Routes>
            <Route path="/" element={<Navigate to="/add-students" replace />} />
            <Route path="/add-students" element={<AddStudentsPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/classes" element={<ClassesPage />} />
            <Route path="/devices" element={<DevicesPage />} />
            <Route path="/devices/:id" element={<DeviceDetailPage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="*" element={<Navigate to="/add-students" replace />} />
          </Routes>
        </Layout>
        <ToastContainer toasts={toastState.toasts} />
      </BrowserRouter>
    </ToastContext.Provider>
  );
}

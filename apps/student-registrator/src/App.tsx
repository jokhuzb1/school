import { useState, createContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuthUser, logout } from './api';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';
import { Layout } from './components/layout/Layout';
import { LoginScreen } from './components/auth/LoginScreen';
import { ToastContainer } from './components/ui/Toast';
import { AddStudentsPage } from './pages/AddStudentsPage';
import { StudentsPage } from './pages/StudentsPage';
import { DevicesPage } from './pages/DevicesPage';
import { DeviceDetailPage } from './pages/DeviceDetailPage';
import { ClassesPage } from './pages/ClassesPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import type { AuthUser } from './types';

// Toast context
export const ToastContext = createContext<ReturnType<typeof useToast> | null>(null);

function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getAuthUser());
  const { theme, toggleTheme } = useTheme();
  const toastState = useToast();

  const handleLogout = () => {
    logout();
    setCurrentUser(null);
  };

  // Show login if not authenticated
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
        <Layout
          user={currentUser}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
        >
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

export default App;

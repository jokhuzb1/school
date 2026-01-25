import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AppAntd } from 'antd';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Attendance from './pages/Attendance';
import Classes from './pages/Classes';
import Devices from './pages/Devices';
import Holidays from './pages/Holidays';
import Settings from './pages/Settings';
import Schools from './pages/Schools';

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AppAntd>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />

              {/* Protected routes with layout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                {/* Super Admin routes */}
                <Route path="schools" element={<Schools />} />
                <Route path="settings" element={<Settings />} />

                {/* School-specific routes */}
                <Route path="schools/:schoolId/dashboard" element={<Dashboard />} />
                <Route path="schools/:schoolId/students" element={<Students />} />
                <Route path="schools/:schoolId/attendance" element={<Attendance />} />
                <Route path="schools/:schoolId/classes" element={<Classes />} />
                <Route path="schools/:schoolId/devices" element={<Devices />} />
                <Route path="schools/:schoolId/holidays" element={<Holidays />} />
                <Route path="schools/:schoolId/settings" element={<Settings />} />

                {/* Student detail (no school prefix needed) */}
                <Route path="students/:id" element={<StudentDetail />} />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </AppAntd>
    </ConfigProvider>
  );
}

export default App;

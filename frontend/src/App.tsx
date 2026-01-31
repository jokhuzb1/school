import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ConfigProvider, App as AppAntd } from "antd";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute, Layout } from "./shared/ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import Attendance from "./pages/Attendance";
import Classes from "./pages/Classes";
import ClassDetail from "./pages/ClassDetail";
import Devices from "./pages/Devices";
import Holidays from "./pages/Holidays";
import Settings from "./pages/Settings";
import Schools from "./pages/Schools";
import Users from "./pages/Users";
import { UiGallery } from "./shared/ui";
import Cameras from "./pages/Cameras";
import CamerasSuperAdmin from "./pages/CamerasSuperAdmin";

function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#1890ff",
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
                <Route
                  path="dashboard"
                  element={
                    <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                      <SuperAdminDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Super Admin routes */}
                <Route
                  path="schools"
                  element={
                    <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                      <Schools />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="cameras"
                  element={
                    <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                      <CamerasSuperAdmin />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <ProtectedRoute requiredRoles={["SUPER_ADMIN"]}>
                      <Settings />
                    </ProtectedRoute>
                  }
                />

                {/* School-specific routes */}
                <Route
                  path="schools/:schoolId/dashboard"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}
                    >
                      <Dashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/students"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}
                    >
                      <Students />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/attendance"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}
                    >
                      <Attendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/classes"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}
                    >
                      <Classes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/classes/:classId"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}
                    >
                      <ClassDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/cameras"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]}
                    >
                      <Cameras />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/devices"
                  element={
                    <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "GUARD"]}>
                      <Devices />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/holidays"
                  element={
                    <ProtectedRoute requiredRoles={["SCHOOL_ADMIN"]}>
                      <Holidays />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="schools/:schoolId/users"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "SUPER_ADMIN"]}
                    >
                      <Users />
                    </ProtectedRoute>
                  }
                />
              <Route
                path="schools/:schoolId/settings"
                element={
                  <ProtectedRoute requiredRoles={["SCHOOL_ADMIN"]}>
                    <Settings />
                  </ProtectedRoute>
                }
              />

              {/* Dev-only UI gallery */}
              {import.meta.env.DEV && (
                <Route path="ui-gallery" element={<UiGallery />} />
              )}

              {/* Student detail (no school prefix needed) */}
                <Route
                  path="students/:id"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}
                    >
                      <StudentDetail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="classes/:classId"
                  element={
                    <ProtectedRoute
                      requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}
                    >
                      <ClassDetail />
                    </ProtectedRoute>
                  }
                />
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

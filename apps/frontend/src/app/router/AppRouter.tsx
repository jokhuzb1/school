import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { Layout } from "@widgets/layout";
import Login from "@pages/Login";
import Dashboard from "@pages/Dashboard";
import SuperAdminDashboard from "@pages/SuperAdminDashboard";
import Students from "@pages/Students";
import StudentDetail from "@pages/StudentDetail";
import Attendance from "@pages/Attendance";
import Classes from "@pages/Classes";
import ClassDetail from "@pages/ClassDetail";
import Devices from "@pages/Devices";
import Holidays from "@pages/Holidays";
import Schools from "@pages/Schools";
import Users from "@pages/Users";
import Cameras from "@pages/Cameras";
import CamerasSuperAdmin from "@pages/CamerasSuperAdmin";
import { UiGallery } from "@shared/ui";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

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
            path="schools/:schoolId/dashboard"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/students"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <Students />
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/attendance"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <Attendance />
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/classes"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <Classes />
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/classes/:classId"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <ClassDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/cameras"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "GUARD", "SUPER_ADMIN"]}>
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
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "SUPER_ADMIN"]}>
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="schools/:schoolId/students/:id"
            element={
              <ProtectedRoute requiredRoles={["SCHOOL_ADMIN", "TEACHER", "GUARD"]}>
                <StudentDetail />
              </ProtectedRoute>
            }
          />

          {import.meta.env.DEV && <Route path="ui-gallery" element={<UiGallery />} />}
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

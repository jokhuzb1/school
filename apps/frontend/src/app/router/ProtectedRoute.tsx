import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "@entities/auth";
import { protectedRouteContainerStyle } from "@shared/ui/styles";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "GUARD";
  requiredRoles?: Array<"SUPER_ADMIN" | "SCHOOL_ADMIN" | "TEACHER" | "GUARD">;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, requiredRoles }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={protectedRouteContainerStyle}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  const roles = requiredRoles || (requiredRole ? [requiredRole] : undefined);
  const role = user?.role;

  if (roles && role !== "SUPER_ADMIN" && (!role || !roles.includes(role))) {
    if (user?.schoolId) {
      return <Navigate to={`/schools/${user.schoolId}/dashboard`} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

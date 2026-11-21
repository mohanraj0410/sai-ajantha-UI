import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spin, Typography } from "antd";
import { useAuth } from "../../auth/AuthContext";
import type { StaffPermission } from "../../api/adminClient";
import { AccessDeniedPage } from "../../pages/AccessDeniedPage";

export const RequireAuth: React.FC = () => {
  const { isAuthenticated, authLoading } = useAuth();
  const location = useLocation();

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "#F4F6F9",
        }}
      >
        <Spin size="large" />
        <Typography.Text type="secondary">Verifying staff session...</Typography.Text>
      </div>
    );
  }

  if (!isAuthenticated) {
    const dest = `${location.pathname}${location.search}`;
    const safeRedirect = dest.startsWith("/") && !dest.startsWith("//") ? dest : "/dashboard";
    return <Navigate to={`/login?redirect=${encodeURIComponent(safeRedirect)}`} replace />;
  }

  return <Outlet />;
};

export const RequirePermission: React.FC<{
  permission?: StaffPermission;
  children: React.ReactNode;
}> = ({ permission, children }) => {
  const { hasPermission } = useAuth();
  if (!hasPermission(permission)) {
    return <AccessDeniedPage requiredPermission={permission} />;
  }
  return <>{children}</>;
};

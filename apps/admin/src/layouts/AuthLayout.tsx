import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Button, Layout, Tooltip } from "antd";
import { BulbOutlined, MoonOutlined } from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";

export const AuthLayout: React.FC = () => {
  const { isAuthenticated, themeMode, toggleTheme } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <Layout
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        background:
          themeMode === "dark"
            ? "linear-gradient(135deg, #071525 0%, #0B1F35 60%, #102D4D 100%)"
            : "linear-gradient(135deg, #F4F6F9 0%, #E6F4F3 100%)",
      }}
    >
      <div style={{ position: "absolute", top: 18, right: 18 }}>
        <Tooltip title={`Switch to ${themeMode === "light" ? "Dark" : "Light"} Mode`}>
          <Button
            shape="circle"
            icon={themeMode === "light" ? <MoonOutlined /> : <BulbOutlined />}
            onClick={toggleTheme}
            aria-label="Toggle theme mode"
          />
        </Tooltip>
      </div>
      <div style={{ width: "100%", maxWidth: 460 }}>
        <Outlet />
      </div>
    </Layout>
  );
};

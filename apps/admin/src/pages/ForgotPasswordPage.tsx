import React from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Space, Typography } from "antd";
import { ArrowLeftOutlined, KeyOutlined } from "@ant-design/icons";
import { BRAND_TOKENS } from "../theme/antdTheme";
import businessLogo from "../../assets/logo.png";

export const ForgotPasswordPage: React.FC = () => {
  return (
    <Card
      bordered
      styles={{ body: { padding: "32px 28px" } }}
      style={{
        width: "100%",
        borderRadius: 18,
        boxShadow: "0 16px 40px rgba(11, 31, 53, 0.12)",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img
          src={businessLogo}
          alt="Sai Ajantha"
          style={{ height: 38, width: "auto", marginBottom: 14 }}
        />
        <Typography.Title level={4} style={{ margin: 0, fontWeight: 700 }}>
          Staff Password Reset
        </Typography.Title>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          Account recovery for Sai Ajantha Admin Portal staff
        </Typography.Text>
      </div>

      <Alert
        type="info"
        showIcon
        icon={<KeyOutlined />}
        message="Administrator Reset Required"
        description="Self-service email password reset is disabled for staff security. Please contact the Super Administrator in Trichy to reset your staff credentials via Settings → Staff."
        style={{ borderRadius: 10, marginBottom: 22 }}
      />

      <Space direction="vertical" style={{ width: "100%" }} size={10}>
        <Link to="/login" style={{ display: "block" }}>
          <Button type="primary" block icon={<ArrowLeftOutlined />} style={{ height: 42 }}>
            Back to Sign In
          </Button>
        </Link>
        <Typography.Text
          type="secondary"
          style={{ display: "block", textAlign: "center", fontSize: 12, color: BRAND_TOKENS.textMutedLight }}
        >
          Need help? Reach your Super Admin or operations manager.
        </Typography.Text>
      </Space>
    </Card>
  );
};

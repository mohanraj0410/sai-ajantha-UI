import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Card, Checkbox, Flex, Form, Input, Space, Typography } from "antd";
import { LockOutlined, MailOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { AdminApiError } from "../api/adminClient";
import { BRAND_TOKENS } from "../theme/antdTheme";
import { emailRules, requiredTrimRule } from "../utils/formValidation";
import businessLogo from "../../assets/logo.png";

interface LoginFormValues {
  email: string;
  password: string;
  remember: boolean;
}

export const LoginPage: React.FC = () => {
  const { signIn, themeMode } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const safeRedirect =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && rawRedirect !== "/login"
      ? rawRedirect
      : "/dashboard";

  const onFinish = async (values: LoginFormValues) => {
    setAuthError(null);
    setSubmitting(true);
    try {
      await signIn(values.email.trim(), values.password, values.remember);
      navigate(safeRedirect, { replace: true });
    } catch (err) {
      if (err instanceof AdminApiError || err instanceof Error) {
        setAuthError(err.message);
      } else {
        setAuthError("Unable to sign in. Please verify your email and password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

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
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div
          style={{
            display: "inline-flex",
            padding: themeMode === "dark" ? "8px 14px" : "4px 0",
            borderRadius: 10,
            background: themeMode === "dark" ? "#FFFFFF" : "transparent",
            marginBottom: 14,
          }}
        >
          <img
            src={businessLogo}
            alt="Sai Ajantha Interior Solutions"
            style={{ height: 42, width: "auto", objectFit: "contain" }}
          />
        </div>
        <Typography.Title level={3} style={{ margin: 0, fontWeight: 800 }}>
          Staff Admin Sign In
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: "block", marginTop: 4, fontSize: 13.5 }}>
          Enter your staff email and password to open the operations portal.
        </Typography.Text>
      </div>

      {authError && (
        <Alert
          type="error"
          showIcon
          message="Sign In Failed"
          description={authError}
          style={{ marginBottom: 18, borderRadius: 10 }}
        />
      )}

      <Form<LoginFormValues>
        layout="vertical"
        requiredMark={false}
        initialValues={{ email: "", password: "", remember: true }}
        onFinish={onFinish}
        size="large"
      >
        <Form.Item label="Staff Email" name="email" rules={emailRules(true)}>
          <Input
            prefix={<MailOutlined style={{ color: "#94A3B8" }} />}
            placeholder="admin@sai-ajanta.com"
            autoComplete="email"
          />
        </Form.Item>

        <Form.Item
          label="Password"
          name="password"
          rules={[requiredTrimRule("Enter your password.")]}
        >
          <Input.Password
            prefix={<LockOutlined style={{ color: "#94A3B8" }} />}
            placeholder="Enter password"
            autoComplete="current-password"
          />
        </Form.Item>

        <Flex justify="space-between" align="center" style={{ marginBottom: 20 }}>
          <Form.Item name="remember" valuePropName="checked" noStyle>
            <Checkbox>Keep me signed in</Checkbox>
          </Form.Item>
          <Link to="/forgot-password" style={{ color: BRAND_TOKENS.teal, fontWeight: 600, fontSize: 13 }}>
            Forgot password?
          </Link>
        </Flex>

        <Button
          type="primary"
          htmlType="submit"
          block
          loading={submitting}
          style={{ height: 44, fontSize: 15, fontWeight: 700 }}
        >
          {submitting ? "Signing In..." : "Sign In"}
        </Button>
      </Form>

      <div
        style={{
          marginTop: 22,
          paddingTop: 16,
          borderTop: "1px solid rgba(148, 163, 184, 0.2)",
          textAlign: "center",
        }}
      >
        <Space size={6}>
          <SafetyCertificateOutlined style={{ color: BRAND_TOKENS.teal }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Authorized Sai Ajantha staff only. Role permissions apply.
          </Typography.Text>
        </Space>
      </div>
    </Card>
  );
};

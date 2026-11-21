import React from "react";
import { Alert, Button, Card, Empty, Result, Skeleton, Space, Typography } from "antd";
import { ReloadOutlined, LockOutlined, InfoCircleOutlined } from "@ant-design/icons";

export const AdminLoadingState: React.FC<{ rows?: number; title?: string }> = ({
  rows = 5,
  title,
}) => (
  <Card bordered style={{ borderRadius: 14 }}>
    {title && (
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 14 }}>
        {title}
      </Typography.Text>
    )}
    <Skeleton active paragraph={{ rows }} />
  </Card>
);

export const AdminEmptyState: React.FC<{
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ title, description, actionLabel, onAction }) => (
  <Card bordered style={{ borderRadius: 14, textAlign: "center", padding: "24px 16px" }}>
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text strong style={{ fontSize: 15 }}>
            {title}
          </Typography.Text>
          {description && (
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              {description}
            </Typography.Text>
          )}
        </Space>
      }
    >
      {actionLabel && onAction && (
        <Button type="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Empty>
  </Card>
);

export const AdminErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = "Could not load data", message, onRetry }) => (
  <Alert
    type="error"
    showIcon
    message={title}
    description={message}
    style={{ borderRadius: 12 }}
    action={
      onRetry ? (
        <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
          Retry
        </Button>
      ) : undefined
    }
  />
);

export const AdminPermissionState: React.FC<{ permission?: string; onBack?: () => void }> = ({
  permission,
  onBack,
}) => (
  <Card bordered style={{ borderRadius: 14 }}>
    <Result
      status="403"
      icon={<LockOutlined style={{ color: "#D97706" }} />}
      title="Access Restricted"
      subTitle={
        permission
          ? `Your staff role does not include the "${permission}" permission needed to view this page.`
          : "Your current staff role does not have permission to open this section."
      }
      extra={
        onBack && (
          <Button type="primary" onClick={onBack}>
            Back to Dashboard
          </Button>
        )
      }
    />
  </Card>
);

export const AdminBlockedApiBanner: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <Alert
    type="info"
    showIcon
    icon={<InfoCircleOutlined />}
    message={<Typography.Text strong>{title}</Typography.Text>}
    description={description}
    action={action}
    style={{ borderRadius: 12, marginBottom: 16 }}
  />
);

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class AdminErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || "An unexpected error occurred in the Admin Portal.",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Card bordered style={{ maxWidth: 520, width: "100%", borderRadius: 14 }}>
            <Result
              status="error"
              title="Something went wrong"
              subTitle={this.state.errorMessage}
              extra={
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={() => window.location.reload()}
                >
                  Reload Admin Portal
                </Button>
              }
            />
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

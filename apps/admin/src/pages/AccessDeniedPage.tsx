import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Result } from "antd";
import { LockOutlined } from "@ant-design/icons";
import type { StaffPermission } from "../api/adminClient";

export const AccessDeniedPage: React.FC<{ requiredPermission?: StaffPermission }> = ({
  requiredPermission,
}) => {
  const navigate = useNavigate();

  return (
    <Card bordered style={{ borderRadius: 14 }}>
      <Result
        status="403"
        icon={<LockOutlined style={{ color: "#D97706" }} />}
        title="Access Restricted"
        subTitle={
          requiredPermission
            ? `Your account does not have the "${requiredPermission}" permission required to view this section.`
            : "Your staff role does not have permission to access this screen."
        }
        extra={
          <Button type="primary" onClick={() => navigate("/dashboard")}>
            Back to Dashboard
          </Button>
        }
      />
    </Card>
  );
};

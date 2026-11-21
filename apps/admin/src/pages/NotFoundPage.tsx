import React from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Result } from "antd";

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card bordered style={{ borderRadius: 14 }}>
      <Result
        status="404"
        title="Page Not Found"
        subTitle="The admin page you requested does not exist or has moved."
        extra={
          <Button type="primary" onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        }
      />
    </Card>
  );
};

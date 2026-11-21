import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useAdminMutations, usePortalData } from "../api/adminQueries";
import {
  AdminPageHeader,
  AdminSectionCard,
  AdminStatusTag,
  formatDate,
  formatInr,
} from "../components/common/AdminPrimitives";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from "../components/common/AdminStateView";
import { useAdminToast } from "../components/common/AdminToastProvider";

export const PartnerDetailPage: React.FC<{ backPath: string; titlePrefix: string }> = ({
  backPath,
  titlePrefix,
}) => {
  const { customerId, dealerId, distributorId } = useParams();
  const targetId = customerId || dealerId || distributorId;
  const navigate = useNavigate();
  const { staff } = useAuth();
  const { showToast } = useAdminToast();
  const portal = usePortalData(staff?.email || "anon");
  const { updateCustomerProfile } = useAdminMutations();
  const [confirmModal, setConfirmModal] = useState<"APPROVE" | "REJECT" | "SUSPEND" | null>(null);
  const [reasonNote, setReasonNote] = useState("");

  if (portal.isLoading) return <AdminLoadingState rows={5} title="Loading profile..." />;
  if (portal.isError) {
    return (
      <AdminErrorState
        message={portal.error instanceof Error ? portal.error.message : "Failed to load account."}
        onRetry={() => void portal.refetch()}
      />
    );
  }

  const account = (portal.data?.users || []).find((u) => u.id === targetId);
  if (!account) {
    return (
      <AdminEmptyState
        title="Account not found"
        description={`No customer or trade profile matches "${targetId}".`}
        actionLabel="Return to Directory"
        onAction={() => navigate(backPath)}
      />
    );
  }

  const matchedOrders = (portal.data?.orders || []).filter(
    (o) =>
      o.customer_email === account.email ||
      o.assigned_distributor_id === account.id ||
      o.assigned_dealer_id === account.id
  );

  const handleRoleChange = async (nextRole: "CUSTOMER" | "DEALER" | "DISTRIBUTOR") => {
    try {
      await updateCustomerProfile.mutateAsync({
        customerId: account.id,
        payload: { role: nextRole },
      });
      showToast(`Updated account pricing tier to ${nextRole}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update role.", "error");
    }
  };

  const handleApprove = async () => {
    try {
      await updateCustomerProfile.mutateAsync({
        customerId: account.id,
        payload: { status: "ACTIVE" },
      });
      showToast(`${account.name} approved successfully.`, "success");
      setConfirmModal(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to approve account.", "error");
    }
  };

  const handleReject = async () => {
    try {
      await updateCustomerProfile.mutateAsync({
        customerId: account.id,
        payload: {
          status: "REJECTED",
          ...(reasonNote.trim() ? { rejection_reason: reasonNote.trim() } : {}),
        },
      });
      showToast(`${account.name} application rejected.`, "warning");
      setConfirmModal(null);
      setReasonNote("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to reject application.", "error");
    }
  };

  const handleSuspend = async () => {
    try {
      await updateCustomerProfile.mutateAsync({
        customerId: account.id,
        payload: {
          status: "SUSPENDED",
          ...(reasonNote.trim() ? { rejection_reason: reasonNote.trim() } : {}),
        },
      });
      showToast(`${account.name} suspended.`, "warning");
      setConfirmModal(null);
      setReasonNote("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to suspend account.", "error");
    }
  };

  return (
    <div>
      <AdminPageHeader
        title={`${titlePrefix}: ${account.name}`}
        subtitle={`${account.organization || "Individual"} • ${account.email}`}
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: `${titlePrefix}s`, to: backPath },
          { label: account.name },
        ]}
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(backPath)}>
              Back
            </Button>
            {account.approval_status !== "APPROVED" && (
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={updateCustomerProfile.isPending}
                onClick={() => setConfirmModal("APPROVE")}
              >
                Approve Account
              </Button>
            )}
            {account.approval_status === "PENDING_APPROVAL" && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => {
                  setReasonNote("");
                  setConfirmModal("REJECT");
                }}
              >
                Reject Application
              </Button>
            )}
            {account.approval_status === "APPROVED" && (
              <Button
                danger
                icon={<StopOutlined />}
                onClick={() => {
                  setReasonNote("");
                  setConfirmModal("SUSPEND");
                }}
              >
                Suspend Account
              </Button>
            )}
          </>
        }
      />

      {account.role === "DISTRIBUTOR" && (
        <Alert
          type="info"
          showIcon
          style={{ borderRadius: 12, marginBottom: 16 }}
          message="Distributor Dual Workspace Isolation"
          description="Distributors use Buy Stock to purchase from Sai Ajantha and Sell & Fulfil for their regional resale. Private resale data remains isolated from unrelated accounts."
        />
      )}

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={10}>
          <AdminSectionCard title="Account Profile & Pricing Tier">
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Status">
                <AdminStatusTag status={account.approval_status} />
              </Descriptions.Item>
              <Descriptions.Item label="Name">{account.name}</Descriptions.Item>
              <Descriptions.Item label="Organization">{account.organization || "—"}</Descriptions.Item>
              <Descriptions.Item label="Email">{account.email}</Descriptions.Item>
              <Descriptions.Item label="Phone">{account.phone || "—"}</Descriptions.Item>
              <Descriptions.Item label="City / District">{account.business_city || "—"}</Descriptions.Item>
              <Descriptions.Item label="GSTIN">{account.gstin || "Not provided"}</Descriptions.Item>
              <Descriptions.Item label="Registered">{formatDate(account.created_at)}</Descriptions.Item>
            </Descriptions>

            <div>
              <Typography.Text strong style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
                Commercial Price Tier
              </Typography.Text>
              <Select
                value={account.role}
                onChange={(v) => void handleRoleChange(v)}
                loading={updateCustomerProfile.isPending}
                style={{ width: "100%" }}
                options={[
                  { label: "Buyer (Public MRP)", value: "CUSTOMER" },
                  { label: "Dealer / Contractor (Dealer Tier)", value: "DEALER" },
                  { label: "Distributor (Buy Stock Wholesale)", value: "DISTRIBUTOR" },
                ]}
              />
            </div>
          </AdminSectionCard>
        </Col>

        <Col xs={24} lg={14}>
          <AdminSectionCard
            title={`Linked Orders (${matchedOrders.length})`}
            subtitle="Orders placed by or assigned to this account"
            noPadding
          >
            <Table
              dataSource={matchedOrders}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8 }}
              scroll={{ x: 560 }}
              onRow={(row) => ({
                onClick: () => navigate(`/orders/${row.id}`),
                style: { cursor: "pointer" },
              })}
              columns={[
                {
                  title: "Order #",
                  dataIndex: "order_number",
                  render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
                },
                {
                  title: "Date",
                  dataIndex: "created_at",
                  render: (v: string) => formatDate(v),
                },
                {
                  title: "Total",
                  dataIndex: "total_inr",
                  align: "right",
                  render: (v: number) => formatInr(v),
                },
                {
                  title: "Payment",
                  dataIndex: "payment_status",
                  align: "center",
                  render: (v: string) => <AdminStatusTag status={v} />,
                },
                {
                  title: "Status",
                  dataIndex: "status",
                  align: "center",
                  render: (v: string) => <AdminStatusTag status={v} />,
                },
              ]}
            />
          </AdminSectionCard>
        </Col>
      </Row>

      <Modal
        open={Boolean(confirmModal)}
        title={
          confirmModal === "APPROVE"
            ? "Approve Trade Account?"
            : confirmModal === "REJECT"
            ? "Reject Trade Application?"
            : "Suspend Account?"
        }
        onCancel={() => {
          setConfirmModal(null);
          setReasonNote("");
        }}
        onOk={() => {
          if (confirmModal === "APPROVE") void handleApprove();
          else if (confirmModal === "REJECT") void handleReject();
          else if (confirmModal === "SUSPEND") void handleSuspend();
        }}
        okText={
          confirmModal === "APPROVE"
            ? "Approve Now"
            : confirmModal === "REJECT"
            ? "Reject Application"
            : "Yes, Suspend"
        }
        okButtonProps={{ danger: confirmModal !== "APPROVE" }}
        confirmLoading={updateCustomerProfile.isPending}
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            {confirmModal === "APPROVE"
              ? `Approve ${account.name} (${account.organization || account.email}) for ${account.role} access?`
              : confirmModal === "REJECT"
              ? `Reject trade application for ${account.name}? They will be informed that their account was not approved.`
              : `Suspend ${account.name}? Trade pricing and portal access will be revoked immediately.`}
          </Typography.Paragraph>
          {confirmModal !== "APPROVE" && (
            <Input.TextArea
              rows={2}
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder={
                confirmModal === "REJECT"
                  ? "Reason for application rejection (e.g. Incomplete GST documentation)"
                  : "Reason for account suspension"
              }
            />
          )}
        </Space>
      </Modal>
    </div>
  );
};

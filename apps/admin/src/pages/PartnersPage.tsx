import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Col,
  Dropdown,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import type { MenuProps, TableProps } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  StopOutlined,
  TeamOutlined,
  UndoOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useAdminMutations, useAdminDataset } from "../api/adminQueries";
import type { PortalUserRow } from "../api/adminClient";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
  formatDate,
} from "../components/common/AdminPrimitives";
import { AdminStatusTabs } from "../components/common/AdminStatusTabs";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { BRAND_TOKENS } from "../theme/antdTheme";
import {
  areFormValuesEqual,
  emailRules,
  gstinRules,
  indianMobileRules,
  normalizePhoneDigits,
  requiredTrimRule,
} from "../utils/formValidation";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

export type PartnerScope =
  | "CUSTOMERS"
  | "DEALERS"
  | "DEALER_APPROVALS"
  | "DISTRIBUTORS"
  | "DISTRIBUTOR_APPROVALS";

export const PartnersPage: React.FC<{ scope: PartnerScope }> = ({ scope }) => {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useAdminToast();
  const { createCustomer, updateCustomerProfile } = useAdminMutations();

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    scope === "DEALER_APPROVALS" || scope === "DISTRIBUTOR_APPROVALS"
      ? "PENDING_APPROVAL"
      : "ALL"
  );
  useEffect(() => { setStatusFilter(scope.endsWith("APPROVALS") ? "PENDING_APPROVAL" : "ALL"); setSearchText(""); }, [scope]);
  const [addOpen, setAddOpen] = useState(false);
  const [addForm] = Form.useForm();
  const [addInitialValues, setAddInitialValues] = useState<Record<string, unknown>>({});
  const [actionModal, setActionModal] = useState<{
    user: PortalUserRow;
    nextStatus: "ACTIVE" | "SUSPENDED" | "REJECTED";
  } | null>(null);
  const [reasonNote, setReasonNote] = useState("");

  const watchedAddForm = Form.useWatch([], addForm);
  const watchedRole = Form.useWatch("role", addForm);
  const isAddDirty = useMemo(
    () => addOpen && !areFormValuesEqual(watchedAddForm || {}, addInitialValues),
    [addOpen, watchedAddForm, addInitialValues]
  );
  const isActionDirty = Boolean(actionModal && reasonNote.trim().length > 0);

  const closeAddModalClean = useCallback(() => {
    setAddOpen(false);
    addForm.resetFields();
  }, [addForm]);

  const closeActionModalClean = useCallback(() => {
    setActionModal(null);
    setReasonNote("");
  }, []);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty: isAddDirty || isActionDirty,
    onDiscard: () => {
      closeAddModalClean();
      closeActionModalClean();
    },
    enabled: addOpen || Boolean(actionModal),
  });

  const role = scope === "CUSTOMERS" ? "CUSTOMER" : scope.startsWith("DEALER") ? "DEALER" : "DISTRIBUTOR";
  const portal = useAdminDataset<PortalUserRow>(staff?.email || "anon", "partners", { role, tab: statusFilter, q: searchText });
  const filtered = portal.data?.items || [];
  const metrics = {
    total: portal.data?.counts.ALL,
    approved: portal.data?.counts.APPROVED,
    pending: portal.data?.counts.PENDING_APPROVAL,
    rejected: portal.data?.counts.REJECTED,
  };

  const pageMeta = useMemo(() => {
    switch (scope) {
      case "CUSTOMERS":
        return {
          title: "Customers",
          subtitle: "Direct homeowner and retail buyers.",
          detailBase: "/customers",
          defaultRole: "CUSTOMER" as const,
        };
      case "DEALER_APPROVALS":
        return {
          title: "Dealer Approvals",
          subtitle: "Review dealer and contractor trade account requests.",
          detailBase: "/dealers",
          defaultRole: "DEALER" as const,
        };
      case "DEALERS":
        return {
          title: "Dealers",
          subtitle: "Dealers and contractors sharing the approved trade tier.",
          detailBase: "/dealers",
          defaultRole: "DEALER" as const,
        };
      case "DISTRIBUTOR_APPROVALS":
        return {
          title: "Distributor Approvals",
          subtitle: "Review regional distributor applications for House of Ajantha.",
          detailBase: "/distributors",
          defaultRole: "DISTRIBUTOR" as const,
        };
      case "DISTRIBUTORS":
        return {
          title: "Distributors",
          subtitle: "Approved regional distributors for Buy Stock and Sell & Fulfil workspaces.",
          detailBase: "/distributors",
          defaultRole: "DISTRIBUTOR" as const,
        };
    }
  }, [scope]);

  const handleConfirmAction = async () => {
    if (!actionModal) return;
    try {
      await updateCustomerProfile.mutateAsync({
        customerId: actionModal.user.id,
        payload: {
          status: actionModal.nextStatus,
          ...(reasonNote.trim() ? { rejection_reason: reasonNote.trim() } : {}),
        },
      });
      const actionLabel =
        actionModal.nextStatus === "ACTIVE"
          ? "Approved"
          : actionModal.nextStatus === "REJECTED"
          ? "Rejected"
          : "Suspended";
      showToast(
        `${actionModal.user.name} marked as ${actionLabel}.`,
        "success"
      );
      allowNextNavigation();
      closeActionModalClean();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update partner status.", "error");
    }
  };

  const handleCreatePartner = async (values: any) => {
    try {
      await createCustomer.mutateAsync({
        name: values.name.trim(),
        company_name: values.companyName?.trim() || values.name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: normalizePhoneDigits(values.phone),
        gstin: values.gstin?.trim().toUpperCase() || undefined,
        city: values.city?.trim() || "Trichy",
        role: values.role,
      });
      showToast(`Created ${values.role.toLowerCase()} account for ${values.name.trim()}.`, "success");
      allowNextNavigation();
      closeAddModalClean();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to create account. Your entries are preserved.", "error");
    }
  };

  const columns: TableProps<PortalUserRow>["columns"] = [
    {
      title: "Name & Firm",
      key: "name",
      width: 240,
      sorter: true,
      render: (_, row) => (
        <div>
          <Typography.Text strong style={{ display: "block" }}>
            {row.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.organization || "Individual"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Contact",
      key: "contact",
      width: 220,
      ellipsis: true,
      render: (_, row) => (
        <div>
          <Typography.Text style={{ display: "block", fontSize: 13 }}>{row.email}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.phone || "—"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "City",
      dataIndex: "business_city",
      key: "business_city",
      width: 130,
      render: (v: string | null) => v || "—",
    },
    {
      title: "GSTIN",
      dataIndex: "gstin",
      key: "gstin",
      width: 165,
      render: (v: string | null) =>
        v ? <Typography.Text code>{v}</Typography.Text> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "Joined",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: "Status",
      dataIndex: "approval_status",
      key: "approval_status",
      align: "center",
      width: 145,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      width: 95,
      fixed: "right",
      render: (_, row) => {
        const items: MenuProps["items"] = [
          {
            key: "view",
            icon: <EyeOutlined />,
            label: "View Profile",
            onClick: () => navigate(`${pageMeta.detailBase}/${row.id}`),
          },
          ...(row.approval_status !== "APPROVED"
            ? [
                {
                  key: "approve",
                  icon: <CheckCircleOutlined style={{ color: "#16A34A" }} />,
                  label: "Approve Account",
                  onClick: () => setActionModal({ user: row, nextStatus: "ACTIVE" }),
                },
              ]
            : []),
          ...(row.approval_status === "PENDING_APPROVAL"
            ? [
                {
                  key: "reject",
                  icon: <StopOutlined />,
                  danger: true,
                  label: "Reject Application",
                  onClick: () => setActionModal({ user: row, nextStatus: "REJECTED" }),
                },
              ]
            : row.approval_status === "APPROVED"
            ? [
                {
                  key: "suspend",
                  icon: <StopOutlined />,
                  danger: true,
                  label: "Suspend Account",
                  onClick: () => setActionModal({ user: row, nextStatus: "SUSPENDED" }),
                },
              ]
            : row.approval_status === "SUSPENDED"
            ? [
                {
                  key: "reactivate",
                  icon: <CheckCircleOutlined style={{ color: "#16A34A" }} />,
                  label: "Reactivate Account",
                  onClick: () => setActionModal({ user: row, nextStatus: "ACTIVE" }),
                },
              ]
            : []),
        ];
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} aria-label={`Actions for ${row.name}`} />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title={pageMeta.title}
        subtitle={pageMeta.subtitle}
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: pageMeta.title },
        ]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              const fresh = {
                role: pageMeta.defaultRole,
                name: "",
                companyName: "",
                email: "",
                phone: "",
                city: "Trichy",
                gstin: "",
              };
              addForm.resetFields();
              addForm.setFieldsValue(fresh);
              setAddInitialValues(fresh);
              setAddOpen(true);
            }}
          >
            Add Account
          </Button>
        }
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Total" value={metrics.total} icon={<TeamOutlined />} accentColor={BRAND_TOKENS.navy} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Approved" value={metrics.approved} icon={<CheckCircleOutlined />} accentColor="#16A34A" highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Pending Approval" value={metrics.pending} icon={<ClockCircleOutlined />} accentColor="#D97706" highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Rejected / Suspended" value={metrics.rejected} icon={<UserDeleteOutlined />} accentColor="#DC2626" highlightTop />
        </Col>
      </Row>

      <AdminStatusTabs query={portal} activeKey={statusFilter} onChange={setStatusFilter}
        items={[{"key":"ALL","label":"All"},{"key":"PENDING_APPROVAL","label":"Pending Approval"},{"key":"APPROVED","label":"Approved"},{"key":"REJECTED","label":"Suspended / Rejected"}]}
        note="" />

      <AdminTable<PortalUserRow>
        title={`${pageMeta.title} Directory`}
        dataSource={filtered}
        pagination={portal.pagination}
        onChange={portal.onTableChange}
        columns={columns}
        rowKey="id"
        loading={portal.isLoading}
        error={portal.isError ? "Failed to load accounts." : null}
        onRetry={() => void portal.refetch()}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search name, company, email, phone, or city..."
        hasActiveFilters={Boolean(searchText)}
        onClearFilters={() => setSearchText("")}
        emptyTitle={`No ${pageMeta.title.toLowerCase()} found`}
        emptyDescription="New registrations appear here automatically, or you can add an account manually."
        emptyActionLabel="Add Account"
        onEmptyAction={() => {
          const fresh = {
            role: pageMeta.defaultRole,
            name: "",
            companyName: "",
            email: "",
            phone: "",
            city: "Trichy",
            gstin: "",
          };
          addForm.resetFields();
          addForm.setFieldsValue(fresh);
          setAddInitialValues(fresh);
          setAddOpen(true);
        }}
        onRefresh={() => void portal.refetch()}
        refreshing={portal.isFetching}
        getExportRows={portal.getExportRows}
        exportFilename={`sai-ajanta-${scope.toLowerCase()}.csv`}
        exportMapper={(u) => ({
          Name: u.name,
          Organization: u.organization,
          Email: u.email,
          Phone: u.phone,
          City: u.business_city || "",
          GSTIN: u.gstin || "",
          Role: u.role,
          Status: u.approval_status,
        })}
        onRowClick={(row) => navigate(`${pageMeta.detailBase}/${row.id}`)}
        renderMobileItem={(row) => (
          <Card
            size="small"
            bordered
            onClick={() => navigate(`${pageMeta.detailBase}/${row.id}`)}
            style={{ borderRadius: 12, cursor: "pointer" }}
          >
            <Flex justify="space-between" align="flex-start" gap={8} style={{ marginBottom: 6 }}>
              <div>
                <Typography.Text strong style={{ display: "block" }}>
                  {row.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {row.organization || row.email}
                </Typography.Text>
              </div>
              <AdminStatusTag status={row.approval_status} />
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginTop: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {row.phone || "—"} • {row.business_city || "—"}
              </Typography.Text>
              {row.approval_status === "PENDING_APPROVAL" && (
                <Button
                  size="small"
                  type="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActionModal({ user: row, nextStatus: "ACTIVE" });
                  }}
                >
                  Approve
                </Button>
              )}
            </Flex>
          </Card>
        )}
      />

      {/* Approve / Reject / Suspend Confirmation Modal */}
      <Modal
        open={Boolean(actionModal)}
        destroyOnClose
        title={
          actionModal?.nextStatus === "ACTIVE"
            ? "Approve Trade Account"
            : actionModal?.nextStatus === "REJECTED"
            ? "Reject Trade Application"
            : "Suspend Account"
        }
        onCancel={() => confirmLeave(closeActionModalClean)}
        onOk={() => void handleConfirmAction()}
        okText={
          actionModal?.nextStatus === "ACTIVE"
            ? "Approve Now"
            : actionModal?.nextStatus === "REJECTED"
            ? "Reject Application"
            : "Confirm Suspend"
        }
        okButtonProps={{ danger: actionModal?.nextStatus !== "ACTIVE" }}
        confirmLoading={updateCustomerProfile.isPending}
      >
        {actionModal && (
          <Space direction="vertical" style={{ width: "100%" }} size={12}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>
              {actionModal.nextStatus === "ACTIVE"
                ? `Approve ${actionModal.user.name} (${actionModal.user.organization || actionModal.user.email}) for ${actionModal.user.role} access?`
                : actionModal.nextStatus === "REJECTED"
                ? `Reject trade application for ${actionModal.user.name}? They will be notified that their registration was not approved.`
                : `Suspend ${actionModal.user.name}? Trade pricing and portal access will be revoked immediately.`}
            </Typography.Paragraph>
            {actionModal.nextStatus !== "ACTIVE" && (
              <Input.TextArea
                rows={2}
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder={
                  actionModal.nextStatus === "REJECTED"
                    ? "Reason for application rejection (e.g. Incomplete business verification documents)"
                    : "Reason for account suspension"
                }
              />
            )}
          </Space>
        )}
      </Modal>

      {/* Add Account Modal */}
      <Modal
        open={addOpen}
        destroyOnClose
        title="Add Customer / Trade Account"
        onCancel={() => confirmLeave(closeAddModalClean)}
        footer={[
          <Button
            key="reset"
            icon={<UndoOutlined />}
            disabled={!isAddDirty || createCustomer.isPending}
            onClick={() => {
              addForm.resetFields();
              addForm.setFieldsValue(addInitialValues);
            }}
          >
            Reset
          </Button>,
          <Button key="cancel" onClick={() => confirmLeave(closeAddModalClean)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createCustomer.isPending}
            disabled={createCustomer.isPending}
            onClick={() => addForm.submit()}
          >
            Create Account
          </Button>,
        ]}
      >
        <Form form={addForm} layout="vertical" onFinish={(v) => void handleCreatePartner(v)}>
          <Form.Item
            label="Account Role"
            name="role"
            rules={[{ required: true, message: "Select an account role." }]}
          >
            <Select
              options={[
                { label: "Buyer (Customer)", value: "CUSTOMER" },
                { label: "Dealer / Contractor", value: "DEALER" },
                { label: "Distributor", value: "DISTRIBUTOR" },
              ]}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Full Name"
                name="name"
                rules={[
                  requiredTrimRule("Enter the person's full name."),
                  { min: 2, message: "Name must be at least 2 characters." },
                ]}
              >
                <Input placeholder="e.g. Ramesh Kumar" maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label={watchedRole === "CUSTOMER" ? "Firm / Shop Name (Optional)" : "Firm / Shop Name"}
                name="companyName"
                dependencies={["role"]}
                rules={
                  watchedRole === "DEALER" || watchedRole === "DISTRIBUTOR"
                    ? [requiredTrimRule("Enter the shop or business name for trade accounts.")]
                    : []
                }
              >
                <Input
                  placeholder={watchedRole === "CUSTOMER" ? "Optional for Buyer" : "e.g. Sri Murugan Hardware"}
                  maxLength={120}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Email" name="email" rules={emailRules(true)}>
                <Input placeholder="name@company.com" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Mobile Number" name="phone" rules={indianMobileRules(true)}>
                <Input placeholder="10-digit Indian mobile" maxLength={15} inputMode="tel" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="City / District" name="city" rules={[requiredTrimRule("Enter the city or district.")]}>
                <Input placeholder="Trichy" maxLength={80} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="GSTIN (Optional)" name="gstin" rules={gstinRules(false)}>
                <Input placeholder="33AAAAA0000A1Z5" maxLength={15} style={{ textTransform: "uppercase" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

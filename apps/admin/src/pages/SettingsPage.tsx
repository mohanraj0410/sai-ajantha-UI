import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import {
  EyeOutlined,
  PlusOutlined,
  SaveOutlined,
  SyncOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import {
  useAdminMutations,
  useAdminSettings,
  useAuditLogs,
  useStaffDirectory,
} from "../api/adminQueries";
import type { StaffAuditEventDto, StaffDirectoryRow } from "../api/adminClient";
import {
  AdminPageHeader,
  AdminSectionCard,
  AdminStatusTag,
  formatDate,
} from "../components/common/AdminPrimitives";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import {
  areFormValuesEqual,
  emailRules,
  requiredTrimRule,
  strongPasswordRules,
} from "../utils/formValidation";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

const STAFF_PERMISSION_MATRIX = [
  { key: "CATALOG_MANAGE", scope: "Products, Categories, 3-Tier Prices & Bulk Import" },
  { key: "ORDERS_MANAGE", scope: "Orders, Dispatch Tracking & Returns Inspection" },
  { key: "CUSTOMERS_MANAGE", scope: "Customer, Dealer & Distributor Approvals" },
  { key: "ANALYTICS_VIEW", scope: "Dashboard & Reports" },
  { key: "ENQUIRIES_MANAGE", scope: "Quotes & Enquiries" },
  { key: "SETTINGS_MANAGE", scope: "Staff Accounts, Settings & Audit Log" },
];

const SCOPED_PERMISSIONS = [
  "CATALOG_MANAGE",
  "ORDERS_MANAGE",
  "CUSTOMERS_MANAGE",
  "ANALYTICS_VIEW",
  "ENQUIRIES_MANAGE",
];

export const SettingsPage: React.FC = () => {
  const { staff } = useAuth();
  const { showToast } = useAdminToast();
  const { syncNas, updateAdminSettings, createStaffUser, updateStaffUser } = useAdminMutations();
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = location.pathname.includes("roles")
    ? "roles"
    : location.pathname.includes("staff")
    ? "staff"
    : location.pathname.includes("audit")
    ? "audit"
    : "general";

  const DEFAULT_PREFS = useMemo(
    () => ({
      display_locale: "en-IN",
      timezone: "Asia/Kolkata",
      default_page_size: 25,
      low_stock_threshold: 10,
      enquiry_alert_email_enabled: true,
      order_dispatch_alert_enabled: true,
    }),
    []
  );

  const DEFAULT_STAFF_FORM = useMemo(
    () => ({
      first_name: "",
      last_name: "",
      email: "",
      password: "",
      permissions: ["CATALOG_MANAGE"],
    }),
    []
  );

  const [settingsForm] = Form.useForm();
  const [staffForm] = Form.useForm();
  const [initialPrefs, setInitialPrefs] = useState<Record<string, unknown>>(DEFAULT_PREFS);
  const hydratedPrefsRef = useRef<string | null>(null);

  const settingsQuery = useAdminSettings(staff?.email || "anon", activeTab === "general");
  const staffDir = useStaffDirectory(staff?.email || "anon", activeTab === "staff");

  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffDirectoryRow | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);

  const watchedPrefs = Form.useWatch([], settingsForm);
  const watchedStaffForm = Form.useWatch([], staffForm);

  const isPrefsDirty = useMemo(
    () =>
      activeTab === "general" &&
      !areFormValuesEqual({ ...DEFAULT_PREFS, ...(watchedPrefs || {}) }, initialPrefs),
    [activeTab, watchedPrefs, initialPrefs, DEFAULT_PREFS]
  );

  const isAddStaffDirty = useMemo(
    () => addStaffOpen && !areFormValuesEqual(watchedStaffForm || {}, DEFAULT_STAFF_FORM),
    [addStaffOpen, watchedStaffForm, DEFAULT_STAFF_FORM]
  );

  const isEditPermsDirty = useMemo(() => {
    if (!editingStaff) return false;
    const orig = [...(editingStaff.permissions || [])].sort();
    const curr = [...editPerms].sort();
    return JSON.stringify(orig) !== JSON.stringify(curr);
  }, [editingStaff, editPerms]);

  const handleResetPrefs = useCallback(() => {
    settingsForm.resetFields();
    settingsForm.setFieldsValue(initialPrefs);
  }, [settingsForm, initialPrefs]);

  const closeAddStaffClean = useCallback(() => {
    setAddStaffOpen(false);
    staffForm.resetFields();
  }, [staffForm]);

  const closeEditPermsClean = useCallback(() => {
    setEditingStaff(null);
    setEditPerms([]);
  }, []);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty: isPrefsDirty || isAddStaffDirty || isEditPermsDirty,
    onDiscard: () => {
      handleResetPrefs();
      closeAddStaffClean();
      closeEditPermsClean();
    },
    enabled: true,
  });

  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(25);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditOutcome, setAuditOutcome] = useState("ALL");
  const [selectedAudit, setSelectedAudit] = useState<StaffAuditEventDto | null>(null);

  useEffect(() => { setAuditPage(1); }, [auditSearch, auditOutcome]);

  const auditLogs = useAuditLogs(
    staff?.email || "anon",
    {
      page: auditPage,
      pageSize: auditPageSize,
      action: auditSearch.trim() || undefined,
      outcome: auditOutcome,
    },
    activeTab === "audit"
  );

  useEffect(() => {
    const s = settingsQuery.data?.settings;
    if (s) {
      const key = `${s.version}:${s.display_locale}:${s.timezone}:${s.default_page_size}:${s.low_stock_threshold}`;
      if (hydratedPrefsRef.current !== key) {
        hydratedPrefsRef.current = key;
        const next = {
          display_locale: s.display_locale,
          timezone: s.timezone,
          default_page_size: [10, 25, 50, 100].includes(Number(s.default_page_size))
            ? Number(s.default_page_size)
            : 25,
          low_stock_threshold: s.low_stock_threshold,
          enquiry_alert_email_enabled: s.enquiry_alert_email_enabled,
          order_dispatch_alert_enabled: s.order_dispatch_alert_enabled,
        };
        settingsForm.resetFields();
        settingsForm.setFieldsValue(next);
        setInitialPrefs(next);
      }
    }
  }, [settingsQuery.data, settingsForm]);

  const handleSaveSettings = async (values: any) => {
    try {
      const res = await updateAdminSettings.mutateAsync({
        display_locale: values.display_locale,
        timezone: values.timezone,
        default_page_size: Number(values.default_page_size),
        low_stock_threshold: Number(values.low_stock_threshold),
        enquiry_alert_email_enabled: Boolean(values.enquiry_alert_email_enabled),
        order_dispatch_alert_enabled: Boolean(values.order_dispatch_alert_enabled),
        expectedVersion: settingsQuery.data?.settings?.version ?? 0,
      });
      setInitialPrefs(values);
      allowNextNavigation();
      showToast(`Saved operational preferences (v${res.settings.version}).`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save settings. Your entries are preserved.",
        "error"
      );
    }
  };

  const handleSyncNas = async () => {
    try {
      await syncNas.mutateAsync();
      showToast("Product media sync completed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Media sync failed.", "error");
    }
  };

  const handleCreateStaff = async (values: any) => {
    try {
      await createStaffUser.mutateAsync({
        email: values.email.trim().toLowerCase(),
        first_name: values.first_name.trim(),
        last_name: values.last_name?.trim() || "",
        password: values.password,
        permissions: values.permissions || ["CATALOG_MANAGE"],
      });
      showToast(`Created staff account ${values.email.trim()}.`, "success");
      allowNextNavigation();
      closeAddStaffClean();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to create staff account. Your entries are preserved.",
        "error"
      );
    }
  };

  const handleToggleStaff = async (row: StaffDirectoryRow) => {
    try {
      await updateStaffUser.mutateAsync({
        staffId: row.id,
        payload: { active: !row.active },
      });
      showToast(`${row.email} ${row.active ? "deactivated" : "reactivated"}.`, "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update staff status.", "error");
    }
  };

  const handleSaveStaffPerms = async () => {
    if (!editingStaff) return;
    if (editPerms.length === 0) {
      showToast("Select at least one permission for this staff account.", "warning");
      return;
    }
    try {
      await updateStaffUser.mutateAsync({
        staffId: editingStaff.id,
        payload: { permissions: editPerms },
      });
      showToast(`Updated permissions for ${editingStaff.email}.`, "success");
      allowNextNavigation();
      closeEditPermsClean();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update permissions.", "error");
    }
  };

  const staffColumns: TableProps<StaffDirectoryRow>["columns"] = [
    {
      title: "Staff Member",
      key: "name",
      width: 220,
      render: (_, r) => (
        <div>
          <Typography.Text strong style={{ display: "block" }}>
            {[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>{r.email}</Typography.Text>
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      width: 130,
      render: (v: string) => <Tag color="geekblue" style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: "Permissions",
      dataIndex: "permissions",
      key: "permissions",
      render: (perms: string[] | undefined) => (
        <Space wrap size={4}>
          {(perms || []).map((p) => (
            <Tag key={p} style={{ margin: 0, fontSize: 11 }}>{p}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "active",
      key: "active",
      align: "center",
      width: 110,
      render: (active: boolean) => <AdminStatusTag status={active ? "ACTIVE" : "SUSPENDED"} />,
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      width: 190,
      fixed: "right",
      render: (_, r) => (
        <Space size={6}>
          <Button
            size="small"
            disabled={r.is_full_admin}
            onClick={() => {
              setEditingStaff(r);
              setEditPerms(r.permissions || []);
            }}
          >
            Permissions
          </Button>
          <Button
            size="small"
            danger={r.active}
            disabled={r.is_full_admin}
            onClick={() => void handleToggleStaff(r)}
          >
            {r.active ? "Disable" : "Enable"}
          </Button>
        </Space>
      ),
    },
  ];

  const auditColumns: TableProps<StaffAuditEventDto>["columns"] = [
    {
      title: "Time",
      dataIndex: "occurred_at",
      key: "occurred_at",
      width: 155,
      render: (v: string) => formatDate(v, true),
    },
    { title: "Staff Actor", dataIndex: "actor_email", key: "actor_email", width: 200, ellipsis: true },
    { title: "Action", dataIndex: "action", key: "action", width: 200, ellipsis: true },
    { title: "Resource", dataIndex: "resource", key: "resource", width: 150, ellipsis: true },
    {
      title: "Outcome",
      dataIndex: "outcome",
      key: "outcome",
      align: "center",
      width: 110,
      render: (v: string) => <AdminStatusTag status={v === "SUCCESS" ? "APPROVED" : "REJECTED"} labelOverride={v} />,
    },
    {
      title: "Details",
      key: "inspect",
      align: "center",
      width: 90,
      render: (_, r) => (
        <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => setSelectedAudit(r)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Settings"
        subtitle="Manage operational preferences, staff permissions, and live audit logs."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Settings" }]}
      />

      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          if (k === "roles") navigate("/settings/roles");
          else if (k === "staff") navigate("/settings/staff");
          else if (k === "audit") navigate("/settings/audit-log");
          else navigate("/settings");
        }}
        style={{ marginBottom: 12 }}
        items={[
          { key: "general", label: "General Preferences" },
          { key: "roles", label: "Role Permissions" },
          { key: "staff", label: "Staff Directory" },
          { key: "audit", label: "Audit Log" },
        ]}
      />

      {activeTab === "general" && (
        <Row gutter={[14, 14]}>
          <Col xs={24} lg={15}>
            <AdminSectionCard
              title="Operations Preferences"
              subtitle="Saved directly in Medusa PostgreSQL"
            >
              <Form
                form={settingsForm}
                layout="vertical"
                initialValues={{
                  display_locale: "en-IN",
                  timezone: "Asia/Kolkata",
                  default_page_size: 25,
                  low_stock_threshold: 10,
                  enquiry_alert_email_enabled: true,
                  order_dispatch_alert_enabled: true,
                }}
                onFinish={(v) => void handleSaveSettings(v)}
              >
                <Row gutter={16}>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Locale & Currency Format" name="display_locale">
                      <Select
                        options={[
                          { label: "India (en-IN, ₹)", value: "en-IN" },
                          { label: "International (en-US)", value: "en-US" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Time Zone" name="timezone">
                      <Select
                        options={[
                          { label: "IST (Asia/Kolkata)", value: "Asia/Kolkata" },
                          { label: "UTC", value: "UTC" },
                        ]}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Default Table Rows" name="default_page_size">
                      <Select options={[10, 25, 50, 100].map((n) => ({ label: `${n} rows`, value: n }))} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item
                      label="Low Stock Alert Threshold"
                      name="low_stock_threshold"
                      rules={[
                        { required: true, message: "Enter a low-stock alert threshold." },
                        { type: "number", min: 1, max: 1000, message: "Enter a whole number between 1 and 1,000." },
                      ]}
                    >
                      <InputNumber min={1} max={1000} precision={0} style={{ width: "100%" }} />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="New Enquiry Email Alerts" name="enquiry_alert_email_enabled" valuePropName="checked">
                      <Switch checkedChildren="On" unCheckedChildren="Off" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} sm={12}>
                    <Form.Item label="Order Dispatch Alerts" name="order_dispatch_alert_enabled" valuePropName="checked">
                      <Switch checkedChildren="On" unCheckedChildren="Off" />
                    </Form.Item>
                  </Col>
                </Row>

                <Space wrap size={10}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={updateAdminSettings.isPending}
                    disabled={updateAdminSettings.isPending}
                  >
                    Save Preferences
                  </Button>
                  <Button
                    icon={<UndoOutlined />}
                    disabled={!isPrefsDirty || updateAdminSettings.isPending}
                    onClick={handleResetPrefs}
                  >
                    Reset
                  </Button>
                  {isPrefsDirty && (
                    <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                      Unsaved Changes
                    </Tag>
                  )}
                </Space>
              </Form>
            </AdminSectionCard>
          </Col>

          <Col xs={24} lg={9}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <AdminSectionCard
                title="Media Library Sync"
                subtitle="Sync local product images from NAS folder"
              >
                <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
                  Refresh matched SKU images from the verified local media directory without altering prices or stock.
                </Typography.Paragraph>
                <Button
                  icon={<SyncOutlined spin={syncNas.isPending} />}
                  loading={syncNas.isPending}
                  onClick={() => void handleSyncNas()}
                >
                  Sync Product Images
                </Button>
              </AdminSectionCard>

              <Alert
                type="info"
                showIcon
                style={{ borderRadius: 12 }}
                message="Payment & Commerce Safeguards Locked"
                description="Live Razorpay keys, automatic refunds, and distributor resale checkout remain protected until owner sign-off."
              />
            </Space>
          </Col>
        </Row>
      )}

      {activeTab === "roles" && (
        <AdminSectionCard
          title="Staff Permission Matrix"
          subtitle="Server-enforced RBAC scopes"
          noPadding
        >
          <Table
            dataSource={STAFF_PERMISSION_MATRIX}
            rowKey="key"
            pagination={false}
            columns={[
              {
                title: "Permission Code",
                dataIndex: "key",
                width: 220,
                render: (v: string) => <Tag color="geekblue">{v}</Tag>,
              },
              { title: "Modules Covered", dataIndex: "scope" },
            ]}
          />
        </AdminSectionCard>
      )}

      {activeTab === "staff" && (
        <AdminTable<StaffDirectoryRow>
          title="Staff Accounts"
          dataSource={staffDir.data?.staff || []}
          columns={staffColumns}
          rowKey="id"
          loading={staffDir.isLoading}
          error={staffDir.isError ? "Failed to load staff directory." : null}
          onRetry={() => void staffDir.refetch()}
          scrollX={820}
          toolbarActions={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                staffForm.resetFields();
                staffForm.setFieldsValue(DEFAULT_STAFF_FORM);
                setAddStaffOpen(true);
              }}
            >
              Add Staff Member
            </Button>
          }
        />
      )}

      {activeTab === "audit" && (
        <AdminTable<StaffAuditEventDto>
          title="Staff Audit Trail"
          dataSource={auditLogs.data?.events || []}
          pagination={{ current: auditLogs.data?.page ?? auditPage, pageSize: auditPageSize, total: auditLogs.data?.total ?? 0, onChange: (page, size) => { setAuditPage(size === auditPageSize ? page : 1); setAuditPageSize(size); } }}
          columns={auditColumns}
          rowKey="id"
          loading={auditLogs.isLoading}
          error={auditLogs.isError ? "Failed to load audit log." : null}
          onRetry={() => void auditLogs.refetch()}
          searchValue={auditSearch}
          onSearchChange={setAuditSearch}
          searchPlaceholder="Filter by action name..."
          hasActiveFilters={auditOutcome !== "ALL" || Boolean(auditSearch)}
          onClearFilters={() => {
            setAuditSearch("");
            setAuditOutcome("ALL");
          }}
          filterControls={
            <Select
              value={auditOutcome}
              onChange={setAuditOutcome}
              style={{ width: 145 }}
              options={[
                { label: "All Outcomes", value: "ALL" },
                { label: "Success", value: "SUCCESS" },
                { label: "Failed", value: "FAILURE" },
              ]}
            />
          }
          scrollX={820}
        />
      )}

      {/* Add Staff Modal */}
      <Modal
        open={addStaffOpen}
        destroyOnClose
        title="Add Scoped Staff Account"
        onCancel={() => confirmLeave(closeAddStaffClean)}
        footer={[
          <Button
            key="reset"
            icon={<UndoOutlined />}
            disabled={!isAddStaffDirty || createStaffUser.isPending}
            onClick={() => {
              staffForm.resetFields();
              staffForm.setFieldsValue(DEFAULT_STAFF_FORM);
            }}
          >
            Reset
          </Button>,
          <Button key="cancel" onClick={() => confirmLeave(closeAddStaffClean)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createStaffUser.isPending}
            disabled={createStaffUser.isPending}
            onClick={() => staffForm.submit()}
          >
            Create Staff Account
          </Button>,
        ]}
      >
        <Form
          form={staffForm}
          layout="vertical"
          initialValues={DEFAULT_STAFF_FORM}
          onFinish={(v) => void handleCreateStaff(v)}
        >
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="First Name"
                name="first_name"
                rules={[requiredTrimRule("Enter staff member's first name.")]}
              >
                <Input maxLength={60} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Last Name" name="last_name">
                <Input maxLength={60} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Staff Email" name="email" rules={emailRules(true)}>
            <Input placeholder="staff@sai-ajanta.com" />
          </Form.Item>
          <Form.Item label="Initial Password" name="password" rules={strongPasswordRules()}>
            <Input.Password placeholder="At least 8 characters with letters and numbers" />
          </Form.Item>
          <Form.Item
            label="Assigned Permissions"
            name="permissions"
            rules={[
              {
                validator: async (_, vals) => {
                  if (!Array.isArray(vals) || vals.length === 0) {
                    throw new Error("Select at least one permission.");
                  }
                },
              },
            ]}
          >
            <Checkbox.Group
              options={SCOPED_PERMISSIONS.map((p) => ({ label: p.replace(/_/g, " "), value: p }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Staff Permissions Modal */}
      <Modal
        open={Boolean(editingStaff)}
        destroyOnClose
        title={`Edit Permissions — ${editingStaff?.email || ""}`}
        onCancel={() => confirmLeave(closeEditPermsClean)}
        footer={[
          <Button
            key="reset"
            icon={<UndoOutlined />}
            disabled={!isEditPermsDirty || updateStaffUser.isPending}
            onClick={() => setEditPerms(editingStaff?.permissions || [])}
          >
            Reset
          </Button>,
          <Button key="cancel" onClick={() => confirmLeave(closeEditPermsClean)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={updateStaffUser.isPending}
            disabled={updateStaffUser.isPending}
            onClick={() => void handleSaveStaffPerms()}
          >
            Save Permissions
          </Button>,
        ]}
      >
        <Checkbox.Group
          value={editPerms}
          onChange={(vals) => setEditPerms(vals as string[])}
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
          options={SCOPED_PERMISSIONS.map((p) => ({ label: p.replace(/_/g, " "), value: p }))}
        />
      </Modal>

      {/* Audit Detail Drawer */}
      <Drawer
        open={Boolean(selectedAudit)}
        onClose={() => setSelectedAudit(null)}
        title="Audit Event Details"
        width={460}
      >
        {selectedAudit && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Timestamp">{formatDate(selectedAudit.occurred_at, true)}</Descriptions.Item>
            <Descriptions.Item label="Actor">{selectedAudit.actor_email}</Descriptions.Item>
            <Descriptions.Item label="Action">{selectedAudit.action}</Descriptions.Item>
            <Descriptions.Item label="Resource">{selectedAudit.resource || "—"}</Descriptions.Item>
            <Descriptions.Item label="Outcome">{selectedAudit.outcome}</Descriptions.Item>
            <Descriptions.Item label="Summary">
              <pre style={{ margin: 0, fontSize: 11.5, whiteSpace: "pre-wrap" }}>
                {JSON.stringify(selectedAudit.summary || {}, null, 2)}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </div>
  );
};

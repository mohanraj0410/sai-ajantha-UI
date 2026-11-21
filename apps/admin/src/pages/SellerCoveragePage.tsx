import React, { useMemo, useState } from "react";
import { Alert, Button, Card, Col, Flex, Form, Input, Modal, Row, Select, Space, Table, Tag, Typography, message } from "antd";
import type { TableProps } from "antd";
import {
  CheckCircleOutlined,
  EnvironmentOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UndoOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useSellerCoverage } from "../api/adminQueries";
import { adminClient } from "../api/adminClient";
import type { SellerCoverageResponseDto } from "../api/adminClient";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import {
  AdminPageHeader,
  AdminSectionCard,
  AdminStatCard,
  AdminStatusTag,
} from "../components/common/AdminPrimitives";
import { AdminTable } from "../components/common/AdminTable";
import { BRAND_TOKENS } from "../theme/antdTheme";
import { indianPinRules } from "../utils/formValidation";

type CoverageDistRow = SellerCoverageResponseDto["distributors"][number];

export const SellerCoveragePage: React.FC = () => {
  const { staff } = useAuth();
  const [form] = Form.useForm();
  const [addForm] = Form.useForm();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [simParams, setSimParams] = useState<{ pin?: string; category?: string }>({});

  const coverage = useSellerCoverage(staff?.email || "anon", simParams);

  const distributors = useMemo(() => coverage.data?.distributors || [], [coverage.data?.distributors]);
  const overlappingPins = useMemo(() => coverage.data?.overlappingPins || [], [coverage.data?.overlappingPins]);
  const coverages = useMemo(() => coverage.data?.coverages || [], [coverage.data?.coverages]);

  const metrics = useMemo(() => {
    const pinStructured = distributors.filter((d) => d.coverage_mode === "PIN_STRUCTURED").length;
    const cityOnly = distributors.length - pinStructured;
    return {
      total: distributors.length,
      pinStructured,
      cityOnly,
      overlaps: overlappingPins.length,
    };
  }, [distributors, overlappingPins]);

  const handleAddCoverage = async (values: any) => {
    try {
      setIsSubmitting(true);
      const res = await adminClient.createSellerCoverage({
        distributorId: values.distributorId,
        postalCode: values.postalCode.trim(),
        categorySlug: values.categorySlug || "door-closer-floor-spring",
        categoryName: values.categorySlug?.includes("kitchen") ? "Kitchen Basket" : "Door Closer & Floor Spring",
        notes: values.notes?.trim() || undefined,
      });

      message.success(res.message || "Coverage assigned successfully");
      setIsAddModalOpen(false);
      addForm.resetFields();
      void coverage.refetch();
    } catch (err: any) {
      message.error(err.message || "Failed to assign coverage");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleCoverageStatus = async (coverageId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "ACTIVE" ? "REVOKED" : "ACTIVE";
      await adminClient.patchSellerCoverage({
        coverageId,
        status: newStatus as any,
        notes: `Admin status change to ${newStatus}`,
      });
      message.success(`Coverage updated to ${newStatus}`);
      void coverage.refetch();
    } catch (err: any) {
      message.error(err.message || "Failed to update coverage status");
    }
  };

  const columns: TableProps<CoverageDistRow>["columns"] = [
    {
      title: "Distributor Firm",
      key: "firm",
      width: 220,
      render: (_, row) => (
        <div>
          <Typography.Text strong style={{ display: "block" }}>{row.business_name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            City: {row.territory_city || "Unassigned"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Coverage Mode",
      dataIndex: "coverage_mode",
      key: "coverage_mode",
      width: 140,
      render: (v: string) => (
        <Tag color={v === "PIN_STRUCTURED" ? "cyan" : "default"} style={{ margin: 0 }}>
          {v === "PIN_STRUCTURED" ? "PIN Mapped" : "City Only"}
        </Tag>
      ),
    },
    {
      title: "Assigned PIN Codes",
      key: "assigned_pins",
      render: (_, row) => {
        const pins = row.assigned_pins || row.structured_pincodes || [];
        return pins.length > 0 ? (
          <Space wrap size={4}>
            {pins.slice(0, 8).map((p) => (
              <Tag key={p} style={{ margin: 0 }}>{p}</Tag>
            ))}
            {pins.length > 8 && <Tag style={{ margin: 0 }}>+{pins.length - 8} more</Tag>}
          </Space>
        ) : (
          <Typography.Text type="secondary">No PIN codes assigned</Typography.Text>
        );
      },
    },
    {
      title: "Linked Dealers",
      dataIndex: "linked_dealers_count",
      key: "linked_dealers_count",
      align: "center",
      width: 130,
      render: (count: number) => (
        <Tag color={count > 0 ? "blue" : "default"}>{count} Dealers</Tag>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 125,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
  ];

  const coverageTableColumns: TableProps<any>["columns"] = [
    {
      title: "Coverage ID",
      dataIndex: "id",
      key: "id",
      width: 180,
      render: (v: string) => <Typography.Text copyable style={{ fontSize: 12 }}>{v}</Typography.Text>,
    },
    {
      title: "Distributor",
      dataIndex: "distributor_id",
      key: "distributor_id",
      width: 220,
      render: (distId: string) => {
        const d = distributors.find((x) => x.customer_id === distId || x.id === distId);
        return <Typography.Text strong>{d?.business_name || distId}</Typography.Text>;
      },
    },
    {
      title: "PIN Code",
      dataIndex: "postal_code",
      key: "postal_code",
      width: 110,
      render: (v: string) => <Tag color="geekblue" style={{ fontWeight: "bold" }}>{v}</Tag>,
    },
    {
      title: "Category",
      dataIndex: "category_name",
      key: "category_name",
      render: (v: string) => <Tag>{v || "Door Closer"}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 110,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      width: 120,
      render: (_, row) => (
        <Button
          size="small"
          danger={row.status === "ACTIVE"}
          type={row.status === "ACTIVE" ? "default" : "primary"}
          onClick={() => handleToggleCoverageStatus(row.id, row.status)}
        >
          {row.status === "ACTIVE" ? "Revoke" : "Activate"}
        </Button>
      ),
    },
  ];

  const simResult = coverage.data?.simulation;

  return (
    <div>
      <AdminPageHeader
        title="Seller Coverage"
        subtitle="Manage territorial PIN assignments for regional distributors, inspect overlap, and test routing."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Seller Coverage" }]}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsAddModalOpen(true)}
            style={{ background: BRAND_TOKENS.navy, borderColor: BRAND_TOKENS.navy }}
          >
            Assign PIN Coverage
          </Button>
        }
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={coverage.isPending} unavailable={coverage.isError} label="Distributors" value={metrics.total} icon={<TeamOutlined />} accentColor={BRAND_TOKENS.navy} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={coverage.isPending} unavailable={coverage.isError} label="PIN-Mapped" value={metrics.pinStructured} icon={<CheckCircleOutlined />} accentColor={BRAND_TOKENS.teal} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={coverage.isPending} unavailable={coverage.isError} label="City-Only" value={metrics.cityOnly} icon={<EnvironmentOutlined />} accentColor="#0284C7" highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={coverage.isPending} unavailable={coverage.isError} label="Overlapping PINs" value={metrics.overlaps} icon={<WarningOutlined />} accentColor={metrics.overlaps > 0 ? "#DC2626" : "#16A34A"} highlightTop />
        </Col>
      </Row>

      <AdminSectionCard
        title="Check Seller for a PIN Code"
        subtitle="Enter a 6-digit Tamil Nadu PIN code and product category to preview routing"
        style={{ marginBottom: 14 }}
      >
        <Form
          form={form}
          layout="inline"
          initialValues={{ pin: "", category: "Door Closer & Floor Spring" }}
          onFinish={(values) =>
            setSimParams({
              pin: values.pin?.trim() || undefined,
              category: values.category || undefined,
            })
          }
          style={{ gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}
        >
          <Form.Item label="6-Digit PIN" name="pin" rules={indianPinRules(false)}>
            <Input
              placeholder="e.g. 620001"
              maxLength={6}
              inputMode="numeric"
              style={{ width: 160 }}
            />
          </Form.Item>
          <Form.Item
            label="Category"
            name="category"
            rules={[{ required: true, message: "Select a category." }]}
          >
            <Select
              style={{ width: 230 }}
              options={ELEVEN_CATEGORIES.map((c) => ({ label: c, value: c }))}
            />
          </Form.Item>
          <Form.Item>
            <Space size={8}>
              <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={coverage.isFetching}>
                Check Route
              </Button>
              <Button
                icon={<UndoOutlined />}
                onClick={() => {
                  form.resetFields();
                  setSimParams({});
                }}
              >
                Reset
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {simResult && (
          <Alert
            type={simResult.outcome.includes("BLOCKED") || simResult.outcome.includes("OVERLAP") || simResult.outcome.includes("UNMATCHED") ? "warning" : "success"}
            showIcon
            style={{ marginTop: 16, borderRadius: 10 }}
            message={`Resolved Seller: ${simResult.autoAssignedSeller || simResult.seller_route || "Sai Ajantha Direct"}`}
            description={simResult.reason || `Matched route for PIN ${simParams.pin || "Any"} in ${simParams.category}.`}
          />
        )}
      </AdminSectionCard>

      <div style={{ marginBottom: 16 }}>
        <AdminTable<CoverageDistRow>
          title="Distributor Territory Directory"
          dataSource={distributors}
          columns={columns}
          rowKey={(r) => r.customer_id || r.business_name}
          loading={coverage.isLoading}
          error={coverage.isError ? "Failed to load coverage directory." : null}
          onRetry={() => void coverage.refetch()}
          scrollX={760}
        />
      </div>

      {coverages.length > 0 && (
        <Card title={`Active PIN Coverage Records (${coverages.length})`} style={{ borderRadius: 12, marginBottom: 16 }}>
          <Table
            dataSource={coverages}
            columns={coverageTableColumns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            size="small"
            scroll={{ x: 700 }}
          />
        </Card>
      )}

      {/* Modal: Assign PIN Coverage */}
      <Modal
        title="Assign PIN Coverage to Distributor"
        open={isAddModalOpen}
        onCancel={() => setIsAddModalOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddCoverage}
          initialValues={{ categorySlug: "door-closer-floor-spring" }}
        >
          <Form.Item
            label="Distributor Firm"
            name="distributorId"
            rules={[{ required: true, message: "Select an active distributor." }]}
          >
            <Select
              placeholder="Select Distributor"
              options={distributors
                .filter((d) => d.status === "ACTIVE")
                .map((d) => ({
                  label: `${d.business_name} (${d.territory_city || "Tamil Nadu"})`,
                  value: d.customer_id || d.id,
                }))}
            />
          </Form.Item>

          <Form.Item
            label="6-Digit Indian Postal PIN"
            name="postalCode"
            rules={[
              { required: true, message: "Enter a 6-digit PIN." },
              { pattern: /^[1-9][0-9]{5}$/, message: "Must be a valid 6-digit Indian PIN (starting 1-9)." },
            ]}
          >
            <Input maxLength={6} placeholder="e.g. 620001" />
          </Form.Item>

          <Form.Item
            label="Category"
            name="categorySlug"
            rules={[{ required: true, message: "Select product category." }]}
          >
            <Select
              options={[
                { label: "Door Closer & Floor Spring", value: "door-closer-floor-spring" },
                { label: "Kitchen Basket", value: "kitchen-basket" },
              ]}
            />
          </Form.Item>

          <Form.Item label="Notes / Territory Reference" name="notes">
            <Input.TextArea rows={2} placeholder="e.g. Primary territory assignment" />
          </Form.Item>

          <Flex justify="end" gap={8}>
            <Button onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={isSubmitting}>
              Assign Coverage
            </Button>
          </Flex>
        </Form>
      </Modal>
    </div>
  );
};

import React, { useCallback, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  FileTextOutlined,
  PlusOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useAdminDataset, useAdminMutations } from "../api/adminQueries";
import type { TradeQuoteDto } from "../api/adminClient";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
  formatDate,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminStatusTabs } from "../components/common/AdminStatusTabs";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import { BRAND_TOKENS } from "../theme/antdTheme";
import {
  areFormValuesEqual,
  emailRules,
  positiveQtyRules,
  priceRules,
  requiredTrimRule,
} from "../utils/formValidation";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

const QUOTE_STATUSES: TradeQuoteDto["status"][] = [
  "DRAFT",
  "REVIEWED",
  "SHARED_NONPAYABLE",
  "ACCEPTED",
  "REJECTED",
  "REVISION_REQUESTED",
  "CONVERTED_TO_ORDER",
  "EXPIRED",
  "ARCHIVED",
];

export const QuotesPage: React.FC = () => {
  const { staff } = useAuth();
  const { showToast } = useAdminToast();
  const { createTradeQuote, updateTradeQuote, convertQuoteToOrder } = useAdminMutations();

  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [inspectQuote, setInspectQuote] = useState<TradeQuoteDto | null>(null);
  const [revInitialValues, setRevInitialValues] = useState<Record<string, unknown>>({});
  const [createForm] = Form.useForm();
  const [revForm] = Form.useForm();

  const CREATE_QUOTE_DEFAULTS = useMemo(
    () => ({
      customerName: "",
      customerEmail: "",
      organization: "",
      division: "Door Closer & Floor Spring",
      sku: "SA-QUOTE-001",
      itemName: "Custom Hardware Package",
      qty: 10,
      unitPriceInr: 1250,
      customerNotes: "",
    }),
    []
  );

  const watchedCreate = Form.useWatch([], createForm);
  const watchedRev = Form.useWatch([], revForm);

  const isCreateDirty = useMemo(
    () => createOpen && !areFormValuesEqual(watchedCreate || {}, CREATE_QUOTE_DEFAULTS),
    [createOpen, watchedCreate, CREATE_QUOTE_DEFAULTS]
  );
  const isRevDirty = useMemo(
    () => Boolean(inspectQuote) && !areFormValuesEqual(watchedRev || {}, revInitialValues),
    [inspectQuote, watchedRev, revInitialValues]
  );

  const closeCreateClean = useCallback(() => {
    setCreateOpen(false);
    createForm.resetFields();
  }, [createForm]);

  const closeInspectClean = useCallback(() => {
    setInspectQuote(null);
    revForm.resetFields();
  }, [revForm]);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty: isCreateDirty || isRevDirty,
    onDiscard: () => {
      closeCreateClean();
      closeInspectClean();
    },
    enabled: createOpen || Boolean(inspectQuote),
  });

  const openInspectDrawer = useCallback(
    (row: TradeQuoteDto) => {
      const next = {
        status: row.status,
        unitPriceInr: row.items?.[0]?.unitPriceInr ?? 0,
        internalNotes: row.internal_notes || "",
      };
      revForm.resetFields();
      revForm.setFieldsValue(next);
      setRevInitialValues(next);
      setInspectQuote(row);
    },
    [revForm]
  );

  const openCreateModal = useCallback(() => {
    createForm.resetFields();
    createForm.setFieldsValue(CREATE_QUOTE_DEFAULTS);
    setCreateOpen(true);
  }, [createForm, CREATE_QUOTE_DEFAULTS]);

  const quoteList = useAdminDataset<TradeQuoteDto>(staff?.email || "anon", "quotes", { tab: activeTab, q: searchText });

  const filtered = quoteList.data?.items || [];
  const counts = { total: quoteList.data?.counts.ALL, open: quoteList.data ? quoteList.data.counts.DRAFT + quoteList.data.counts.REVIEWED : undefined, quoted: quoteList.data?.counts.SHARED_NONPAYABLE, accepted: quoteList.data?.counts.REVIEWED };

  const handleCreate = async (values: any) => {
    try {
      await createTradeQuote.mutateAsync({
        customer_name: values.customerName.trim(),
        customer_email: values.customerEmail.trim(),
        organization: values.organization?.trim() || undefined,
        division: values.division,
        items: [
          {
            sku: values.sku?.trim() || "CUSTOM-QUOTE",
            name: values.itemName?.trim() || "Custom Hardware Lot",
            quantity: Number(values.qty) || 1,
            unitPriceInr: Number(values.unitPriceInr) || 0,
          },
        ],
        customer_notes: values.customerNotes?.trim() || undefined,
        internal_notes: values.internalNotes?.trim() || undefined,
      });
      showToast("Quote created successfully.", "success");
      allowNextNavigation();
      closeCreateClean();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not create quote. Your entries are preserved.", "error");
    }
  };

  const handleRevise = async (values: any) => {
    if (!inspectQuote) return;
    try {
      const updatedItems = (inspectQuote.items || []).map((it, idx) =>
        idx === 0 && values.unitPriceInr !== undefined
          ? { ...it, unitPriceInr: Number(values.unitPriceInr) }
          : it
      );
      await updateTradeQuote.mutateAsync({
        quoteId: inspectQuote.id,
        payload: {
          status: values.status,
          items: updatedItems,
          internal_notes: values.internalNotes?.trim() || undefined,
        },
      });
      showToast(`Quote ${inspectQuote.quote_number} updated.`, "success");
      allowNextNavigation();
      closeInspectClean();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to update quote. Your entries are preserved.", "error");
    }
  };

  const columns: TableProps<TradeQuoteDto>["columns"] = [
    {
      title: "Quote #",
      dataIndex: "quote_number",
      key: "quote_number",
      width: 150,
      render: (v: string) => (
        <Typography.Text strong style={{ color: BRAND_TOKENS.teal, fontFamily: "monospace" }}>
          {v}
        </Typography.Text>
      ),
    },
    {
      title: "Customer / Firm",
      key: "customer",
      width: 220,
      render: (_, row) => (
        <div>
          <Typography.Text strong style={{ display: "block" }}>{row.customer_name}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.organization || row.customer_email}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Category",
      dataIndex: "division",
      key: "division",
      width: 185,
      ellipsis: true,
    },
    {
      title: "Quoted Total",
      dataIndex: "subtotal_inr",
      key: "subtotal_inr",
      align: "right",
      width: 130,
      render: (v: number) => <Typography.Text strong>{formatInr(v)}</Typography.Text>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 130,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
    {
      title: "Updated",
      dataIndex: "updated_at",
      key: "updated_at",
      width: 120,
      render: (v: string) => formatDate(v),
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      width: 95,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            openInspectDrawer(row);
          }}
        >
          Review
        </Button>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Quotes"
        subtitle="Manage custom sizing and bulk BOQ quotations separately from direct paid orders."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Quotes" }]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            Create Quote
          </Button>
        }
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={quoteList.isPending} unavailable={quoteList.isError} label="Total Quotes" value={counts.total} icon={<FileTextOutlined />} accentColor={BRAND_TOKENS.navy} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={quoteList.isPending} unavailable={quoteList.isError} label="Awaiting Price" value={counts.open} icon={<ClockCircleOutlined />} accentColor="#D97706" highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={quoteList.isPending} unavailable={quoteList.isError} label="Sent to Buyer" value={counts.quoted} icon={<FileTextOutlined />} accentColor={BRAND_TOKENS.teal} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={quoteList.isPending} unavailable={quoteList.isError} label="Reviewed" value={counts.accepted} icon={<CheckCircleOutlined />} accentColor="#16A34A" highlightTop />
        </Col>
      </Row>

      <AdminStatusTabs query={quoteList} activeKey={activeTab} onChange={setActiveTab}
        items={[{"key":"ALL","label":"All"},{"key":"DRAFT","label":"Drafts"},{"key":"REVIEWED","label":"Reviewed"},{"key":"SHARED_NONPAYABLE","label":"Shared"},{"key":"EXPIRED","label":"Expired"},{"key":"ARCHIVED","label":"Archived"}]}
        note="" />

      <AdminTable<TradeQuoteDto>
        title="Quotations"
        dataSource={filtered}
        pagination={quoteList.pagination}
        columns={columns}
        rowKey="id"
        loading={quoteList.isPending}
        error={quoteList.isError ? "Failed to load quotes." : null}
        onRetry={() => void quoteList.refetch()}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search quote #, customer, or firm..."
        hasActiveFilters={Boolean(searchText)}
        onClearFilters={() => setSearchText("")}
        emptyTitle="No quotations yet"
        emptyDescription="Create a custom quote for bulk BOQ requests, Floor Springs, or special sizing."
        emptyActionLabel="Create Quote"
        onEmptyAction={openCreateModal}
        onRefresh={() => void quoteList.refetch()}
        refreshing={quoteList.isFetching}
        onRowClick={(row) => openInspectDrawer(row)}
        renderMobileItem={(row) => (
          <Card
            size="small"
            bordered
            onClick={() => openInspectDrawer(row)}
            style={{ borderRadius: 12, cursor: "pointer" }}
          >
            <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
              <Typography.Text strong style={{ color: BRAND_TOKENS.teal }}>{row.quote_number}</Typography.Text>
              <Typography.Text strong>{formatInr(row.subtotal_inr)}</Typography.Text>
            </Flex>
            <Typography.Text style={{ display: "block" }}>{row.customer_name}</Typography.Text>
            <Flex justify="space-between" align="center" style={{ marginTop: 8 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{row.division}</Typography.Text>
              <AdminStatusTag status={row.status} />
            </Flex>
          </Card>
        )}
      />

      {/* Create Quote Modal */}
      <Modal
        open={createOpen}
        destroyOnClose
        title="Create Custom Quotation"
        onCancel={() => confirmLeave(closeCreateClean)}
        footer={[
          <Button
            key="reset"
            icon={<UndoOutlined />}
            disabled={!isCreateDirty || createTradeQuote.isPending}
            onClick={() => {
              createForm.resetFields();
              createForm.setFieldsValue(CREATE_QUOTE_DEFAULTS);
            }}
          >
            Reset
          </Button>,
          <Button key="cancel" onClick={() => confirmLeave(closeCreateClean)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createTradeQuote.isPending}
            disabled={createTradeQuote.isPending}
            onClick={() => createForm.submit()}
          >
            Save Quote
          </Button>,
        ]}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={CREATE_QUOTE_DEFAULTS}
          onFinish={(v) => void handleCreate(v)}
        >
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Customer Name"
                name="customerName"
                rules={[requiredTrimRule("Enter the customer's full name.")]}
              >
                <Input placeholder="Full name" maxLength={100} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Email" name="customerEmail" rules={emailRules(true)}>
                <Input placeholder="buyer@company.com" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item label="Firm / Shop" name="organization">
                <Input placeholder="Optional" maxLength={120} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Category"
                name="division"
                rules={[{ required: true, message: "Select a product category." }]}
              >
                <Select options={ELEVEN_CATEGORIES.map((c) => ({ label: c, value: c }))} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Item Name"
                name="itemName"
                rules={[requiredTrimRule("Enter the product or lot description.")]}
              >
                <Input maxLength={160} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item label="Qty" name="qty" rules={positiveQtyRules()}>
                <InputNumber min={1} max={100000} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} sm={6}>
              <Form.Item label="Rate (₹)" name="unitPriceInr" rules={priceRules("Rate", true)}>
                <InputNumber min={0} max={10000000} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Customer Notes" name="customerNotes">
            <Input.TextArea rows={2} placeholder="Sizing or delivery details" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Review Quote Drawer */}
      <Drawer
        open={Boolean(inspectQuote)}
        destroyOnClose
        onClose={() => confirmLeave(closeInspectClean)}
        title={inspectQuote ? `Quote ${inspectQuote.quote_number}` : "Quote Details"}
        width={480}
      >
        {inspectQuote && (
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Customer">{inspectQuote.customer_name}</Descriptions.Item>
              <Descriptions.Item label="Email">{inspectQuote.customer_email}</Descriptions.Item>
              <Descriptions.Item label="Organization">{inspectQuote.organization || "—"}</Descriptions.Item>
              <Descriptions.Item label="Category">{inspectQuote.division}</Descriptions.Item>
              <Descriptions.Item label="Total">{formatInr(inspectQuote.subtotal_inr)}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <AdminStatusTag status={inspectQuote.status} />
              </Descriptions.Item>
            </Descriptions>

            <Form form={revForm} layout="vertical" onFinish={(v) => void handleRevise(v)}>
              <Form.Item
                label="Quote Status"
                name="status"
                rules={[{ required: true, message: "Select a quote status." }]}
              >
                <Select options={QUOTE_STATUSES.map((s) => ({ label: s, value: s }))} />
              </Form.Item>
              <Form.Item
                label="Primary Item Unit Price (₹)"
                name="unitPriceInr"
                rules={priceRules("Unit Price", true)}
              >
                <InputNumber min={0} max={10000000} prefix="₹" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item label="Staff Internal Notes" name="internalNotes">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  loading={updateTradeQuote.isPending}
                  disabled={updateTradeQuote.isPending}
                >
                  Save Quote Revision
                </Button>
                {inspectQuote.status === "ACCEPTED" && !inspectQuote.converted_order_id && (
                  <Button
                    type="primary"
                    block
                    style={{ background: "#16A34A", borderColor: "#16A34A" }}
                    loading={convertQuoteToOrder.isPending}
                    onClick={async () => {
                      try {
                        const res = await convertQuoteToOrder.mutateAsync(inspectQuote.id);
                        showToast(`Converted quote to order ${res.orderNumber}!`, "success");
                        closeInspectClean();
                      } catch (err) {
                        showToast(err instanceof Error ? err.message : "Conversion failed", "error");
                      }
                    }}
                  >
                    Convert to Trade Order
                  </Button>
                )}
                <Button
                  block
                  icon={<UndoOutlined />}
                  disabled={!isRevDirty || updateTradeQuote.isPending}
                  onClick={() => {
                    revForm.resetFields();
                    revForm.setFieldsValue(revInitialValues);
                  }}
                >
                  Reset Changes
                </Button>
              </Space>
            </Form>
          </Space>
        )}
      </Drawer>
    </div>
  );
};

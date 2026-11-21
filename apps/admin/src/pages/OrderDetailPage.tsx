import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Col,
  Descriptions,
  Divider,
  Flex,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Timeline,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DollarCircleOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InboxOutlined,
  PrinterOutlined,
  SaveOutlined,
  SendOutlined,
  StopOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import {
  useAdminMutations,
  useOrderDetail,
  useOrderDocuments,
  usePortalData,
} from "../api/adminQueries";
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
import { areFormValuesEqual } from "../utils/formValidation";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

const STATUS_OPTIONS = [
  "PENDING_PAYMENT",
  "BOQ_QUOTE_REQUESTED",
  "CONFIRMED_TRADE_PO",
  "CONFIRMED",
  "PROCESSING",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
];

const ROUTING_OPTIONS = [
  { label: "Sai Ajantha Direct Fulfillment", value: "DIRECT_FULFILLMENT" },
  { label: "Pending Distributor Assignment", value: "PENDING_DISTRIBUTOR" },
  { label: "Routed to Distributor", value: "ROUTED_TO_DISTRIBUTOR" },
  { label: "Assigned to Dealer", value: "ASSIGNED_TO_DEALER" },
  { label: "Delivered by Dealer", value: "DELIVERED_BY_DEALER" },
];

function resolveStepIndex(status: string): number {
  const s = (status || "").toUpperCase();
  if (s === "DELIVERED" || s === "INVOICED") return 4;
  if (s === "DISPATCHED" || s === "SHIPPED") return 3;
  if (s === "PROCESSING" || s === "PACKED") return 2;
  if (s === "CONFIRMED" || s === "CONFIRMED_TRADE_PO") return 1;
  return 0;
}

export const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { staff } = useAuth();
  const { showToast } = useAdminToast();
  const detail = useOrderDetail(staff?.email || "anon", orderId);
  const portal = usePortalData(staff?.email || "anon");
  const docsQuery = useOrderDocuments(staff?.email || "anon", orderId);
  const { updateOrder, transitionOrder, generateOrderDocument } = useAdminMutations();
  const [form] = Form.useForm();
  const [verifyForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [dispatchForm] = Form.useForm();
  const [deliverForm] = Form.useForm();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [verifyModalOpen, setVerifyModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [deliverModalOpen, setDeliverModalOpen] = useState(false);
  const [viewDocModal, setViewDocModal] = useState<any | null>(null);
  const [initialOrderForm, setInitialOrderForm] = useState<Record<string, unknown> | null>(null);
  const hydratedOrderRef = useRef<string | null>(null);

  const order = detail.data?.order;

  const distributors = useMemo(
    () =>
      (portal.data?.users || []).filter(
        (u) => u.role === "DISTRIBUTOR" && u.approval_status === "APPROVED"
      ),
    [portal.data?.users]
  );

  const dealers = useMemo(
    () =>
      (portal.data?.users || []).filter(
        (u) => u.role === "DEALER" && u.approval_status === "APPROVED"
      ),
    [portal.data?.users]
  );

  useEffect(() => {
    if (order) {
      const orderKey = `${order.id}:${order.status}:${order.routing_status || ""}:${order.tracking_reference || ""}:${order.shipping_carrier || ""}`;
      if (hydratedOrderRef.current !== orderKey) {
        hydratedOrderRef.current = orderKey;
        const nextVals = {
          status: order.status || "CONFIRMED",
          shippingCarrier: order.shipping_carrier || "",
          trackingReference: order.tracking_reference || "",
          routingStatus: order.routing_status || "DIRECT_FULFILLMENT",
          assignedDistributorId: order.assigned_distributor_id || undefined,
          assignedDealerId: order.assigned_dealer_id || undefined,
          eventNote: "",
        };
        form.resetFields();
        form.setFieldsValue(nextVals);
        setInitialOrderForm(nextVals);
      }
    }
  }, [order, form]);

  const watchedOrderForm = Form.useWatch([], form);
  const isDirty = useMemo(() => {
    if (!initialOrderForm) return false;
    return !areFormValuesEqual(watchedOrderForm || {}, initialOrderForm);
  }, [watchedOrderForm, initialOrderForm]);

  const handleResetOrderForm = useCallback(() => {
    if (!initialOrderForm) return;
    form.resetFields();
    form.setFieldsValue(initialOrderForm);
  }, [form, initialOrderForm]);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty,
    onDiscard: handleResetOrderForm,
    enabled: Boolean(order),
  });

  if (detail.isLoading) {
    return <AdminLoadingState rows={6} title="Loading order details..." />;
  }

  if (detail.isError) {
    return (
      <AdminErrorState
        message={detail.error instanceof Error ? detail.error.message : "Failed to load order."}
        onRetry={() => void detail.refetch()}
      />
    );
  }

  if (!order) {
    return (
      <AdminEmptyState
        title="Order not found"
        description={`Could not locate order "${orderId}".`}
        actionLabel="Back to Orders"
        onAction={() => navigate("/orders")}
      />
    );
  }

  const isPaid = order.payment_status === "PAID";
  const isCancelled = order.status === "CANCELLED";

  const handleSave = async (values: any) => {
    try {
      await updateOrder.mutateAsync({
        orderId: order.id,
        payload: {
          status: values.status,
          shippingCarrier: values.shippingCarrier?.trim() || undefined,
          trackingReference: values.trackingReference?.trim() || undefined,
          routingStatus: values.routingStatus || undefined,
          assignedDistributorId: values.assignedDistributorId || null,
          assignedDealerId: values.assignedDealerId || null,
          eventNote: values.eventNote?.trim() || undefined,
        },
      });
      const savedSnapshot = {
        ...values,
        shippingCarrier: values.shippingCarrier?.trim() || "",
        trackingReference: values.trackingReference?.trim() || "",
        eventNote: "",
      };
      setInitialOrderForm(savedSnapshot);
      form.setFieldsValue(savedSnapshot);
      allowNextNavigation();
      showToast(`Order ${order.order_number} updated.`, "success");
      void detail.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Order update failed. Your entries are preserved.", "error");
    }
  };

  const handleCancelOrder = async () => {
    try {
      await updateOrder.mutateAsync({
        orderId: order.id,
        payload: {
          status: "CANCELLED",
          eventNote: "Cancelled by staff administrator",
        },
      });
      showToast(`Order ${order.order_number} marked as Cancelled.`, "warning");
      setCancelOpen(false);
      void detail.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not cancel order.", "error");
    }
  };

  const handleTransition = async (
    command: Parameters<typeof transitionOrder.mutateAsync>[0]["payload"]["command"],
    extra: Partial<Parameters<typeof transitionOrder.mutateAsync>[0]["payload"]> = {}
  ) => {
    if (!order) return;
    try {
      await transitionOrder.mutateAsync({
        orderId: order.id,
        payload: { command, ...extra },
      });
      showToast(`Order updated: ${command.replace(/_/g, " ")}.`, "success");
      void detail.refetch();
      void docsQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Transition failed.", "error");
    }
  };

  const handleVerifyPayment = async (values: any) => {
    if (!order) return;
    try {
      const amountPaise = Math.round(Number(values.verifiedAmountInr || order.total_inr) * 100);
      await transitionOrder.mutateAsync({
        orderId: order.id,
        payload: {
          command: "VERIFY_BANK_PAYMENT",
          bankReference: values.bankReference?.trim(),
          verifiedAmountPaise: amountPaise,
          notes: values.notes?.trim() || "Verified by staff finance administrator",
        },
      });
      showToast(`Bank payment verified for order ${order.order_number}.`, "success");
      setVerifyModalOpen(false);
      verifyForm.resetFields();
      void detail.refetch();
      void docsQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Payment verification failed.", "error");
    }
  };

  const handleRejectPayment = async (values: any) => {
    if (!order) return;
    try {
      await transitionOrder.mutateAsync({
        orderId: order.id,
        payload: {
          command: "REJECT_BANK_PAYMENT",
          notes: values.rejectionReason?.trim() || "Bank reference not found in bank statement",
        },
      });
      showToast(`Bank payment rejected for order ${order.order_number}.`, "warning");
      setRejectModalOpen(false);
      rejectForm.resetFields();
      void detail.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Payment rejection failed.", "error");
    }
  };

  const handleDispatch = async (values: any) => {
    if (!order) return;
    try {
      await transitionOrder.mutateAsync({
        orderId: order.id,
        payload: {
          command: "DISPATCH_ORDER",
          carrierName: values.carrierName?.trim(),
          trackingNumber: values.trackingNumber?.trim(),
          notes: values.notes?.trim(),
        },
      });
      showToast(`Order ${order.order_number} marked as DISPATCHED.`, "success");
      setDispatchModalOpen(false);
      dispatchForm.resetFields();
      void detail.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Dispatch transition failed.", "error");
    }
  };

  const handleDeliver = async (values: any) => {
    if (!order) return;
    try {
      await transitionOrder.mutateAsync({
        orderId: order.id,
        payload: {
          command: "MARK_DELIVERED",
          notes: values.notes?.trim() || "Delivered to customer address",
        },
      });
      showToast(`Order ${order.order_number} marked as DELIVERED.`, "success");
      setDeliverModalOpen(false);
      deliverForm.resetFields();
      void detail.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delivery transition failed.", "error");
    }
  };

  const handleGenerateDoc = async (docType: "PROFORMA" | "DRAFT_INVOICE" | "DRAFT_CREDIT_NOTE") => {
    if (!order) return;
    try {
      await generateOrderDocument.mutateAsync({
        orderId: order.id,
        payload: { docType },
      });
      showToast(`Generated ${docType.replace(/_/g, " ")} (Draft / Not a Tax Invoice).`, "success");
      void docsQuery.refetch();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Document generation failed.", "error");
    }
  };

  const handlePrint = () => {
    if (!isPaid) {
      showToast("Final tax invoice can only be printed for PAID orders.", "warning");
      return;
    }
    window.print();
  };

  const items = Array.isArray(order.items) ? order.items : [];
  const events = Array.isArray(order.events) ? order.events : [];

  return (
    <div>
      <AdminPageHeader
        title={`Order ${order.order_number}`}
        subtitle={`Placed on ${formatDate(order.created_at, true)} • ${order.customer_name}`}
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Orders", to: "/orders" },
          { label: order.order_number },
        ]}
        extra={
          <>
            {isDirty && (
              <Tag color="warning" style={{ margin: 0, fontWeight: 600 }}>
                Unsaved Changes
              </Tag>
            )}
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => confirmLeave(() => navigate("/orders"))}
            >
              Back
            </Button>
            <Button
              icon={<PrinterOutlined />}
              disabled={!isPaid}
              onClick={handlePrint}
              title={isPaid ? "Print order summary" : "Invoice disabled for unpaid orders"}
            >
              {isPaid ? "Print Summary" : "Unpaid — Invoice Locked"}
            </Button>
            {!isCancelled && (
              <Button danger icon={<StopOutlined />} onClick={() => setCancelOpen(true)}>
                Cancel Order
              </Button>
            )}
          </>
        }
      />

      {!isPaid && !isCancelled && (
        <Alert
          type="warning"
          showIcon
          style={{ borderRadius: 12, marginBottom: 16 }}
          message="Payment Not Confirmed"
          description="This order is unpaid. Final tax invoice generation remains locked until server payment verification succeeds."
        />
      )}

      {(order.payment_status === "AWAITING_FINANCE_APPROVAL" ||
        order.payment_status === "UTR_SUBMITTED" ||
        order.status === "AWAITING_FINANCE_APPROVAL") && (
        <Alert
          type="info"
          showIcon
          icon={<DollarCircleOutlined style={{ fontSize: 18 }} />}
          style={{ borderRadius: 12, marginBottom: 16 }}
          message="Bank Transfer Proof Submitted"
          description={
            <div style={{ marginTop: 6 }}>
              <div style={{ marginBottom: 10 }}>
                Customer has submitted bank reference: <strong>{order.bank_reference || "Attached in statement"}</strong>.
                Requires verified credit into Sai Ajantha bank account before marking paid.
              </div>
              <Space wrap>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  loading={transitionOrder.isPending}
                  onClick={() => {
                    verifyForm.setFieldsValue({
                      bankReference: order.bank_reference || "",
                      verifiedAmountInr: order.total_inr,
                      notes: "Credit verified on bank statement",
                    });
                    setVerifyModalOpen(true);
                  }}
                >
                  Verify Bank Payment
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<CloseCircleOutlined />}
                  loading={transitionOrder.isPending}
                  onClick={() => {
                    rejectForm.resetFields();
                    setRejectModalOpen(true);
                  }}
                >
                  Reject Payment Proof
                </Button>
              </Space>
            </div>
          }
        />
      )}

      {!isCancelled && (
        <AdminSectionCard style={{ marginBottom: 16 }}>
          <Steps
            size="small"
            current={resolveStepIndex(order.status)}
            items={[
              { title: "Placed" },
              { title: "Confirmed" },
              { title: "Processing" },
              { title: "Dispatched" },
              { title: "Delivered" },
            ]}
          />
          <Divider style={{ margin: "14px 0 10px" }} />
          <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
            <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
              Current Status: <strong>{order.status}</strong>
            </Typography.Text>
            <Space wrap>
              {(order.status === "PENDING" || order.status === "CONFIRMED_TRADE_PO") && (
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  loading={transitionOrder.isPending}
                  onClick={() => void handleTransition("MARK_CONFIRMED")}
                >
                  Confirm Order
                </Button>
              )}
              {order.status === "CONFIRMED" && (
                <Button
                  type="primary"
                  size="small"
                  icon={<InboxOutlined />}
                  loading={transitionOrder.isPending}
                  onClick={() => void handleTransition("PACK_ORDER")}
                >
                  Mark as Packed
                </Button>
              )}
              {(order.status === "PROCESSING" || order.status === "PACKED") && (
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  loading={transitionOrder.isPending}
                  onClick={() => {
                    dispatchForm.setFieldsValue({
                      carrierName: order.shipping_carrier || "",
                      trackingNumber: order.tracking_reference || "",
                    });
                    setDispatchModalOpen(true);
                  }}
                >
                  Dispatch Order
                </Button>
              )}
              {(order.status === "DISPATCHED" || order.status === "SHIPPED") && (
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  loading={transitionOrder.isPending}
                  onClick={() => {
                    deliverForm.resetFields();
                    setDeliverModalOpen(true);
                  }}
                >
                  Mark Delivered
                </Button>
              )}
            </Space>
          </Flex>
        </AdminSectionCard>
      )}

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={15}>
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <AdminSectionCard title="Customer & Delivery Details">
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="Customer">{order.customer_name}</Descriptions.Item>
                <Descriptions.Item label="Email">{order.customer_email || "—"}</Descriptions.Item>
                <Descriptions.Item label="Phone">{order.customer_phone || "—"}</Descriptions.Item>
                <Descriptions.Item label="Price Tier">
                  <Tag style={{ margin: 0 }}>{order.price_tier_applied || "Buyer"}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Payment Status">
                  <AdminStatusTag status={order.payment_status} />
                </Descriptions.Item>
                <Descriptions.Item label="Order Status">
                  <AdminStatusTag status={order.status} />
                </Descriptions.Item>
                <Descriptions.Item label="Shipping Address" span={2}>
                  {order.shipping_address || "—"}
                </Descriptions.Item>
              </Descriptions>
            </AdminSectionCard>

            <AdminSectionCard title={`Order Items (${items.length})`} noPadding>
              <Table
                dataSource={items}
                rowKey={(it: any, idx) => it.sku || String(idx)}
                pagination={false}
                size="small"
                scroll={{ x: 560 }}
                columns={[
                  { title: "SKU", dataIndex: "sku", width: 130 },
                  { title: "Product", dataIndex: "name", ellipsis: true },
                  { title: "Qty", dataIndex: "quantity", align: "right", width: 80 },
                  {
                    title: "Unit Price",
                    dataIndex: "unit_price_inr",
                    align: "right",
                    width: 115,
                    render: (v: number) => formatInr(v),
                  },
                  {
                    title: "Line Total",
                    key: "total",
                    align: "right",
                    width: 120,
                    render: (_: unknown, r: any) => (
                      <Typography.Text strong>
                        {formatInr((Number(r.unit_price_inr) || 0) * (Number(r.quantity) || 1))}
                      </Typography.Text>
                    ),
                  },
                ]}
                summary={() => (
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={4} align="right">
                      <Typography.Text strong>Order Total</Typography.Text>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="right">
                      <Typography.Text strong style={{ fontSize: 15 }}>
                        {formatInr(order.total_inr)}
                      </Typography.Text>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                )}
              />
            </AdminSectionCard>

            <AdminSectionCard
              title="Financial Documents (Draft Only)"
              subtitle="All invoices remain draft until owner/accountant tax signoff"
              extra={
                <Space wrap>
                  <Button
                    size="small"
                    icon={<FileTextOutlined />}
                    loading={generateOrderDocument.isPending}
                    onClick={() => void handleGenerateDoc("PROFORMA")}
                  >
                    Generate Proforma
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<FilePdfOutlined />}
                    disabled={!isPaid}
                    loading={generateOrderDocument.isPending}
                    title={!isPaid ? "Draft invoice locked until payment verified" : ""}
                    onClick={() => void handleGenerateDoc("DRAFT_INVOICE")}
                  >
                    Generate Draft Invoice
                  </Button>
                </Space>
              }
            >
              <Table
                dataSource={docsQuery.data?.documents || []}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: "No financial documents generated yet. Click above to generate draft proforma." }}
                columns={[
                  {
                    title: "Doc Number",
                    dataIndex: "doc_number",
                    render: (val: string) => (
                      <Typography.Text strong style={{ fontFamily: "monospace" }}>
                        {val}
                      </Typography.Text>
                    ),
                  },
                  {
                    title: "Type",
                    dataIndex: "doc_type",
                    render: (t: string) => (
                      <Tag color={t === "DRAFT_INVOICE" ? "blue" : t === "PROFORMA" ? "cyan" : "volcano"}>
                        {t}
                      </Tag>
                    ),
                  },
                  {
                    title: "Authority",
                    key: "auth",
                    render: () => <Tag color="orange">Draft / Not a Tax Invoice</Tag>,
                  },
                  {
                    title: "Total Amount",
                    dataIndex: "total_inr",
                    align: "right",
                    render: (amt: number) => formatInr(amt),
                  },
                  {
                    title: "Created",
                    dataIndex: "created_at",
                    render: (d: string) => formatDate(d, true),
                  },
                  {
                    title: "Action",
                    key: "act",
                    align: "center",
                    render: (_, row: any) => (
                      <Button
                        size="small"
                        type="link"
                        icon={<EyeOutlined />}
                        onClick={() => setViewDocModal(row)}
                      >
                        View
                      </Button>
                    ),
                  },
                ]}
              />
            </AdminSectionCard>

            <AdminSectionCard title="Order Activity Timeline">
              {events.length > 0 ? (
                <Timeline
                  items={events.map((ev: any, idx: number) => ({
                    key: String(idx),
                    color: "#079D9A",
                    children: (
                      <div>
                        <Typography.Text strong>{ev.status || ev.event || "Update"}</Typography.Text>
                        <Typography.Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
                          {formatDate(ev.created_at || ev.timestamp, true)}
                        </Typography.Text>
                        {ev.note && (
                          <div style={{ fontSize: 12.5, color: "#64748B", marginTop: 2 }}>
                            {ev.note}
                          </div>
                        )}
                      </div>
                    ),
                  }))}
                />
              ) : (
                <Typography.Text type="secondary">No status updates recorded yet.</Typography.Text>
              )}
            </AdminSectionCard>
          </Space>
        </Col>

        <Col xs={24} lg={9}>
          <AdminSectionCard
            title="Update Dispatch & Routing"
            subtitle="Changes save directly to Medusa PostgreSQL"
          >
            <Form form={form} layout="vertical" onFinish={(v) => void handleSave(v)}>
              <Form.Item label="Order Status" name="status" rules={[{ required: true }]}>
                <Select
                  options={STATUS_OPTIONS.map((s) => ({
                    label: s.replace(/_/g, " "),
                    value: s,
                  }))}
                />
              </Form.Item>

              <Form.Item label="Fulfillment Routing" name="routingStatus">
                <Select options={ROUTING_OPTIONS} />
              </Form.Item>

              <Form.Item
                label="Assigned Distributor"
                name="assignedDistributorId"
                dependencies={["routingStatus"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_, value) => {
                      if (getFieldValue("routingStatus") === "ROUTED_TO_DISTRIBUTOR" && !value) {
                        throw new Error("Select a distributor when routing to distributor.");
                      }
                    },
                  }),
                ]}
              >
                <Select
                  allowClear
                  placeholder="Direct Sai Ajantha (None)"
                  options={distributors.map((d) => ({
                    label: `${d.organization || d.name} (${d.business_city || "TN"})`,
                    value: d.id,
                  }))}
                />
              </Form.Item>

              <Form.Item
                label="Assigned Dealer"
                name="assignedDealerId"
                dependencies={["routingStatus"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_, value) => {
                      if (getFieldValue("routingStatus") === "ASSIGNED_TO_DEALER" && !value) {
                        throw new Error("Select a dealer when assigning to dealer.");
                      }
                    },
                  }),
                ]}
              >
                <Select
                  allowClear
                  placeholder="Optional dealer assignment"
                  options={dealers.map((d) => ({
                    label: `${d.organization || d.name} (${d.business_city || "TN"})`,
                    value: d.id,
                  }))}
                />
              </Form.Item>

              <Form.Item
                label="Courier / Transport Name"
                name="shippingCarrier"
                dependencies={["status"]}
                rules={[
                  ({ getFieldValue }) => ({
                    validator: async (_, value) => {
                      if (getFieldValue("status") === "DISPATCHED" && !String(value || "").trim()) {
                        throw new Error("Enter courier or transport name for dispatched orders.");
                      }
                    },
                  }),
                ]}
              >
                <Input placeholder="e.g. KPN Parcel / ST Courier / Local Delivery" />
              </Form.Item>

              <Form.Item label="Tracking / LR Number" name="trackingReference">
                <Input placeholder="e.g. LR-2026-09821" />
              </Form.Item>

              <Form.Item label="Update Note (Optional)" name="eventNote">
                <Input.TextArea rows={2} placeholder="Add dispatch or handoff remark" />
              </Form.Item>

              <Space style={{ width: "100%" }} direction="vertical" size={8}>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  icon={<SaveOutlined />}
                  loading={updateOrder.isPending}
                  disabled={updateOrder.isPending}
                >
                  Save Order Update
                </Button>
                <Button
                  block
                  icon={<UndoOutlined />}
                  disabled={!isDirty || updateOrder.isPending}
                  onClick={handleResetOrderForm}
                >
                  Reset Changes
                </Button>
              </Space>
            </Form>
          </AdminSectionCard>
        </Col>
      </Row>

      <Modal
        open={cancelOpen}
        title="Cancel Order?"
        onCancel={() => setCancelOpen(false)}
        onOk={() => void handleCancelOrder()}
        okText="Yes, Cancel Order"
        okButtonProps={{ danger: true }}
        confirmLoading={updateOrder.isPending}
      >
        <Typography.Paragraph style={{ marginBottom: 0 }}>
          Are you sure you want to cancel order <strong>{order.order_number}</strong>? Note: automatic online refunds remain disabled until approved by management.
        </Typography.Paragraph>
      </Modal>

      {/* Verify Bank Payment Modal */}
      <Modal
        open={verifyModalOpen}
        title="Verify Bank Payment"
        onCancel={() => setVerifyModalOpen(false)}
        onOk={() => verifyForm.submit()}
        okText="Confirm & Mark Paid"
        confirmLoading={transitionOrder.isPending}
      >
        <Form form={verifyForm} layout="vertical" onFinish={(v) => void handleVerifyPayment(v)}>
          <Form.Item
            label="Bank Reference / UTR Number"
            name="bankReference"
            rules={[{ required: true, message: "Bank reference / UTR is required" }]}
          >
            <Input placeholder="e.g. UTR-2026-HDFC-99120" />
          </Form.Item>
          <Form.Item
            label="Verified Received Amount (INR)"
            name="verifiedAmountInr"
            rules={[{ required: true, message: "Verified amount is required" }]}
          >
            <Input type="number" prefix="₹" />
          </Form.Item>
          <Form.Item label="Verification Notes" name="notes">
            <Input.TextArea rows={2} placeholder="e.g. Verified credited in current account on statement date" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Bank Payment Modal */}
      <Modal
        open={rejectModalOpen}
        title="Reject Bank Payment Proof"
        onCancel={() => setRejectModalOpen(false)}
        onOk={() => rejectForm.submit()}
        okText="Reject Payment"
        okButtonProps={{ danger: true }}
        confirmLoading={transitionOrder.isPending}
      >
        <Form form={rejectForm} layout="vertical" onFinish={(v) => void handleRejectPayment(v)}>
          <Form.Item
            label="Reason for Rejection"
            name="rejectionReason"
            rules={[{ required: true, message: "Rejection reason is required" }]}
          >
            <Input.TextArea rows={3} placeholder="e.g. UTR not found on bank statement, or amount mismatch." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Dispatch Order Modal */}
      <Modal
        open={dispatchModalOpen}
        title="Dispatch Order"
        onCancel={() => setDispatchModalOpen(false)}
        onOk={() => dispatchForm.submit()}
        okText="Mark Dispatched"
        confirmLoading={transitionOrder.isPending}
      >
        <Form form={dispatchForm} layout="vertical" onFinish={(v) => void handleDispatch(v)}>
          <Form.Item
            label="Carrier / Transport Agency"
            name="carrierName"
            rules={[{ required: true, message: "Carrier name is required" }]}
          >
            <Input placeholder="e.g. KPN Parcel Service / ST Courier" />
          </Form.Item>
          <Form.Item
            label="Tracking / LR / Consignment Number"
            name="trackingNumber"
            rules={[{ required: true, message: "Tracking number is required" }]}
          >
            <Input placeholder="e.g. LR-99201" />
          </Form.Item>
          <Form.Item label="Dispatch Remarks (Optional)" name="notes">
            <Input.TextArea rows={2} placeholder="Handoff details or vehicle number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Mark Delivered Modal */}
      <Modal
        open={deliverModalOpen}
        title="Confirm Order Delivery"
        onCancel={() => setDeliverModalOpen(false)}
        onOk={() => deliverForm.submit()}
        okText="Confirm Delivery"
        confirmLoading={transitionOrder.isPending}
      >
        <Form form={deliverForm} layout="vertical" onFinish={(v) => void handleDeliver(v)}>
          <Form.Item label="Delivery Confirmation Notes (Optional)" name="notes">
            <Input.TextArea rows={3} placeholder="e.g. Delivered and acknowledged by recipient." />
          </Form.Item>
        </Form>
      </Modal>

      {/* View Document Modal */}
      <Modal
        open={Boolean(viewDocModal)}
        title={
          <Space>
            <span>Document {viewDocModal?.doc_number}</span>
            <Tag color="orange">Draft / Not a Tax Invoice</Tag>
          </Space>
        }
        width={700}
        onCancel={() => setViewDocModal(null)}
        footer={[
          <Button key="close" onClick={() => setViewDocModal(null)}>
            Close
          </Button>,
          <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
            Print Document
          </Button>,
        ]}
      >
        {viewDocModal && (
          <div>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              message="Non-Official Draft Document"
              description="This draft document is issued for operational quotation and delivery verification. Official tax invoice issuance remains pending owner accounting policy."
            />
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Doc Number">{viewDocModal.doc_number}</Descriptions.Item>
              <Descriptions.Item label="Type">{viewDocModal.doc_type}</Descriptions.Item>
              <Descriptions.Item label="Issuer">{viewDocModal.issuer_legal_name || "Sai Ajantha Interior Solutions"}</Descriptions.Item>
              <Descriptions.Item label="Issuer GSTIN">{viewDocModal.issuer_gstin || "To be updated on fiscal policy approval"}</Descriptions.Item>
              <Descriptions.Item label="Buyer State Code">{viewDocModal.buyer_state_code || "33 (Tamil Nadu)"}</Descriptions.Item>
              <Descriptions.Item label="Date">{formatDate(viewDocModal.created_at, true)}</Descriptions.Item>
              <Descriptions.Item label="Subtotal">{formatInr(viewDocModal.subtotal_inr)}</Descriptions.Item>
              <Descriptions.Item label="GST Total">{formatInr(viewDocModal.gst_total_inr)}</Descriptions.Item>
              <Descriptions.Item label="Grand Total" span={2}>
                <Typography.Text strong style={{ fontSize: 16 }}>
                  {formatInr(viewDocModal.total_inr)}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

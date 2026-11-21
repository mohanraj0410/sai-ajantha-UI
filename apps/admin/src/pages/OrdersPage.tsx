import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, Col, Flex, Row, Select, Space, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useAdminDataset } from "../api/adminQueries";
import type { PortalOrderRow } from "../api/adminClient";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
  formatDate,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminStatusTabs } from "../components/common/AdminStatusTabs";
import { AdminTable } from "../components/common/AdminTable";
import { BRAND_TOKENS } from "../theme/antdTheme";

const ORDER_STATUSES = [
  "ALL",
  "PENDING_PAYMENT",
  "BOQ_QUOTE_REQUESTED",
  "CONFIRMED_TRADE_PO",
  "CONFIRMED",
  "PROCESSING",
  "DISPATCHED",
  "DELIVERED",
  "COMPLETED",
  "PACKED",
  "AWAITING_FINANCE_APPROVAL",
  "CANCELLED",
] as const;

export const OrdersPage: React.FC = () => {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const statusFilter = searchParams.get("status") || "ALL";
  const paymentFilter = searchParams.get("payment") || "ALL";
  const [sellerFilter, setSellerFilter] = useState<string>("ALL");
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const portal = useAdminDataset<PortalOrderRow>(staff?.email || "anon", "orders", { tab: activeTab, status: statusFilter, payment: paymentFilter, seller: sellerFilter, q: searchText });

  const updateParam = (key: string, val: string) => {
    const next = new URLSearchParams(searchParams);
    if (val === "ALL") next.delete(key);
    else next.set(key, val);
    setSearchParams(next, { replace: true });
  };

  const filtered = portal.data?.items || [];
  const metrics = { total: portal.data?.counts.ALL, paid: portal.data?.counts.PAID, unpaid: portal.data?.counts.UNPAID, bankProofs: portal.data?.counts.BANK_PROOF, delivered: portal.data?.counts.DELIVERED };

  const columns: TableProps<PortalOrderRow>["columns"] = [
    {
      title: "Order ID",
      dataIndex: "order_number",
      key: "order_number",
      width: 155,
      sorter: true,
      render: (val: string) => (
        <Typography.Text strong style={{ color: BRAND_TOKENS.teal, fontFamily: "monospace" }}>
          {val}
        </Typography.Text>
      ),
    },
    {
      title: "Customer",
      key: "customer",
      width: 210,
      ellipsis: true,
      render: (_, row) => (
        <div>
          <Typography.Text strong style={{ display: "block" }}>
            {row.customer_name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {row.organization || row.customer_email || "—"} • {row.price_tier_applied || "Buyer"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Seller",
      key: "seller",
      width: 155,
      render: (_, row) => {
        const isDist =
          Boolean(row.assigned_distributor_id) ||
          ["ROUTED_TO_DISTRIBUTOR", "ASSIGNED_TO_DEALER", "DELIVERED_BY_DEALER"].includes(
            row.routing_status || ""
          );
        return <AdminStatusTag status={isDist ? "DISTRIBUTOR" : "SAI_AJANTHA"} />;
      },
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 125,
      sorter: true,
      render: (val: string) => formatDate(val),
    },
    {
      title: "Total",
      dataIndex: "total_inr",
      key: "total_inr",
      align: "right",
      width: 125,
      sorter: true,
      render: (val: number) => <Typography.Text strong>{formatInr(val)}</Typography.Text>,
    },
    {
      title: "Payment",
      dataIndex: "payment_status",
      key: "payment_status",
      align: "center",
      width: 115,
      render: (val: string) => <AdminStatusTag status={val} />,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 140,
      render: (val: string) => <AdminStatusTag status={val} />,
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      width: 90,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/orders/${row.id}`);
          }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Orders"
        subtitle="Track customer and trade orders, payment status, seller routing, and dispatch updates."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Orders" }]}
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Total Orders"
            value={metrics.total}
            helper="Direct & distributor"
            icon={<ShoppingCartOutlined />}
            accentColor={BRAND_TOKENS.navy}
            highlightTop
          />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Paid Orders"
            value={metrics.paid}
            helper="Server-verified payment"
            icon={<CheckCircleOutlined />}
            accentColor="#16A34A"
            highlightTop
          />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Unpaid / Pending"
            value={metrics.unpaid}
            helper="Awaiting payment"
            icon={<ClockCircleOutlined />}
            accentColor="#D97706"
            highlightTop
          />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Delivered"
            value={metrics.delivered}
            helper="Completed dispatches"
            icon={<TruckOutlined />}
            accentColor={BRAND_TOKENS.teal}
            highlightTop
          />
        </Col>
      </Row>

      <AdminStatusTabs query={portal} activeKey={activeTab} onChange={setActiveTab}
        items={[{"key":"ALL","label":"All"},{"key":"BANK_PROOF","label":"Bank Proofs"},{"key":"ACTION","label":"Needs Payment / Review"},{"key":"PROCESSING","label":"In Progress & Dispatched"},{"key":"DELIVERED","label":"Delivered / Completed"},{"key":"CANCELLED","label":"Cancelled"}]}
        note="Queues overlap and may omit lifecycle states. All includes every matching order." />

      <AdminTable<PortalOrderRow>
        title="Order Queue"
        dataSource={filtered}
        pagination={portal.pagination}
        onChange={portal.onTableChange}
        columns={columns}
        rowKey="id"
        loading={portal.isLoading}
        error={portal.isError ? "Failed to load orders." : null}
        onRetry={() => void portal.refetch()}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search order #, customer name, or city..."
        hasActiveFilters={
          statusFilter !== "ALL" || paymentFilter !== "ALL" || sellerFilter !== "ALL" || Boolean(searchText)
        }
        onClearFilters={() => {
          setSearchText("");
          setSellerFilter("ALL");
          setSearchParams({}, { replace: true });
        }}
        emptyTitle="No orders placed yet"
        emptyDescription="Customer and distributor orders will appear here with payment and dispatch tracking."
        emptyActionLabel="Review Quotes"
        onEmptyAction={() => navigate("/quotes")}
        onRefresh={() => void portal.refetch()}
        refreshing={portal.isFetching}
        showDensityToggle
        getExportRows={portal.getExportRows}
        exportFilename="sai-ajanta-orders.csv"
        exportMapper={(o) => ({
          OrderNumber: o.order_number,
          Customer: o.customer_name,
          ShippingAddress: o.shipping_address || "",
          TotalInr: o.total_inr,
          PaymentStatus: o.payment_status,
          FulfilmentStatus: o.status,
          CreatedAt: o.created_at,
        })}
        filterControls={
          <Space wrap size={8}>
            <Select
              value={sellerFilter}
              onChange={setSellerFilter}
              style={{ width: 165 }}
              options={[
                { label: "All Sellers", value: "ALL" },
                { label: "Sai Ajantha Direct", value: "DIRECT" },
                { label: "Distributor", value: "DISTRIBUTOR" },
              ]}
            />
            <Select
              value={paymentFilter}
              onChange={(v) => updateParam("payment", v)}
              style={{ width: 145 }}
              options={[
                { label: "All Payments", value: "ALL" },
                { label: "Paid", value: "PAID" },
                { label: "Pending", value: "PENDING" },
                { label: "Unpaid", value: "UNPAID" },
                { label: "Failed", value: "FAILED" },
              ]}
            />
            <Select
              value={statusFilter}
              onChange={(v) => updateParam("status", v)}
              style={{ width: 175 }}
              options={ORDER_STATUSES.map((s) => ({
                label: s === "ALL" ? "All Statuses" : s.replace(/_/g, " "),
                value: s,
              }))}
            />
          </Space>
        }
        onRowClick={(row) => navigate(`/orders/${row.id}`)}
        renderMobileItem={(row) => (
          <Card
            size="small"
            bordered
            onClick={() => navigate(`/orders/${row.id}`)}
            style={{ borderRadius: 12, cursor: "pointer" }}
          >
            <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
              <Typography.Text strong style={{ color: BRAND_TOKENS.teal }}>
                {row.order_number}
              </Typography.Text>
              <Typography.Text strong>{formatInr(row.total_inr)}</Typography.Text>
            </Flex>
            <Typography.Text style={{ display: "block", fontSize: 13.5 }}>
              {row.customer_name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
              {formatDate(row.created_at)} • {row.organization || row.customer_email || "—"}
            </Typography.Text>
            <Space wrap size={4}>
              <AdminStatusTag status={row.payment_status} />
              <AdminStatusTag status={row.status} />
              <Tag style={{ margin: 0 }}>{row.price_tier_applied || "Buyer"}</Tag>
            </Space>
          </Card>
        )}
      />
    </div>
  );
};

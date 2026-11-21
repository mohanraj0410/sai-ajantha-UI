import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Card, Col, Flex, Row, Select, Space, Tabs, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import {
  DatabaseOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  HomeOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useInventoryLedger, useOverviewData, usePortalData } from "../api/adminQueries";
import type { InventoryLedgerResponseDto } from "../api/adminClient";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
  formatDate,
} from "../components/common/AdminPrimitives";
import { AdminBlockedApiBanner } from "../components/common/AdminStateView";
import { AdminTable } from "../components/common/AdminTable";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import { BRAND_TOKENS } from "../theme/antdTheme";

interface StockRow {
  id: string;
  sku: string;
  title: string;
  category: string;
  billingUnit: string;
  stockQty: number;
  active: boolean;
}

type ReservationRow = InventoryLedgerResponseDto["reservations"][number];
type MovementRow = InventoryLedgerResponseDto["movements"][number];

export const InventoryPage: React.FC = () => {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isReservations = location.pathname.includes("reservations");
  const isAdjustments = location.pathname.includes("adjustments");

  const overview = useOverviewData(staff?.email || "anon");
  const portal = usePortalData(staff?.email || "anon");
  const ledger = useInventoryLedger(staff?.email || "anon", isReservations || isAdjustments);

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW" | "OUT">("ALL");

  const products: StockRow[] = useMemo(() => {
    if (portal.data?.products && portal.data.products.length > 0) {
      return portal.data.products.map((p: any) => ({
        id: p.id,
        sku: p.sku,
        title: p.name,
        category: p.category,
        billingUnit: p.billing_unit || "Unit",
        stockQty: Number(p.stock_qty ?? p.stockQty) || 0,
        active: p.cms_status === "PUBLISHED",
      }));
    }
    return [];
  }, [portal.data?.products]);

  const stockLocations = useMemo(
    () => overview.data?.stockLocations || [],
    [overview.data?.stockLocations]
  );

  const metrics = useMemo(() => {
    let lowStock = 0;
    let outOfStock = 0;
    let totalUnits = 0;
    for (const p of products) {
      const qty = Number(p.stockQty) || 0;
      totalUnits += qty;
      if (qty <= 0) outOfStock++;
      else if (qty <= 10) lowStock++;
    }
    return {
      trackedSkus: products.length,
      lowStock,
      outOfStock,
      totalUnits,
      warehouses: stockLocations.length,
    };
  }, [products, stockLocations]);

  const filteredStock: StockRow[] = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return products
      .filter((p) => {
        if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
        const qty = Number(p.stockQty) || 0;
        if (stockFilter === "OUT" && qty > 0) return false;
        if (stockFilter === "LOW" && (qty <= 0 || qty > 10)) return false;
        if (q) {
          const hay = `${p.title} ${p.sku} ${p.category}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .map((p) => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        category: p.category,
        billingUnit: p.billingUnit || "Unit",
        stockQty: Number(p.stockQty) || 0,
        active: Boolean(p.active),
      }));
  }, [products, categoryFilter, stockFilter, searchText]);

  const currentTab = isReservations ? "reservations" : isAdjustments ? "adjustments" : "stock";

  const stockColumns: TableProps<StockRow>["columns"] = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 155,
      sorter: (a, b) => a.sku.localeCompare(b.sku),
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: "Product",
      dataIndex: "title",
      key: "title",
      width: 260,
      ellipsis: true,
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 170,
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: "Unit",
      dataIndex: "billingUnit",
      key: "billingUnit",
      width: 120,
    },
    {
      title: "Stock Available",
      dataIndex: "stockQty",
      key: "stockQty",
      align: "right",
      width: 140,
      sorter: (a, b) => a.stockQty - b.stockQty,
      render: (qty: number) => (
        <Tag
          color={qty <= 0 ? "error" : qty <= 10 ? "warning" : "success"}
          className="sa-num"
          style={{ margin: 0, fontWeight: 700 }}
        >
          {qty <= 0 ? "Out of Stock" : `${qty.toLocaleString("en-IN")} in stock`}
        </Tag>
      ),
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      width: 110,
      fixed: "right",
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          icon={<EditOutlined />}
          onClick={() => navigate(`/products/${row.id}/edit`)}
        >
          Edit Stock
        </Button>
      ),
    },
  ];

  const reservationColumns: TableProps<ReservationRow>["columns"] = [
    { title: "Order ID", dataIndex: "order_id", key: "order_id", width: 160, ellipsis: true },
    { title: "SKU", dataIndex: "sku", key: "sku", width: 150 },
    { title: "Seller", dataIndex: "seller_id", key: "seller_id", width: 150, ellipsis: true },
    { title: "Reserved Qty", dataIndex: "quantity", key: "quantity", align: "right", width: 120 },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      align: "center",
      width: 130,
      render: (v: string) => <AdminStatusTag status={v} />,
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 125,
      render: (v: string) => formatDate(v),
    },
  ];

  const movementColumns: TableProps<MovementRow>["columns"] = [
    { title: "Inventory Item", dataIndex: "inventory_item_id", key: "inventory_item_id", width: 165, ellipsis: true },
    { title: "Type", dataIndex: "movement_type", key: "movement_type", width: 160 },
    { title: "Physical", dataIndex: "delta_physical", key: "delta_physical", align: "right", width: 110 },
    { title: "Reserved", dataIndex: "delta_reserved", key: "delta_reserved", align: "right", width: 110 },
    { title: "Actor", dataIndex: "actor_type", key: "actor_type", width: 130 },
    { title: "Reason", dataIndex: "reason", key: "reason", ellipsis: true },
    {
      title: "Recorded At",
      dataIndex: "created_at",
      key: "created_at",
      width: 135,
      render: (v: string) => formatDate(v, true),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Inventory"
        subtitle="Monitor real stock levels, low-stock alerts, order reservations, and movement history."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Inventory" }]}
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Tracked SKUs" value={metrics.trackedSkus} icon={<DatabaseOutlined />} accentColor={BRAND_TOKENS.navy} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Total Units" value={metrics.totalUnits.toLocaleString("en-IN")} icon={<HomeOutlined />} accentColor={BRAND_TOKENS.teal} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Low Stock (≤10)" value={metrics.lowStock} icon={<ExclamationCircleOutlined />} accentColor="#D97706" highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Out of Stock" value={metrics.outOfStock} icon={<WarningOutlined />} accentColor="#DC2626" highlightTop />
        </Col>
      </Row>

      <Tabs
        activeKey={currentTab}
        onChange={(key) => {
          if (key === "reservations") navigate("/inventory/reservations");
          else if (key === "adjustments") navigate("/inventory/adjustments");
          else navigate("/inventory");
        }}
        style={{ marginBottom: 10 }}
        items={[
          { key: "stock", label: "Stock Available" },
          { key: "reservations", label: "Order Reservations" },
          { key: "adjustments", label: "Movement History" },
        ]}
      />

      {currentTab === "stock" && (
        <AdminTable<StockRow>
          title="Warehouse Stock"
          dataSource={filteredStock}
          columns={stockColumns}
          rowKey="id"
          loading={portal.isPending}
          error={portal.isError ? "Failed to load inventory levels." : null}
          onRetry={() => {
            void overview.refetch();
            void portal.refetch();
          }}
          searchValue={searchText}
          onSearchChange={setSearchText}
          searchPlaceholder="Search SKU or product name..."
          hasActiveFilters={categoryFilter !== "ALL" || stockFilter !== "ALL" || Boolean(searchText)}
          onClearFilters={() => {
            setSearchText("");
            setCategoryFilter("ALL");
            setStockFilter("ALL");
          }}
          onRefresh={() => {
            void overview.refetch();
            void portal.refetch();
          }}
          refreshing={overview.isFetching || portal.isFetching}
          exportFilename="sai-ajanta-inventory.csv"
          exportMapper={(r) => ({
            SKU: r.sku,
            Product: r.title,
            Category: r.category,
            Unit: r.billingUnit,
            StockAvailable: r.stockQty,
          })}
          filterControls={
            <Space wrap size={8}>
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 200 }}
                options={[
                  { label: "All Categories", value: "ALL" },
                  ...ELEVEN_CATEGORIES.map((c) => ({ label: c, value: c })),
                ]}
              />
              <Select
                value={stockFilter}
                onChange={(v) => setStockFilter(v as "ALL" | "LOW" | "OUT")}
                style={{ width: 155 }}
                options={[
                  { label: "All Stock Levels", value: "ALL" },
                  { label: "Low Stock (1–10)", value: "LOW" },
                  { label: "Out of Stock (0)", value: "OUT" },
                ]}
              />
            </Space>
          }
          renderMobileItem={(row) => (
            <Card size="small" bordered style={{ borderRadius: 12 }}>
              <Flex justify="space-between" align="flex-start" gap={8}>
                <div>
                  <Typography.Text strong style={{ display: "block" }}>{row.title}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.sku} • {row.category}
                  </Typography.Text>
                </div>
                <Tag color={row.stockQty === 0 ? "error" : row.stockQty <= 10 ? "warning" : "success"} style={{ margin: 0 }}>
                  {row.stockQty}
                </Tag>
              </Flex>
              <Flex justify="flex-end" style={{ marginTop: 8 }}>
                <Button size="small" icon={<EditOutlined />} onClick={() => navigate(`/products/${row.id}/edit`)}>
                  Update Stock
                </Button>
              </Flex>
            </Card>
          )}
        />
      )}

      {currentTab === "reservations" && (
        <>
          <AdminBlockedApiBanner
            title="Read-Only Order Reservations"
            description="Stock reservations are created automatically when orders are placed. Manual reservation overrides remain disabled until warehouse lock rules are approved."
          />
          <AdminTable<ReservationRow>
            title="Active Stock Reservations"
            dataSource={ledger.data?.reservations || []}
            columns={reservationColumns}
            rowKey={(r) => r.id}
            loading={ledger.isLoading}
            error={ledger.isError ? "Failed to load reservations." : null}
            onRetry={() => void ledger.refetch()}
            scrollX={780}
            emptyTitle="No active reservations"
            emptyDescription="Reserved stock quantities from open orders will appear here."
          />
        </>
      )}

      {currentTab === "adjustments" && (
        <>
          <AdminBlockedApiBanner
            title="Manual Stock Adjustments"
            description="To update a SKU's stock quantity right now, edit the product directly from Stock Available. Bulk adjustment ledger posting is read-only pending warehouse sign-off."
          />
          <AdminTable<MovementRow>
            title="Stock Movement Log"
            dataSource={ledger.data?.movements || []}
            columns={movementColumns}
            rowKey={(r) => r.id}
            loading={ledger.isLoading}
            error={ledger.isError ? "Failed to load movement history." : null}
            onRetry={() => void ledger.refetch()}
            scrollX={820}
            emptyTitle="No stock adjustments recorded"
            emptyDescription="Recorded inventory movements will appear here."
          />
        </>
      )}
    </div>
  );
};

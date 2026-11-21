import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Flex,
  List,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";
import type { TableProps } from "antd";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  PlusOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  TruckOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../auth/AuthContext";
import { useAnalyticsData, usePortalData, useTradeQuotes } from "../api/adminQueries";
import type { PortalOrderRow } from "../api/adminClient";
import { computeActionQueueMetrics } from "../utils/actionQueueCounts";
import { summarizeCatalogueAnalytics } from "../utils/catalogueClassification";
import {
  AdminKpiCard,
  AdminPageHeader,
  AdminSectionCard,
  AdminStatusTag,
  formatDate,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminErrorState, AdminLoadingState } from "../components/common/AdminStateView";
import { AdminTable } from "../components/common/AdminTable";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import { BRAND_TOKENS } from "../theme/antdTheme";

const FINANCIAL_YEARS = ["FY 2026–27", "FY 2025–26", "FY 2024–25"] as const;

export const DashboardPage: React.FC = () => {
  const { staff, hasPermission, themeMode } = useAuth();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const actorKey = staff?.email || "anon";
  const [selectedFy, setSelectedFy] = useState<string>("FY 2026–27");
  const [chartView, setChartView] = useState<"CATEGORY" | "SALES">("CATEGORY");

  const portal = usePortalData(actorKey);
  const quotesQuery = useTradeQuotes(actorKey, hasPermission("ENQUIRIES_MANAGE"));
  const analytics = useAnalyticsData(actorKey, { fy: selectedFy });

  const derived = useMemo(() => {
    const orders = portal.data?.orders || [];
    const products = portal.data?.products || [];
    const users = portal.data?.users || [];
    const queue = computeActionQueueMetrics(portal.data, quotesQuery.data?.quotes);

    const unpaidActiveOrders = orders.filter(
      (o) => o.payment_status !== "PAID" && o.status !== "CANCELLED"
    ).length;

    const publishedProducts = products.filter((p) => p.cms_status === "PUBLISHED").length;
    const catStats = summarizeCatalogueAnalytics(products);

    let saiAjanthaDirectInr = 0;
    let saiAjanthaDirectCount = 0;
    let distributorResaleInr = 0;
    let distributorResaleCount = 0;

    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      const amt = Number(o.total_inr) || 0;
      const isDistResale =
        Boolean(o.assigned_distributor_id) ||
        ["ROUTED_TO_DISTRIBUTOR", "ASSIGNED_TO_DEALER", "DELIVERED_BY_DEALER"].includes(
          o.routing_status || ""
        );
      if (isDistResale) {
        distributorResaleInr += amt;
        distributorResaleCount += 1;
      } else {
        saiAjanthaDirectInr += amt;
        saiAjanthaDirectCount += 1;
      }
    }

    const categoryBars = ELEVEN_CATEGORIES.map((cat) => {
      const matched = products.filter((p) => p.category === cat);
      const stockUnits = matched.reduce((acc, p) => acc + (Number(p.stock_qty) || 0), 0);
      return {
        category: cat,
        short: cat.length > 12 ? `${cat.slice(0, 10)}…` : cat,
        skus: matched.length,
        stock: stockUnits,
      };
    });

    return {
      totalOrders: orders.length,
      totalProducts: products.length,
      totalPartners: users.length,
      publishedProducts,
      directSkus: catStats.directCategorySkus,
      distributorCategorySkus: catStats.distributorCategorySkus,
      floorSpringQuoteOnlySkus: catStats.floorSpringQuoteOnlySkus,
      totalQuoteOnlySkus: catStats.totalQuoteOnlySkus,
      directCheckoutEligibleSkus: catStats.directCheckoutEligibleSkus,
      unpaidActiveOrders,
      dispatchQueue: queue.dispatchQueue,
      pendingBankProofs: queue.pendingBankProofs,
      lowStockSkus: queue.lowStockSkus,
      unapprovedProducts: queue.unapprovedProducts,
      pendingPartnersCount: queue.pendingPartnersCount,
      openEnquiries: queue.openEnquiries,
      openQuotes: queue.openQuotes,
      activeReturns: queue.activeReturns,
      saiAjanthaDirectInr,
      saiAjanthaDirectCount,
      distributorResaleInr,
      distributorResaleCount,
      recentOrders: orders.slice(0, 6),
      categoryBars,
    };
  }, [portal.data, quotesQuery.data?.quotes]);

  const fyMonths = analytics.data?.financialYear?.months || [];
  const salesChartData = useMemo(
    () =>
      fyMonths.map((m) => ({
        month: m.name || m.key,
        sales: Math.round(Number(m.totalAmount) || 0),
        orders: Number(m.ordersCount) || 0,
      })),
    [fyMonths]
  );
  const hasSalesSeries = salesChartData.some((d) => d.sales > 0 || d.orders > 0);

  const isDark = themeMode === "dark";

  const routePieData = useMemo(
    () =>
      [
        {
          name: "Sai Ajantha Direct",
          value: derived.directSkus,
          color: isDark ? "#38BDF8" : "#1E3A8A",
        },
        {
          name: "Distributor Category",
          value: derived.distributorCategorySkus,
          color: BRAND_TOKENS.teal,
        },
        {
          name: "Floor Springs (Quote Only)",
          value: derived.floorSpringQuoteOnlySkus,
          color: "#D97706",
        },
      ].filter((slice) => slice.value > 0),
    [
      derived.directSkus,
      derived.distributorCategorySkus,
      derived.floorSpringQuoteOnlySkus,
      isDark,
    ]
  );

  const todayStr = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (portal.isLoading) {
    return (
      <div>
        <AdminPageHeader title="Dashboard" subtitle="Loading live data..." />
        <AdminLoadingState rows={6} />
      </div>
    );
  }

  if (portal.isError) {
    return (
      <div>
        <AdminPageHeader title="Dashboard" />
        <AdminErrorState
          message={
            portal.error instanceof Error ? portal.error.message : "Failed to load dashboard data."
          }
          onRetry={() => void portal.refetch()}
        />
      </div>
    );
  }

  const recentOrderColumns: TableProps<PortalOrderRow>["columns"] = [
    {
      title: "Order ID",
      dataIndex: "order_number",
      key: "order_number",
      width: 135,
      render: (val: string) => (
        <Typography.Text strong style={{ color: BRAND_TOKENS.teal, fontFamily: "monospace" }}>
          {val}
        </Typography.Text>
      ),
    },
    {
      title: "Customer",
      dataIndex: "customer_name",
      key: "customer_name",
      width: 175,
      ellipsis: true,
      render: (val: string, row) => (
        <div>
          <Typography.Text strong style={{ display: "block", fontSize: 13 }}>
            {val || "Customer"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
            {row.organization || row.customer_email || "—"}
          </Typography.Text>
        </div>
      ),
    },
    {
      title: "Date",
      dataIndex: "created_at",
      key: "created_at",
      width: 110,
      render: (val: string) => formatDate(val),
    },
    {
      title: "Total",
      dataIndex: "total_inr",
      key: "total_inr",
      align: "right",
      width: 110,
      render: (val: number) => (
        <Typography.Text strong className="sa-num">
          {formatInr(val)}
        </Typography.Text>
      ),
    },
    {
      title: "Status",
      key: "status",
      align: "center",
      width: 120,
      render: (_, row) => <AdminStatusTag status={row.status} />,
    },
    {
      title: "",
      key: "action",
      align: "center",
      width: 72,
      render: (_, row) => (
        <Button
          size="small"
          type="link"
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

  const actionQueueItems = [
    {
      key: "bankproofs",
      title: "Bank Proof Reviews",
      desc: "UTR submissions awaiting finance verification",
      count: derived.pendingBankProofs,
      severity: derived.pendingBankProofs > 0 ? "warning" : "ok",
      path: "/orders",
      visible: hasPermission("ORDERS_MANAGE"),
    },
    {
      key: "approvals",
      title: "Partner Approvals",
      desc: "Dealers & distributors awaiting review",
      count: derived.pendingPartnersCount,
      severity: derived.pendingPartnersCount > 0 ? "warning" : "ok",
      path: "/dealers/approvals",
      visible: hasPermission("CUSTOMERS_MANAGE"),
    },
    {
      key: "dispatch",
      title: "Orders to Dispatch",
      desc: "Confirmed orders ready for handoff",
      count: derived.dispatchQueue,
      severity: derived.dispatchQueue > 0 ? "active" : "ok",
      path: "/orders",
      visible: hasPermission("ORDERS_MANAGE"),
    },
    {
      key: "enquiries",
      title: "Open Enquiries",
      desc: "Customer questions & quote requests",
      count: derived.openEnquiries,
      severity: derived.openEnquiries > 0 ? "active" : "ok",
      path: "/enquiries",
      visible: hasPermission("ENQUIRIES_MANAGE"),
    },
    {
      key: "lowstock",
      title: "Low Stock Alerts",
      desc: "SKUs with 10 or fewer units",
      count: derived.lowStockSkus,
      severity: derived.lowStockSkus > 0 ? "error" : "ok",
      path: "/inventory",
      visible: hasPermission("CATALOG_MANAGE"),
    },
    {
      key: "reviews",
      title: "Unpublished SKUs",
      desc: "Drafts not yet live on storefront",
      count: derived.unapprovedProducts,
      severity: derived.unapprovedProducts > 0 ? "warning" : "ok",
      path: "/products/review",
      visible: hasPermission("CATALOG_MANAGE"),
    },
  ].filter((item) => item.visible);

  const publishedPercent =
    derived.totalProducts > 0
      ? Math.round((derived.publishedProducts / derived.totalProducts) * 100)
      : 0;

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        subtitle={`Live operations overview • ${todayStr}`}
        extra={
          <>
            <Select
              value={selectedFy}
              onChange={setSelectedFy}
              style={{ width: 132 }}
              options={FINANCIAL_YEARS.map((fy) => ({ label: fy, value: fy }))}
            />
            {hasPermission("ORDERS_MANAGE") && (
              <Button type="primary" onClick={() => navigate("/orders")}>
                View Orders
              </Button>
            )}
            {hasPermission("CATALOG_MANAGE") && (
              <Button icon={<PlusOutlined />} onClick={() => navigate("/products/new")}>
                Add Product
              </Button>
            )}
          </>
        }
      />

      {/* Row 1: Primary 4 Actionable KPI Cards */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={12} xl={6}>
          <AdminKpiCard
            label="Total Orders"
            value={derived.totalOrders}
            helper={`${derived.unpaidActiveOrders} awaiting payment`}
            icon={<ShoppingCartOutlined />}
            accentColor={BRAND_TOKENS.navy}
            highlightTop
            onClick={() => hasPermission("ORDERS_MANAGE") && navigate("/orders")}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AdminKpiCard
            label="Orders to Dispatch"
            value={derived.dispatchQueue}
            helper="Packing & dispatch queue"
            icon={<TruckOutlined />}
            accentColor={BRAND_TOKENS.teal}
            highlightTop
            tag={
              derived.dispatchQueue > 0
                ? { text: "Action", color: "processing" }
                : { text: "Clear", color: "success" }
            }
            onClick={() => hasPermission("ORDERS_MANAGE") && navigate("/orders")}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AdminKpiCard
            label="Pending Approvals"
            value={derived.pendingPartnersCount}
            helper={`${derived.totalPartners} total accounts`}
            icon={<TeamOutlined />}
            accentColor="#D97706"
            tag={
              derived.pendingPartnersCount > 0
                ? { text: "Review", color: "warning" }
                : { text: "Up to Date", color: "success" }
            }
            onClick={() => hasPermission("CUSTOMERS_MANAGE") && navigate("/dealers/approvals")}
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AdminKpiCard
            label="Active Catalogue SKUs"
            value={derived.totalProducts}
            helper={`${derived.directSkus} direct • ${derived.distributorCategorySkus} dist. cat. • ${derived.totalQuoteOnlySkus} quote-only`}
            icon={<AppstoreOutlined />}
            accentColor={BRAND_TOKENS.teal}
            tag={{ text: `${publishedPercent}% Published`, color: "cyan" }}
            onClick={() => hasPermission("CATALOG_MANAGE") && navigate("/products")}
          />
        </Col>
      </Row>

      {/* Row 2: Seller-Separated Financial Summary */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} md={12}>
          <AdminKpiCard
            label="Sai Ajantha Direct Sales"
            value={formatInr(derived.saiAjanthaDirectInr)}
            helper={`${derived.saiAjanthaDirectCount} direct orders across 9 direct categories`}
            icon={<ShopOutlined />}
            accentColor={BRAND_TOKENS.navy}
            tag={{ text: "Direct Seller", color: "geekblue" }}
            onClick={() => navigate("/reports")}
          />
        </Col>
        <Col xs={24} md={12}>
          <AdminKpiCard
            label="Distributor Resale Value"
            value={formatInr(derived.distributorResaleInr)}
            helper={`${derived.distributorResaleCount} distributor orders (separate from direct revenue)`}
            icon={<TruckOutlined />}
            accentColor={BRAND_TOKENS.teal}
            tag={{ text: "Distributor Stream", color: "cyan" }}
            onClick={() => navigate("/reports")}
          />
        </Col>
      </Row>

      {/* Pending Partner Alert */}
      {derived.pendingPartnersCount > 0 && hasPermission("CUSTOMERS_MANAGE") && (
        <Alert
          type="warning"
          showIcon
          style={{ borderRadius: 10, marginBottom: 14 }}
          message={`${derived.pendingPartnersCount} trade partner application(s) waiting for review`}
          action={
            <Button size="small" type="primary" onClick={() => navigate("/dealers/approvals")}>
              Review Now
            </Button>
          }
        />
      )}

      {/* Row 3: Live Recharts Analytics (2/3 Primary Chart + 1/3 Catalogue Grouping Mix) */}
      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} lg={16}>
          <AdminSectionCard
            title={
              chartView === "CATEGORY"
                ? "Catalogue SKUs Across 11 Categories"
                : `Sales & Order Trend (${selectedFy})`
            }
            subtitle={
              chartView === "CATEGORY"
                ? `Catalogue snapshot (${derived.totalProducts} SKUs) — not sales volume`
                : "Verified monthly order totals from Medusa backend"
            }
            extra={
              <Segmented
                size="small"
                value={chartView}
                onChange={(v) => setChartView(v as "CATEGORY" | "SALES")}
                options={[
                  { label: "Category SKUs", value: "CATEGORY" },
                  { label: "Sales Trend", value: "SALES" },
                ]}
              />
            }
            style={{ height: "100%" }}
          >
            {chartView === "CATEGORY" ? (
              <div style={{ width: "100%", height: 268 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={derived.categoryBars} margin={{ top: 8, right: 12, left: -10, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                    <XAxis
                      dataKey="short"
                      interval={0}
                      angle={-18}
                      textAnchor="end"
                      height={46}
                      tick={{ fontSize: 10.5, fill: token.colorTextSecondary }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11.5, fill: token.colorTextSecondary }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <RechartsTooltip
                      formatter={(val: any, name: any) =>
                        name === "skus" ? [`${val} SKUs`, "Products"] : [val, "Stock Units"]
                      }
                      labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.category || ""}
                      contentStyle={{
                        borderRadius: 9,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorBgElevated,
                        fontSize: 12.5,
                      }}
                    />
                    <Bar
                      dataKey="skus"
                      fill={BRAND_TOKENS.teal}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : analytics.isLoading ? (
              <AdminLoadingState rows={3} />
            ) : hasSalesSeries ? (
              <div style={{ width: "100%", height: 268 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesChartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="saSalesGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND_TOKENS.teal} stopOpacity={0.28} />
                        <stop offset="95%" stopColor={BRAND_TOKENS.teal} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11.5, fill: token.colorTextSecondary }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11.5, fill: token.colorTextSecondary }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`}
                    />
                    <RechartsTooltip
                      formatter={(val: number) => [formatInr(val), "Order Value"]}
                      contentStyle={{
                        borderRadius: 9,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorBgElevated,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke={BRAND_TOKENS.teal}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#saSalesGrad)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: "26px 12px", textAlign: "center" }}>
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  imageStyle={{ height: 40, marginBottom: 8 }}
                  description={
                    <Space direction="vertical" size={2}>
                      <Typography.Text strong style={{ fontSize: 13.5 }}>
                        No sales recorded for {selectedFy} yet
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Real order totals will chart here automatically as orders come in.
                      </Typography.Text>
                    </Space>
                  }
                >
                  <Space>
                    <Button size="small" onClick={() => setChartView("CATEGORY")}>
                      View Category SKUs
                    </Button>
                    <Button size="small" type="primary" onClick={() => navigate("/quotes")}>
                      Open Quotes
                    </Button>
                  </Space>
                </Empty>
              </div>
            )}
          </AdminSectionCard>
        </Col>

        <Col xs={24} lg={8}>
          <AdminSectionCard
            title="Catalogue Grouping Mix"
            subtitle="Direct, Distributor Cat. & Quote-Only"
            extra={
              <Button size="small" type="link" onClick={() => navigate("/categories")}>
                Categories <ArrowRightOutlined />
              </Button>
            }
            style={{ height: "100%" }}
          >
            <div style={{ position: "relative", width: "100%", height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={routePieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={44}
                    outerRadius={66}
                    paddingAngle={3}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {routePieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: any, name: any) => [`${v} SKUs`, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <Space direction="vertical" size={6} style={{ width: "100%", marginTop: 4 }}>
              {routePieData.map((entry) => (
                <Flex key={entry.name} justify="space-between" align="center">
                  <Space size={6}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: 3,
                        background: entry.color,
                        display: "inline-block",
                      }}
                    />
                    <Typography.Text style={{ fontSize: 12 }}>{entry.name}</Typography.Text>
                  </Space>
                  <Typography.Text strong className="sa-num" style={{ fontSize: 12 }}>
                    {entry.value} SKUs
                  </Typography.Text>
                </Flex>
              ))}
              <div style={{ paddingTop: 6, borderTop: `1px solid ${token.colorBorderSecondary}` }}>
                <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                    Published in Catalogue
                  </Typography.Text>
                  <Typography.Text strong className="sa-num" style={{ fontSize: 11.5 }}>
                    {derived.publishedProducts} / {derived.totalProducts}
                  </Typography.Text>
                </Flex>
                <Progress percent={publishedPercent} strokeColor={BRAND_TOKENS.teal} size="small" />
                <Typography.Text
                  type="secondary"
                  style={{ display: "block", fontSize: 11, marginTop: 4, lineHeight: 1.35 }}
                >
                  Catalogue grouping only. {derived.floorSpringQuoteOnlySkus} Floor Springs stay quote-only; distributor resale checkout awaits owner approval.
                </Typography.Text>
              </div>
            </Space>
          </AdminSectionCard>
        </Col>
      </Row>

      {/* Row 4: Action Queue + Recent Orders */}
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={9}>
          <AdminSectionCard
            title="Action Queue"
            subtitle="Daily operational checks"
            style={{ height: "100%" }}
          >
            <List
              dataSource={actionQueueItems}
              size="small"
              split
              renderItem={(item) => (
                <List.Item
                  onClick={() => navigate(item.path)}
                  style={{ cursor: "pointer", padding: "9px 2px" }}
                  extra={
                    <Space size={6}>
                      <Badge
                        count={item.count}
                        showZero
                        color={
                          item.count === 0
                            ? "#94A3B8"
                            : item.severity === "error"
                            ? "#DC2626"
                            : item.severity === "warning"
                            ? "#D97706"
                            : BRAND_TOKENS.teal
                        }
                      />
                      <ArrowRightOutlined style={{ color: "#94A3B8", fontSize: 11 }} />
                    </Space>
                  }
                >
                  <List.Item.Meta
                    avatar={
                      item.count > 0 ? (
                        item.severity === "error" ? (
                          <WarningOutlined style={{ color: "#DC2626", fontSize: 15, marginTop: 3 }} />
                        ) : (
                          <ExclamationCircleOutlined
                            style={{ color: "#D97706", fontSize: 15, marginTop: 3 }}
                          />
                        )
                      ) : (
                        <CheckCircleOutlined style={{ color: "#16A34A", fontSize: 15, marginTop: 3 }} />
                      )
                    }
                    title={<Typography.Text strong style={{ fontSize: 13 }}>{item.title}</Typography.Text>}
                    description={
                      <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
                        {item.desc}
                      </Typography.Text>
                    }
                  />
                </List.Item>
              )}
            />
          </AdminSectionCard>
        </Col>

        <Col xs={24} lg={15}>
          <AdminTable<PortalOrderRow>
            title="Recent Orders"
            subtitle="Latest customer and trade orders"
            dataSource={derived.recentOrders}
            columns={recentOrderColumns}
            rowKey="id"
            scrollX={680}
            pagination={false}
            onRowClick={(row) => navigate(`/orders/${row.id}`)}
            toolbarActions={
              hasPermission("ORDERS_MANAGE") ? (
                <Button size="small" onClick={() => navigate("/orders")}>
                  All Orders <ArrowRightOutlined />
                </Button>
              ) : undefined
            }
            emptyTitle="No orders placed yet"
            emptyDescription="Direct and distributor orders will appear here as buyers check out."
            emptyActionLabel="Review Quotes"
            onEmptyAction={() => navigate("/quotes")}
            renderMobileItem={(row) => (
              <Card
                size="small"
                bordered
                onClick={() => navigate(`/orders/${row.id}`)}
                style={{ borderRadius: 10, cursor: "pointer" }}
              >
                <Flex justify="space-between" align="center" style={{ marginBottom: 4 }}>
                  <Typography.Text strong style={{ color: BRAND_TOKENS.teal }}>
                    {row.order_number}
                  </Typography.Text>
                  <Typography.Text strong className="sa-num">
                    {formatInr(row.total_inr)}
                  </Typography.Text>
                </Flex>
                <Typography.Text style={{ display: "block", fontSize: 13 }}>
                  {row.customer_name}
                </Typography.Text>
                <Flex justify="space-between" align="center" style={{ marginTop: 6 }}>
                  <Space size={4}>
                    <AdminStatusTag status={row.payment_status} />
                    <AdminStatusTag status={row.status} />
                  </Space>
                  <Tag style={{ margin: 0 }}>{formatDate(row.created_at)}</Tag>
                </Flex>
              </Card>
            )}
          />
        </Col>
      </Row>
    </div>
  );
};

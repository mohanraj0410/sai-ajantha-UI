import React, { useMemo, useState } from "react";
import { Button, Col, Empty, Flex, Progress, Row, Segmented, Space, Table, Tag, Typography, theme } from "antd";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  PrinterOutlined,
  ShopOutlined,
  TruckOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import {
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
import { usePortalData } from "../api/adminQueries";
import {
  AdminPageHeader,
  AdminSectionCard,
  AdminStatCard,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminErrorState, AdminLoadingState } from "../components/common/AdminStateView";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import { BRAND_TOKENS } from "../theme/antdTheme";
import {
  isFloorSpringProduct,
  summarizeCatalogueAnalytics,
} from "../utils/catalogueClassification";

function sanitizeCsvCell(val: string | number): string {
  const str = String(val ?? "");
  const trimmed = str.trim();
  // Neutralize spreadsheet formula injection (=, +, -, @)
  const safeStr = /^[=+\-@\t\r]/.test(trimmed) ? `'${trimmed}` : trimmed;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

export const ReportsPage: React.FC = () => {
  const { staff, themeMode } = useAuth();
  const { token } = theme.useToken();
  const portal = usePortalData(staff?.email || "anon");
  const [sellerScope, setSellerScope] = useState<"ALL" | "DIRECT" | "DISTRIBUTOR">("ALL");

  const orders = useMemo(() => portal.data?.orders || [], [portal.data?.orders]);
  const products = useMemo(() => portal.data?.products || [], [portal.data?.products]);

  const metrics = useMemo(() => {
    let directInr = 0;
    let distributorResaleInr = 0;
    let paidInr = 0;
    let deliveredCount = 0;
    let cancelledCount = 0;

    const filtered = orders.filter((o) => {
      const isDist =
        Boolean(o.assigned_distributor_id) ||
        ["ROUTED_TO_DISTRIBUTOR", "ASSIGNED_TO_DEALER", "DELIVERED_BY_DEALER"].includes(
          o.routing_status || ""
        );
      if (sellerScope === "DIRECT" && isDist) return false;
      if (sellerScope === "DISTRIBUTOR" && !isDist) return false;
      return true;
    });

    for (const o of filtered) {
      const amt = Number(o.total_inr) || 0;
      const isDist =
        Boolean(o.assigned_distributor_id) ||
        ["ROUTED_TO_DISTRIBUTOR", "ASSIGNED_TO_DEALER", "DELIVERED_BY_DEALER"].includes(
          o.routing_status || ""
        );
      if (o.status !== "CANCELLED") {
        if (isDist) distributorResaleInr += amt;
        else directInr += amt;
      }
      if (o.payment_status === "PAID") paidInr += amt;
      if (["DELIVERED", "COMPLETED"].includes(o.status)) deliveredCount++;
      if (o.status === "CANCELLED") cancelledCount++;
    }

    return {
      orderCount: filtered.length,
      directInr,
      distributorResaleInr,
      paidInr,
      deliveredCount,
      cancelledCount,
    };
  }, [orders, sellerScope]);

  const catStats = useMemo(() => summarizeCatalogueAnalytics(products), [products]);

  const categorySummary = useMemo(() => {
    return ELEVEN_CATEGORIES.map((cat) => {
      const catProds = products.filter((p) => p.category === cat);
      const stockTotal = catProds.reduce((sum, p) => sum + (Number(p.stock_qty) || 0), 0);
      const published = catProds.filter((p) => p.cms_status === "PUBLISHED").length;
      const quoteOnlyCount = catProds.filter(
        (p) => isFloorSpringProduct(p) || !(Number(p.customer_price_inr || 0) > 0)
      ).length;
      return {
        category: cat,
        shortName: cat.length > 14 ? `${cat.slice(0, 12)}…` : cat,
        skuCount: catProds.length,
        published,
        quoteOnlyCount,
        stockTotal,
        seller:
          cat === "Door Closer & Floor Spring"
            ? "Distributor Cat. + Quote-Only (FS)"
            : cat === "Kitchen Basket"
            ? "Distributor Category"
            : "Sai Ajantha Direct",
      };
    });
  }, [products]);

  const isDark = themeMode === "dark";

  const sellerMix = useMemo(() => {
    return {
      totalSkus: catStats.totalSkus,
      publishedSkus: catStats.publishedSkus,
      publishedPct:
        catStats.totalSkus > 0
          ? Math.round((catStats.publishedSkus / catStats.totalSkus) * 100)
          : 0,
      slices: [
        {
          name: "Sai Ajantha Direct",
          value: catStats.directCategorySkus,
          color: isDark ? "#38BDF8" : "#1E3A8A",
        },
        {
          name: "Distributor Category",
          value: catStats.distributorCategorySkus,
          color: BRAND_TOKENS.teal,
        },
        {
          name: "Floor Springs (Quote Only)",
          value: catStats.floorSpringQuoteOnlySkus,
          color: "#D97706",
        },
      ].filter((s) => s.value > 0),
    };
  }, [catStats, isDark]);

  const handleExportCsv = () => {
    const header = "Category,SellerRoute,TotalSKUs,PublishedSKUs,StockUnits";
    const rows = categorySummary.map(
      (c) =>
        `${sanitizeCsvCell(c.category)},${sanitizeCsvCell(c.seller)},${Number(c.skuCount) || 0},${Number(c.published) || 0},${Number(c.stockTotal) || 0}`
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sai-ajanta-category-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (portal.isLoading) {
    return <AdminLoadingState rows={6} title="Building real-time reports..." />;
  }
  if (portal.isError) {
    return <AdminErrorState message="Failed to load report data." onRetry={() => void portal.refetch()} />;
  }

  return (
    <div>
      <AdminPageHeader
        title="Reports"
        subtitle="Seller-separated revenue summary and catalog stock distribution across all 11 categories."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Reports" }]}
        extra={
          <Space wrap>
            <Segmented
              value={sellerScope}
              onChange={(v) => setSellerScope(v as "ALL" | "DIRECT" | "DISTRIBUTOR")}
              options={[
                { label: "All Sellers", value: "ALL" },
                { label: "Sai Ajantha Direct", value: "DIRECT" },
                { label: "Distributor", value: "DISTRIBUTOR" },
              ]}
            />
            <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>
              Export CSV
            </Button>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              Print
            </Button>
          </Space>
        }
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={12} xl={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Sai Ajantha Direct Sales"
            value={formatInr(metrics.directInr)}
            helper="Direct seller order total"
            icon={<ShopOutlined />}
            accentColor={BRAND_TOKENS.teal}
            highlightTop
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Distributor Resale Value"
            value={formatInr(metrics.distributorResaleInr)}
            helper="Separate from direct revenue"
            icon={<TruckOutlined />}
            accentColor="#0891B2"
            highlightTop
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Verified Paid Total"
            value={formatInr(metrics.paidInr)}
            helper="Server-confirmed payments"
            icon={<WalletOutlined />}
            accentColor="#16A34A"
            highlightTop
          />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError}
            label="Delivered Orders"
            value={metrics.deliveredCount}
            helper={`${metrics.cancelledCount} cancelled of ${metrics.orderCount}`}
            icon={<CheckCircleOutlined />}
            accentColor={BRAND_TOKENS.navy}
            highlightTop
          />
        </Col>
      </Row>

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} lg={16}>
          <AdminSectionCard
            title="Catalogue SKUs by Category"
            subtitle="Catalogue snapshot across all 11 approved categories (not sales volume)"
          >
            {categorySummary.some((c) => c.skuCount > 0) ? (
              <div style={{ width: "100%", height: 272 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categorySummary} margin={{ top: 8, right: 12, left: -12, bottom: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                    <XAxis
                      dataKey="shortName"
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
                      formatter={(val: any) => [`${val} SKUs`, "Products"]}
                      labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.category || ""}
                      contentStyle={{
                        borderRadius: 9,
                        border: `1px solid ${token.colorBorderSecondary}`,
                        background: token.colorBgElevated,
                        fontSize: 12.5,
                      }}
                    />
                    <Bar
                      dataKey="skuCount"
                      fill={BRAND_TOKENS.teal}
                      radius={[5, 5, 0, 0]}
                      maxBarSize={36}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty description="No products found to chart." />
            )}
          </AdminSectionCard>
        </Col>

        <Col xs={24} lg={8}>
          <AdminSectionCard
            title="Catalogue Grouping & Publish Share"
            subtitle="Direct • Distributor Cat. • Quote-Only Floor Springs"
            style={{ height: "100%" }}
          >
            {sellerMix.slices.length > 0 ? (
              <div>
                <div style={{ width: "100%", height: 152 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={sellerMix.slices}
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
                        {sellerMix.slices.map((s) => (
                          <Cell key={s.name} fill={s.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        formatter={(val: any, name: any) => [`${val} SKUs`, name]}
                        contentStyle={{
                          borderRadius: 8,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          background: token.colorBgElevated,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <Space direction="vertical" size={5} style={{ width: "100%", marginTop: 4 }}>
                  {sellerMix.slices.map((s) => (
                    <Flex key={s.name} justify="space-between" align="center" style={{ fontSize: 12 }}>
                      <Flex align="center" gap={6}>
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 3,
                            background: s.color,
                            display: "inline-block",
                          }}
                        />
                        <Typography.Text style={{ fontSize: 12 }}>{s.name}</Typography.Text>
                      </Flex>
                      <Typography.Text strong className="sa-num" style={{ fontSize: 12 }}>
                        {s.value} SKUs
                      </Typography.Text>
                    </Flex>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    <Flex justify="space-between" style={{ fontSize: 11.5, marginBottom: 2 }}>
                      <Typography.Text type="secondary">Published in Catalogue</Typography.Text>
                      <Typography.Text strong className="sa-num">
                        {sellerMix.publishedSkus}/{sellerMix.totalSkus} ({sellerMix.publishedPct}%)
                      </Typography.Text>
                    </Flex>
                    <Progress percent={sellerMix.publishedPct} showInfo={false} size="small" strokeColor={BRAND_TOKENS.teal} />
                    <Typography.Text type="secondary" style={{ display: "block", fontSize: 11, marginTop: 4, lineHeight: 1.35 }}>
                      Category grouping only; 8 Floor Springs stay quote-only &amp; distributor resale checkout awaits owner approval.
                    </Typography.Text>
                  </div>
                </Space>
              </div>
            ) : (
              <Empty description="No SKUs to display." />
            )}
          </AdminSectionCard>
        </Col>
      </Row>

      <AdminSectionCard title="Category Health Breakdown" noPadding>
        <Table
          dataSource={categorySummary}
          rowKey="category"
          pagination={false}
          size="small"
          scroll={{ x: 720 }}
          columns={[
            {
              title: "Category",
              dataIndex: "category",
              render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
            },
            {
              title: "Catalogue Group",
              dataIndex: "seller",
              render: (v: string) => (
                <Tag
                  color={v.includes("Quote-Only") ? "orange" : v.includes("Distributor") ? "cyan" : "geekblue"}
                  style={{ margin: 0 }}
                >
                  {v}
                </Tag>
              ),
            },
            {
              title: "Total SKUs",
              dataIndex: "skuCount",
              align: "right",
              render: (v: number) => <span className="sa-num">{v}</span>,
            },
            {
              title: "Published",
              dataIndex: "published",
              align: "right",
              render: (v: number) => <span className="sa-num">{v}</span>,
            },
            {
              title: "Quote-Only",
              dataIndex: "quoteOnlyCount",
              align: "right",
              render: (v: number) =>
                v > 0 ? (
                  <Tag color="orange" className="sa-num" style={{ margin: 0 }}>
                    {v}
                  </Tag>
                ) : (
                  <Typography.Text type="secondary" className="sa-num">0</Typography.Text>
                ),
            },
            {
              title: "Total Stock Units",
              dataIndex: "stockTotal",
              align: "right",
              render: (v: number) => <span className="sa-num">{v.toLocaleString("en-IN")}</span>,
            },
          ]}
        />
      </AdminSectionCard>
    </div>
  );
};

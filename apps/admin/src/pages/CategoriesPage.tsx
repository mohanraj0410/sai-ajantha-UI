import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Card, Col, Flex, Row, Segmented, Tag, Typography } from "antd";
import type { TableProps } from "antd";
import {
  AppstoreOutlined,
  ArrowRightOutlined,
  PlusOutlined,
  ShopOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useOverviewData } from "../api/adminQueries";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
} from "../components/common/AdminPrimitives";
import { AdminTable } from "../components/common/AdminTable";
import { BRAND_TOKENS } from "../theme/antdTheme";
import {
  isFloorSpringProduct,
  summarizeCatalogueAnalytics,
} from "../utils/catalogueClassification";

interface CategoryRow {
  id: string;
  name: string;
  seller: string;
  liveSkuCount: number;
  quoteOnlyCount: number;
  policyNote: string;
  isHouseOfAjanta: boolean;
}

export const CategoriesPage: React.FC = () => {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const overview = useOverviewData(staff?.email || "anon");
  const [segment, setSegment] = useState<"ALL" | "DIRECT" | "HOUSE">("ALL");

  const products = overview.data?.products || [];
  const catSummary = useMemo(() => summarizeCatalogueAnalytics(products), [products]);

  const allRows: CategoryRow[] = useMemo(() => {
    return ELEVEN_CATEGORIES.map((name) => {
      const isHouse = name === "Door Closer & Floor Spring" || name === "Kitchen Basket";
      const matched = products.filter((p) => p.category === name);
      const quoteOnlyCount = matched.filter((p) => isFloorSpringProduct(p)).length;
      return {
        id: name,
        name,
        seller:
          name === "Door Closer & Floor Spring"
            ? "Distributor Cat. + Quote-Only (FS)"
            : isHouse
            ? "Distributor Category Group"
            : "Sai Ajantha Direct",
        liveSkuCount: matched.length,
        quoteOnlyCount,
        policyNote:
          name === "Door Closer & Floor Spring"
            ? `${matched.length - quoteOnlyCount} Door Closers (Distributor Cat.) • ${quoteOnlyCount} Floor Springs (Quote Only — route pending)`
            : isHouse
            ? "Distributor-led catalogue group (resale checkout awaits owner approval)"
            : "Sold directly by Sai Ajantha to Buyers & Dealers",
        isHouseOfAjanta: isHouse,
      };
    });
  }, [products]);

  const filteredRows = useMemo(() => {
    if (segment === "DIRECT") return allRows.filter((r) => !r.isHouseOfAjanta);
    if (segment === "HOUSE") return allRows.filter((r) => r.isHouseOfAjanta);
    return allRows;
  }, [allRows, segment]);

  const columns: TableProps<CategoryRow>["columns"] = [
    {
      title: "Category",
      dataIndex: "name",
      key: "name",
      width: 225,
      render: (val: string) => <Typography.Text strong>{val}</Typography.Text>,
    },
    {
      title: "Catalogue Group",
      key: "route",
      width: 190,
      render: (_, row) => (
        <AdminStatusTag status={row.isHouseOfAjanta ? "HOUSE_OF_AJANTHA" : "SAI_AJANTHA"} />
      ),
    },
    {
      title: "Fulfilling Seller",
      dataIndex: "seller",
      key: "seller",
      width: 210,
    },
    {
      title: "Live SKUs",
      dataIndex: "liveSkuCount",
      key: "liveSkuCount",
      align: "right",
      width: 100,
      sorter: (a, b) => a.liveSkuCount - b.liveSkuCount,
      render: (val: number) => (
        <Tag color={val > 0 ? "cyan" : "default"} className="sa-num" style={{ margin: 0, fontWeight: 600 }}>
          {val}
        </Tag>
      ),
    },
    {
      title: "Quote-Only",
      dataIndex: "quoteOnlyCount",
      key: "quoteOnlyCount",
      align: "right",
      width: 105,
      render: (val: number) =>
        val > 0 ? (
          <Tag color="orange" className="sa-num" style={{ margin: 0, fontWeight: 600 }}>
            {val} FS
          </Tag>
        ) : (
          <Typography.Text type="secondary" className="sa-num">0</Typography.Text>
        ),
    },
    {
      title: "Business Rule",
      dataIndex: "policyNote",
      key: "policyNote",
      ellipsis: true,
    },
    {
      title: "Action",
      key: "action",
      align: "center",
      width: 115,
      render: () => (
        <Button size="small" type="link" onClick={() => navigate("/products")}>
          View SKUs <ArrowRightOutlined />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        subtitle="Approved 11 categories: 9 Sai Ajantha Direct, 2 Distributor Category lines, with 8 Floor Springs kept Quote Only."
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Categories" },
        ]}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/products/new")}>
            Add Product
          </Button>
        }
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={24} sm={8}>
          <AdminStatCard loading={overview.isPending} unavailable={overview.isError}
            label="Configured Category Groups"
            value={allRows.length}
            helper={`${catSummary.totalSkus} SKUs • ${catSummary.floorSpringQuoteOnlySkus} Floor Springs quote-only`}
            icon={<AppstoreOutlined />}
            accentColor={BRAND_TOKENS.navy}
            highlightTop
          />
        </Col>
        <Col xs={24} sm={8}>
          <AdminStatCard loading={overview.isPending} unavailable={overview.isError}
            label="Sai Ajantha Direct"
            value={allRows.filter(r => !r.isHouseOfAjanta).length}
            helper={`${catSummary.directCategorySkus} Direct category SKUs`}
            icon={<ShopOutlined />}
            accentColor={BRAND_TOKENS.teal}
            highlightTop
          />
        </Col>
        <Col xs={24} sm={8}>
          <AdminStatCard loading={overview.isPending} unavailable={overview.isError}
            label="Distributor Category Group"
            value={allRows.filter(r => r.isHouseOfAjanta).length}
            helper={`${catSummary.distributorCategorySkus} Door Closers & Baskets (+ ${catSummary.floorSpringQuoteOnlySkus} FS quote-only)`}
            icon={<TruckOutlined />}
            accentColor="#0891B2"
            highlightTop
          />
        </Col>
      </Row>

      <AdminTable<CategoryRow>
        title="Category & Seller Policy"
        dataSource={filteredRows}
        columns={columns}
        rowKey="id"
        loading={overview.isLoading}
        error={overview.isError ? "Failed to load category counts." : null}
        onRetry={() => void overview.refetch()}
        pagination={false}
        scrollX={880}
        filterControls={
          <Segmented
            value={segment}
            onChange={(v) => setSegment(v as "ALL" | "DIRECT" | "HOUSE")}
            options={[
              { label: `All (${allRows.length})`, value: "ALL" },
              { label: `Direct (${allRows.filter(r => !r.isHouseOfAjanta).length})`, value: "DIRECT" },
              { label: `House of Ajantha (${allRows.filter(r => r.isHouseOfAjanta).length})`, value: "HOUSE" },
            ]}
          />
        }
        renderMobileItem={(row) => (
          <Card size="small" bordered style={{ borderRadius: 12 }}>
            <Flex justify="space-between" align="center" style={{ marginBottom: 6 }}>
              <Typography.Text strong>{row.name}</Typography.Text>
              <Tag color="cyan" style={{ margin: 0 }}>{row.liveSkuCount} SKUs</Tag>
            </Flex>
            <div style={{ marginBottom: 6 }}>
              <AdminStatusTag status={row.isHouseOfAjanta ? "HOUSE_OF_AJANTHA" : "SAI_AJANTHA"} />
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.policyNote}
            </Typography.Text>
          </Card>
        )}
      />
    </div>
  );
};

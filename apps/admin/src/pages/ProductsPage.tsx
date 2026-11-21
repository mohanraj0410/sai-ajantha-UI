import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  Flex,
  Modal,
  Select,
  Space,
  Tag,
  Typography,
} from "antd";
import type { MenuProps, TableProps } from "antd";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  EditOutlined,
  EyeOutlined,
  MoreOutlined,
  PlusOutlined,
  SendOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useAdminMutations, useAdminDataset } from "../api/adminQueries";
import type { PortalProductRow } from "../api/adminClient";
import {
  AdminPageHeader,
  AdminStatusTag,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminStatusTabs } from "../components/common/AdminStatusTabs";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { BRAND_TOKENS } from "../theme/antdTheme";
import { isFloorSpringProduct } from "../utils/catalogueClassification";

export const ELEVEN_CATEGORIES = [
  "Insect Screens",
  "Aluminium",
  "Hardware",
  "Ladder",
  "Rubber & PVC",
  "FGM Fittings",
  "Clip",
  "Frames & Channels",
  "Mesh",
  "Door Closer & Floor Spring",
  "Kitchen Basket",
] as const;

function getProductStage(p: PortalProductRow): "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED" {
  if (p.cms_status) return p.cms_status;
  if (p.active && p.approved) return "PUBLISHED";
  if (p.approved) return "APPROVED";
  return "DRAFT";
}

function getNextStage(stage: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED") {
  if (stage === "DRAFT") return "REVIEW" as const;
  if (stage === "REVIEW") return "APPROVED" as const;
  if (stage === "APPROVED") return "PUBLISHED" as const;
  return "DRAFT" as const;
}

export const ProductsPage: React.FC = () => {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isReviewQueue = location.pathname.endsWith("/review");
  const { showToast } = useAdminToast();
  const { updateProduct } = useAdminMutations();

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [sellerRouteFilter, setSellerRouteFilter] = useState<string>("ALL");
  const [statusTab, setStatusTab] = useState<string>(isReviewQueue ? "NEEDS_APPROVAL" : "ALL");
  const [confirmToggle, setConfirmToggle] = useState<PortalProductRow | null>(null);

  useEffect(() => {
    setStatusTab(isReviewQueue ? "NEEDS_APPROVAL" : "ALL");
  }, [isReviewQueue]);

  const portal = useAdminDataset<PortalProductRow>(staff?.email || "anon", "products", {
    tab: statusTab,
    category: categoryFilter,
    sellerRoute: sellerRouteFilter,
    q: searchText,
  });
  const filtered = (portal.data?.items || []).filter((item) => {
    if (sellerRouteFilter === "ALL") return true;
    const isDistributor =
      item.seller_route === "DISTRIBUTOR_CHANNEL" ||
      item.category === "Kitchen Basket" ||
      item.category === "Door Closer & Floor Spring";
    if (sellerRouteFilter === "DISTRIBUTOR_CHANNEL") return isDistributor;
    if (sellerRouteFilter === "DIRECT_SAI_AJANTHA") return !isDistributor;
    return true;
  });

  const handleStageTransition = async () => {
    if (!confirmToggle) return;
    try {
      const current = getProductStage(confirmToggle);
      const next = getNextStage(current);
      const nextApproved = next === "APPROVED" || next === "PUBLISHED";
      await updateProduct.mutateAsync({
        productId: confirmToggle.medusa_id || confirmToggle.id,
        payload: {
          cmsStatus: next,
          approved: nextApproved,
          active: next === "PUBLISHED",
        },
      });
      showToast(`${confirmToggle.sku} moved to ${next}.`, "success");
      setConfirmToggle(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update product status.", "error");
    }
  };

  const columns: TableProps<PortalProductRow>["columns"] = [
    {
      title: "Product & SKU",
      key: "product",
      width: 280,
      sorter: true,
      render: (_, row) => (
        <Space size={10} align="center">
          <Avatar
            shape="square"
            size={40}
            src={row.src || undefined}
            icon={<AppstoreOutlined />}
            style={{
              borderRadius: 8,
              background: "#E6F7F6",
              color: BRAND_TOKENS.teal,
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <Typography.Text strong ellipsis={{ tooltip: row.name }} style={{ display: "block", maxWidth: 200 }}>
              {row.name}
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {row.sku}
            </Typography.Text>
          </div>
        </Space>
      ),
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 170,
      ellipsis: true,
      sorter: true,
      render: (cat: string) => <Tag style={{ margin: 0 }}>{cat}</Tag>,
    },
    {
      title: "Buyer Price",
      dataIndex: "customer_price_inr",
      key: "customer_price_inr",
      align: "right",
      width: 125,
      sorter: true,
      render: (v: number | null, row) => {
        if (isFloorSpringProduct(row)) {
          return (
            <Space direction="vertical" size={2} style={{ alignItems: "flex-end" }}>
              <Tag color="orange" style={{ margin: 0 }}>
                Quote Only (FS)
              </Tag>
              {v && v > 0 ? (
                <Typography.Text type="secondary" className="sa-num" style={{ fontSize: 11 }}>
                  Ref: {formatInr(v)}
                </Typography.Text>
              ) : null}
            </Space>
          );
        }
        return v && v > 0 ? (
          <Typography.Text strong className="sa-num">{formatInr(v)}</Typography.Text>
        ) : (
          <Tag color="orange" style={{ margin: 0 }}>
            Request Quote
          </Tag>
        );
      },
    },
    {
      title: "Dealer Price",
      dataIndex: "dealer_price_inr",
      key: "dealer_price_inr",
      align: "right",
      width: 120,
      render: (v: number | null) =>
        v && v > 0 ? <span className="sa-num">{formatInr(v)}</span> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "Stock",
      dataIndex: "stock_qty",
      key: "stock_qty",
      align: "right",
      width: 90,
      sorter: true,
      render: (qty: number) => (
        <Tag color={qty <= 0 ? "error" : qty <= 10 ? "warning" : "success"} className="sa-num" style={{ margin: 0, fontWeight: 600 }}>
          {qty ?? 0}
        </Tag>
      ),
    },
    {
      title: "Fulfillment",
      key: "seller_route",
      width: 150,
      render: (_, row) => {
        const isDistributor =
          row.seller_route === "DISTRIBUTOR_CHANNEL" ||
          row.category === "Kitchen Basket" ||
          row.category === "Door Closer & Floor Spring";
        return isDistributor ? (
          <Tag color="purple">Distributor Stock</Tag>
        ) : (
          <Tag color="cyan">Central Warehouse</Tag>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      align: "center",
      width: 120,
      render: (_, row) => <AdminStatusTag status={getProductStage(row)} />,
    },
    {
      title: "Actions",
      key: "actions",
      align: "center",
      width: 100,
      fixed: "right",
      render: (_, row) => {
        const stage = getProductStage(row);
        const nextStage = getNextStage(stage);
        const items: MenuProps["items"] = [
          {
            key: "view",
            icon: <EyeOutlined />,
            label: "View Details",
            onClick: () => navigate(`/products/${row.id}`),
          },
          {
            key: "edit",
            icon: <EditOutlined />,
            label: "Edit Product",
            onClick: () => navigate(`/products/${row.id}/edit`),
          },
          { type: "divider" },
          {
            key: "transition",
            icon: stage === "PUBLISHED" ? <CheckCircleOutlined /> : <SendOutlined />,
            label:
              nextStage === "PUBLISHED"
                ? "Publish Live"
                : nextStage === "APPROVED"
                ? "Approve SKU"
                : nextStage === "REVIEW"
                ? "Send to Review"
                : "Move to Draft",
            onClick: () => setConfirmToggle(row),
          },
        ];

        return (
          <div onClick={(e) => e.stopPropagation()}>
            <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
              <Button size="small" icon={<MoreOutlined />} aria-label={`Actions for ${row.sku}`} />
            </Dropdown>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <AdminPageHeader
        title={isReviewQueue ? "Products Pending Review" : "Products"}
        subtitle="Manage all 11 product categories, prices, stock levels, and publishing status."
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Products" },
        ]}
        extra={
          <>
            <Button icon={<CloudUploadOutlined />} onClick={() => navigate("/products/import")}>
              Import Products
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/products/new")}>
              Add Product
            </Button>
          </>
        }
      />

      <AdminStatusTabs query={portal} activeKey={statusTab} onChange={setStatusTab}
        items={[{"key":"ALL","label":"All Products"},{"key":"PUBLISHED","label":"Published"},{"key":"NEEDS_APPROVAL","label":"Needs Review"},{"key":"DRAFT","label":"Drafts"},{"key":"APPROVED","label":"Approved"}]}
        note="Needs Review includes Drafts." />

      <AdminTable<PortalProductRow>
        title="Product Catalogue"
        dataSource={filtered}
        pagination={portal.pagination}
        onChange={portal.onTableChange}
        columns={columns}
        rowKey={(r) => r.medusa_id || r.id || r.sku}
        loading={portal.isLoading}
        error={portal.isError ? (portal.error instanceof Error ? portal.error.message : "Failed to load products") : null}
        onRetry={() => void portal.refetch()}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search product name, SKU, or brand..."
        hasActiveFilters={categoryFilter !== "ALL" || sellerRouteFilter !== "ALL" || Boolean(searchText)}
        onClearFilters={() => {
          setCategoryFilter("ALL");
          setSellerRouteFilter("ALL");
          setSearchText("");
        }}
        emptyTitle="No products in this view"
        emptyDescription="Add a new SKU or switch tabs to see published items."
        emptyActionLabel="Add Product"
        onEmptyAction={() => navigate("/products/new")}
        onRefresh={() => void portal.refetch()}
        refreshing={portal.isFetching}
        showDensityToggle
        getExportRows={portal.getExportRows}
        exportFilename="sai-ajanta-products.csv"
        exportMapper={(p) => ({
          SKU: p.sku,
          Name: p.name,
          Category: p.category,
          Unit: p.billing_unit,
          BuyerPriceInr: p.customer_price_inr ?? "Request Quote",
          DealerPriceInr: p.dealer_price_inr ?? "",
          DistributorPriceInr: p.distributor_price_inr ?? "",
          Stock: p.stock_qty,
          Fulfillment:
            p.seller_route === "DISTRIBUTOR_CHANNEL" ||
            p.category === "Kitchen Basket" ||
            p.category === "Door Closer & Floor Spring"
              ? "Distributor Stock"
              : "Central Warehouse",
          Status: getProductStage(p),
        })}
        filterControls={
          <Space>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              style={{ width: 190 }}
              options={[
                { label: "All 11 Categories", value: "ALL" },
                ...ELEVEN_CATEGORIES.map((c) => ({ label: c, value: c })),
              ]}
            />
            <Select
              value={sellerRouteFilter}
              onChange={setSellerRouteFilter}
              style={{ width: 190 }}
              options={[
                { label: "All Fulfillment Routes", value: "ALL" },
                { label: "Central Warehouse Only", value: "DIRECT_SAI_AJANTHA" },
                { label: "Distributor Channel Only", value: "DISTRIBUTOR_CHANNEL" },
              ]}
            />
          </Space>
        }
        onRowClick={(row) => navigate(`/products/${row.id}`)}
        renderMobileItem={(row) => (
          <Card
            size="small"
            bordered
            onClick={() => navigate(`/products/${row.id}`)}
            style={{ borderRadius: 12, cursor: "pointer" }}
          >
            <Flex justify="space-between" align="flex-start" gap={10}>
              <Space size={10} align="start">
                <Avatar
                  shape="square"
                  size={42}
                  src={row.src || undefined}
                  icon={<AppstoreOutlined />}
                  style={{ borderRadius: 8, background: "#E6F7F6", color: BRAND_TOKENS.teal }}
                />
                <div>
                  <Typography.Text strong style={{ display: "block", fontSize: 13.5 }}>
                    {row.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {row.sku} • {row.category}
                  </Typography.Text>
                </div>
              </Space>
              <AdminStatusTag status={getProductStage(row)} />
            </Flex>
            <Flex justify="space-between" align="center" style={{ marginTop: 10 }}>
              <Space size={10}>
                <Typography.Text strong>
                  {row.customer_price_inr && row.customer_price_inr > 0
                    ? formatInr(row.customer_price_inr)
                    : "Request Quote"}
                </Typography.Text>
                <Tag color={row.stock_qty <= 10 ? "warning" : "success"} style={{ margin: 0 }}>
                  Stock: {row.stock_qty}
                </Tag>
              </Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/products/${row.id}/edit`);
                }}
              >
                Edit
              </Button>
            </Flex>
          </Card>
        )}
      />

      <Modal
        open={Boolean(confirmToggle)}
        title="Confirm Product Status Change"
        onCancel={() => setConfirmToggle(null)}
        onOk={() => void handleStageTransition()}
        okText="Confirm Change"
        confirmLoading={updateProduct.isPending}
      >
        {confirmToggle && (
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            Move <strong>{confirmToggle.name}</strong> ({confirmToggle.sku}) from{" "}
            <AdminStatusTag status={getProductStage(confirmToggle)} /> to{" "}
            <AdminStatusTag status={getNextStage(getProductStage(confirmToggle))} />?
          </Typography.Paragraph>
        )}
      </Modal>
    </div>
  );
};

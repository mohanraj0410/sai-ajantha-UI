import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, Button, Col, Descriptions, Image, Row, Space, Tag, Typography } from "antd";
import { ArrowLeftOutlined, EditOutlined, PictureOutlined } from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { usePortalData, useProductDetail } from "../api/adminQueries";
import {
  AdminPageHeader,
  AdminSectionCard,
  AdminStatusTag,
  formatInr,
} from "../components/common/AdminPrimitives";
import {
  AdminEmptyState,
  AdminErrorState,
  AdminLoadingState,
} from "../components/common/AdminStateView";
import { classifyCatalogueProduct } from "../utils/catalogueClassification";

export const ProductDetailPage: React.FC = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { staff } = useAuth();
  const portal = usePortalData(staff?.email || "anon");
  const portalProduct = (portal.data?.products || []).find(
    (p) => p.id === productId || p.medusa_id === productId || p.sku === productId
  );
  const singleProduct = useProductDetail(
    staff?.email || "anon",
    productId,
    !portalProduct && !portal.isLoading
  );

  if (portal.isLoading || (singleProduct.isLoading && !portalProduct)) {
    return <AdminLoadingState rows={6} title="Loading product details..." />;
  }

  if (portal.isError && !portalProduct && singleProduct.isError) {
    return (
      <AdminErrorState
        message={
          singleProduct.error instanceof Error
            ? singleProduct.error.message
            : portal.error instanceof Error
              ? portal.error.message
              : "Failed to load product"
        }
        onRetry={() => {
          void portal.refetch();
          void singleProduct.refetch();
        }}
      />
    );
  }

  const product = portalProduct || singleProduct.data?.product;

  if (!product) {
    return (
      <AdminEmptyState
        title="Product not found"
        description={`No product matching "${productId}" was returned by the server.`}
        actionLabel="Back to Products"
        onAction={() => navigate("/products")}
      />
    );
  }

  const classification = classifyCatalogueProduct(product);
  const isHouseOfAjantha = classification.routeGroup === "DISTRIBUTOR_CATEGORY";
  const isFloorSpring = classification.isFloorSpring;
  const stage =
    product.cms_status ||
    (product.active && product.approved ? "PUBLISHED" : product.approved ? "APPROVED" : "DRAFT");

  return (
    <div>
      <AdminPageHeader
        title={product.name}
        subtitle={`SKU: ${product.sku} • ${product.category}`}
        breadcrumbs={[
          { label: "Dashboard", to: "/dashboard" },
          { label: "Products", to: "/products" },
          { label: product.sku },
        ]}
        extra={
          <>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/products")}>
              Back
            </Button>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/products/${product.id}/edit`)}
            >
              Edit Product
            </Button>
          </>
        }
      />

      {isFloorSpring && (
        <Alert
          type="info"
          showIcon
          style={{ borderRadius: 12, marginBottom: 16 }}
          message="Floor Springs are set to Request Quote only"
          description="Direct online checkout is disabled for Floor Springs pending owner route confirmation."
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <AdminSectionCard title="Product Image & Status">
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              {product.src ? (
                <Image
                  src={product.src}
                  alt={product.name}
                  style={{
                    maxHeight: 240,
                    objectFit: "contain",
                    borderRadius: 10,
                    background: "#F8FAFC",
                    padding: 8,
                  }}
                />
              ) : (
                <div
                  style={{
                    padding: "48px 16px",
                    background: "#F8FAFC",
                    borderRadius: 12,
                    color: "#94A3B8",
                  }}
                >
                  <PictureOutlined style={{ fontSize: 32, display: "block", marginBottom: 8 }} />
                  <Typography.Text type="secondary">No image attached</Typography.Text>
                </div>
              )}
            </div>
            <Space wrap style={{ width: "100%", justifyContent: "center" }}>
              <AdminStatusTag status={stage} />
              {isFloorSpring ? (
                <Tag color="orange" style={{ margin: 0, fontWeight: 600 }}>
                  Floor Spring — Quote Only
                </Tag>
              ) : (
                <AdminStatusTag status={isHouseOfAjantha ? "HOUSE_OF_AJANTHA" : "SAI_AJANTHA"} />
              )}
              <Tag color={product.stock_qty <= 10 ? "warning" : "success"}>
                Stock: {product.stock_qty} {product.billing_unit || "pcs"}
              </Tag>
            </Space>
          </AdminSectionCard>
        </Col>

        <Col xs={24} md={16}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <AdminSectionCard title="3-Tier Pricing (Staff View)">
              <Descriptions bordered column={{ xs: 1, sm: 3 }} size="small">
                <Descriptions.Item label="Buyer Price (MRP)">
                  <Typography.Text strong>
                    {product.customer_price_inr && product.customer_price_inr > 0
                      ? formatInr(product.customer_price_inr)
                      : "Request Quote"}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Dealer Price">
                  <Typography.Text strong>
                    {product.dealer_price_inr && product.dealer_price_inr > 0
                      ? formatInr(product.dealer_price_inr)
                      : "Request Quote"}
                  </Typography.Text>
                </Descriptions.Item>
                <Descriptions.Item label="Distributor Price">
                  <Typography.Text strong>
                    {product.distributor_price_inr && product.distributor_price_inr > 0
                      ? formatInr(product.distributor_price_inr)
                      : "Request Quote"}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </AdminSectionCard>

            <AdminSectionCard title="Product Specifications">
              <Descriptions bordered column={{ xs: 1, sm: 2 }} size="small">
                <Descriptions.Item label="SKU">{product.sku}</Descriptions.Item>
                <Descriptions.Item label="Category">{product.category}</Descriptions.Item>
                <Descriptions.Item label="Subcategory">{product.subcategory || "—"}</Descriptions.Item>
                <Descriptions.Item label="Brand">{product.brand || "—"}</Descriptions.Item>
                <Descriptions.Item label="Size">{product.size || "—"}</Descriptions.Item>
                <Descriptions.Item label="Material">{product.material || "—"}</Descriptions.Item>
                <Descriptions.Item label="Selling Unit">{product.billing_unit || "pcs"}</Descriptions.Item>
                <Descriptions.Item label="Manufactured">{product.is_manufactured ? "Yes (In-house)" : "Traded / Branded"}</Descriptions.Item>
              </Descriptions>
            </AdminSectionCard>

            <AdminSectionCard title="Customer Description (Block A)">
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {product.description || "No customer description added yet."}
              </Typography.Paragraph>
            </AdminSectionCard>
          </Space>
        </Col>
      </Row>
    </div>
  );
};

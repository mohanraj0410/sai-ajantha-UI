import React, { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Flex,
  Form,
  Input,
  InputNumber,
  Modal,
  Row,
  Select,
  Space,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import {
  DollarOutlined,
  EditOutlined,
  PlusOutlined,
  ShopOutlined,
  TagOutlined,
  TruckOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { useAuth } from "../auth/AuthContext";
import { useAdminMutations, usePortalData, usePromotionDrafts } from "../api/adminQueries";
import type { PortalProductRow, PromoDraftDto } from "../api/adminClient";
import { ELEVEN_CATEGORIES } from "./ProductsPage";
import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusTag,
  formatInr,
} from "../components/common/AdminPrimitives";
import { AdminBlockedApiBanner } from "../components/common/AdminStateView";
import { AdminTable } from "../components/common/AdminTable";
import { useAdminToast } from "../components/common/AdminToastProvider";
import { BRAND_TOKENS } from "../theme/antdTheme";
import { isFloorSpringProduct } from "../utils/catalogueClassification";
import {
  areFormValuesEqual,
  promoCodeRules,
  requiredTrimRule,
} from "../utils/formValidation";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";

export const PricingPromotionsPage: React.FC = () => {
  const { staff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useAdminToast();
  const isPromoPath = location.pathname.includes("promotions");

  const portal = usePortalData(staff?.email || "anon");
  const promoDrafts = usePromotionDrafts(staff?.email || "anon");
  const { createPromotionDraft } = useAdminMutations();

  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoForm] = Form.useForm();
  const PROMO_DEFAULTS = useMemo(
    () => ({
      code: "",
      title: "",
      target_tier: "DEALER",
      category_scope: "ALL",
      discount_pct: 5,
    }),
    []
  );
  const watchedPromo = Form.useWatch([], promoForm);
  const isPromoDirty = useMemo(
    () => promoOpen && !areFormValuesEqual(watchedPromo || {}, PROMO_DEFAULTS),
    [promoOpen, watchedPromo, PROMO_DEFAULTS]
  );

  const closePromoClean = useCallback(() => {
    setPromoOpen(false);
    promoForm.resetFields();
  }, [promoForm]);

  const { confirmLeave, allowNextNavigation } = useUnsavedChangesGuard({
    isDirty: isPromoDirty,
    onDiscard: closePromoClean,
    enabled: promoOpen,
  });

  const products = useMemo(() => portal.data?.products || [], [portal.data?.products]);

  const metrics = useMemo(() => {
    let buyerPriced = 0;
    let dealerPriced = 0;
    let distPriced = 0;
    for (const p of products) {
      if (p.customer_price_inr && p.customer_price_inr > 0) buyerPriced++;
      if (p.dealer_price_inr && p.dealer_price_inr > 0) dealerPriced++;
      if (p.distributor_price_inr && p.distributor_price_inr > 0) distPriced++;
    }
    return {
      total: products.length,
      buyerPriced,
      dealerPriced,
      distPriced,
      draftCount: promoDrafts.data?.promotions?.filter(p => p.status === "DRAFT").length ?? 0,
    };
  }, [products, promoDrafts.data]);

  const filteredProducts = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== "ALL" && p.category !== categoryFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, categoryFilter, searchText]);

  const handleCreatePromo = async (values: any) => {
    try {
      await createPromotionDraft.mutateAsync({
        code: String(values.code).trim().toUpperCase(),
        title: String(values.title).trim(),
        target_tier: values.target_tier,
        category_scope: values.category_scope,
        discount_percent: Number(values.discount_pct),
      });
      showToast("Promotion draft saved (checkout activation remains locked until approved).", "success");
      allowNextNavigation();
      closePromoClean();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not save promotion draft. Your entries are preserved.", "error");
    }
  };

  const priceColumns: TableProps<PortalProductRow>["columns"] = [
    {
      title: "SKU",
      dataIndex: "sku",
      key: "sku",
      width: 150,
      render: (v: string) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: "Product",
      dataIndex: "name",
      key: "name",
      width: 240,
      ellipsis: true,
    },
    {
      title: "Category",
      dataIndex: "category",
      key: "category",
      width: 165,
      render: (v: string) => <Tag style={{ margin: 0 }}>{v}</Tag>,
    },
    {
      title: "Buyer (MRP)",
      dataIndex: "customer_price_inr",
      key: "customer_price_inr",
      align: "right",
      width: 130,
      render: (v: number | null, row) => {
        if (isFloorSpringProduct(row)) {
          return (
            <Space direction="vertical" size={2} style={{ alignItems: "flex-end" }}>
              <Tag color="orange" style={{ margin: 0 }}>Quote Only (FS)</Tag>
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
          <Tag color="orange" style={{ margin: 0 }}>Request Quote</Tag>
        );
      },
    },
    {
      title: "Dealer Tier",
      dataIndex: "dealer_price_inr",
      key: "dealer_price_inr",
      align: "right",
      width: 125,
      render: (v: number | null) =>
        v && v > 0 ? formatInr(v) : <Typography.Text type="secondary">Request Quote</Typography.Text>,
    },
    {
      title: "Distributor",
      dataIndex: "distributor_price_inr",
      key: "distributor_price_inr",
      align: "right",
      width: 130,
      render: (v: number | null) =>
        v && v > 0 ? formatInr(v) : <Typography.Text type="secondary">Request Quote</Typography.Text>,
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
          icon={<EditOutlined />}
          onClick={() => navigate(`/products/${row.id}/edit`)}
        >
          Edit
        </Button>
      ),
    },
  ];

  const promoColumns: TableProps<PromoDraftDto>["columns"] = [
    { title: "Code", dataIndex: "code", key: "code", width: 140, render: (v: string) => <Tag color="geekblue">{v}</Tag> },
    { title: "Title", dataIndex: "title", key: "title", ellipsis: true },
    { title: "Target Tier", dataIndex: "target_tier", key: "target_tier", width: 140 },
    { title: "Category Scope", dataIndex: "category_scope", key: "category_scope", width: 170 },
    { title: "Discount", dataIndex: "discount_pct", key: "discount_pct", align: "right", width: 100, render: (v: number) => `${v}%` },
    { title: "Status", dataIndex: "status", key: "status", align: "center", width: 120, render: (v: string) => <AdminStatusTag status={v || "DRAFT"} /> },
  ];

  return (
    <div>
      <AdminPageHeader
        title="Pricing & Promotions"
        subtitle="Strict 3-tier pricing matrix (Buyer, Dealer, Distributor). Missing prices always show Request Quote."
        breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Pricing" }]}
        extra={
          isPromoPath && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                promoForm.resetFields();
                promoForm.setFieldsValue(PROMO_DEFAULTS);
                setPromoOpen(true);
              }}
            >
              New Promotion Draft
            </Button>
          )
        }
      />

      <Row gutter={[14, 14]} style={{ marginBottom: 14 }}>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Buyer MRP Priced" value={`${metrics.buyerPriced} / ${metrics.total}`} icon={<DollarOutlined />} accentColor={BRAND_TOKENS.navy} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Dealer Tier Priced" value={metrics.dealerPriced} icon={<ShopOutlined />} accentColor={BRAND_TOKENS.teal} highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={portal.isPending} unavailable={portal.isError} label="Distributor Priced" value={metrics.distPriced} icon={<TruckOutlined />} accentColor="#0891B2" highlightTop />
        </Col>
        <Col xs={12} sm={6}>
          <AdminStatCard loading={promoDrafts.isPending} unavailable={promoDrafts.isError} label="Promo Drafts" value={metrics.draftCount} icon={<TagOutlined />} accentColor="#D97706" highlightTop />
        </Col>
      </Row>

      <Tabs
        activeKey={isPromoPath ? "promotions" : "pricing"}
        onChange={(k) => navigate(k === "promotions" ? "/promotions" : "/pricing")}
        style={{ marginBottom: 10 }}
        items={[
          { key: "pricing", label: "3-Tier Pricing Matrix" },
          { key: "promotions", label: "Promotions (Drafts)" },
        ]}
      />

      {!isPromoPath ? (
        <>
          <Alert
            type="info"
            showIcon
            style={{ borderRadius: 12, marginBottom: 14 }}
            message="Trade Price Isolation Active"
            description="Dealer and Distributor rates are never returned to unauthenticated storefront visitors. Contractors share the single Dealer tier."
          />
          <AdminTable<PortalProductRow>
            title="SKU Pricing Matrix"
            dataSource={filteredProducts}
            columns={priceColumns}
            rowKey={(r) => r.id || r.sku}
            loading={portal.isLoading}
            error={portal.isError ? "Failed to load pricing matrix." : null}
            onRetry={() => void portal.refetch()}
            searchValue={searchText}
            onSearchChange={setSearchText}
            searchPlaceholder="Search SKU or product..."
            hasActiveFilters={categoryFilter !== "ALL" || Boolean(searchText)}
            onClearFilters={() => {
              setSearchText("");
              setCategoryFilter("ALL");
            }}
            filterControls={
              <Select
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 210 }}
                options={[
                  { label: "All 11 Categories", value: "ALL" },
                  ...ELEVEN_CATEGORIES.map((c) => ({ label: c, value: c })),
                ]}
              />
            }
            renderMobileItem={(row) => (
              <Card size="small" bordered style={{ borderRadius: 12 }}>
                <Typography.Text strong style={{ display: "block" }}>{row.name}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 8 }}>
                  {row.sku} • {row.category}
                </Typography.Text>
                <Flex justify="space-between" wrap="wrap" gap={6}>
                  <Tag style={{ margin: 0 }}>Buyer: {row.customer_price_inr ? formatInr(row.customer_price_inr) : "Quote"}</Tag>
                  <Tag color="cyan" style={{ margin: 0 }}>Dealer: {row.dealer_price_inr ? formatInr(row.dealer_price_inr) : "—"}</Tag>
                  <Tag color="geekblue" style={{ margin: 0 }}>Dist: {row.distributor_price_inr ? formatInr(row.distributor_price_inr) : "—"}</Tag>
                </Flex>
              </Card>
            )}
          />
        </>
      ) : (
        <>
          <AdminBlockedApiBanner
            title="Live Checkout Coupon Redemption Pending Approval"
            description="You can prepare promotion drafts below for review, while live storefront coupon checkout remains locked until management approves campaign rules."
          />
          <AdminTable<PromoDraftDto>
            title="Promotion Drafts"
            dataSource={promoDrafts.data?.promotions || []}
            columns={promoColumns}
            rowKey="id"
            loading={promoDrafts.isLoading}
            error={promoDrafts.isError ? "Failed to load promotion drafts." : null}
            onRetry={() => void promoDrafts.refetch()}
            scrollX={760}
            emptyTitle="No promotion drafts"
            emptyDescription="Create a draft promotion for internal review."
          />
        </>
      )}

      <Modal
        open={promoOpen}
        destroyOnClose
        title="Create Promotion Draft"
        onCancel={() => confirmLeave(closePromoClean)}
        footer={[
          <Button
            key="reset"
            icon={<UndoOutlined />}
            disabled={!isPromoDirty || createPromotionDraft.isPending}
            onClick={() => {
              promoForm.resetFields();
              promoForm.setFieldsValue(PROMO_DEFAULTS);
            }}
          >
            Reset
          </Button>,
          <Button key="cancel" onClick={() => confirmLeave(closePromoClean)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={createPromotionDraft.isPending}
            disabled={createPromotionDraft.isPending}
            onClick={() => promoForm.submit()}
          >
            Save Draft
          </Button>,
        ]}
      >
        <Form
          form={promoForm}
          layout="vertical"
          initialValues={PROMO_DEFAULTS}
          onFinish={(v) => void handleCreatePromo(v)}
        >
          <Form.Item label="Promo Code" name="code" rules={promoCodeRules()}>
            <Input placeholder="e.g. TRICHY5" maxLength={24} style={{ textTransform: "uppercase" }} />
          </Form.Item>
          <Form.Item
            label="Campaign Title"
            name="title"
            rules={[requiredTrimRule("Enter a short campaign title.")]}
          >
            <Input placeholder="e.g. Festive Dealer Discount" maxLength={120} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Target Tier"
                name="target_tier"
                rules={[{ required: true, message: "Select a target tier." }]}
              >
                <Select
                  options={[
                    { label: "Buyer", value: "CUSTOMER" },
                    { label: "Dealer", value: "DEALER" },
                    { label: "Distributor", value: "DISTRIBUTOR" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                label="Discount (%)"
                name="discount_pct"
                rules={[
                  { required: true, message: "Enter a discount between 1% and 50%." },
                  { type: "number", min: 1, max: 50, message: "Discount must be between 1% and 50%." },
                ]}
              >
                <InputNumber min={1} max={50} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Category Scope"
            name="category_scope"
            rules={[{ required: true, message: "Select a category scope." }]}
          >
            <Select
              options={[
                { label: "All Categories", value: "ALL" },
                ...ELEVEN_CATEGORIES.map((c) => ({ label: c, value: c })),
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

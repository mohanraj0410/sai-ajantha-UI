import { queryGraphAll } from "../../../../../lib/admin-query-all";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils";
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows";
import { recordDurableAuditEvent } from "../../../../../lib/audit-logger";
import { applyCatalogStockChanges } from "../../../../../lib/inventory";
import { checkStaffPermission } from "../../../../../lib/permissions";
import { verifyOwnerApproval } from "../../../../../lib/owner-approval";

interface GraphEditableProduct {
  id: string;
  title: string;
  handle: string;
  status: string;
  thumbnail: string | null;
  categories?: { name: string }[] | null;
  metadata?: Record<string, unknown> | null;
  variants?: {
    id: string;
    sku?: string | null;
    prices?: { id?: string; amount: number; currency_code: string }[] | null;
  }[] | null;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }
  const idOrLegacy = req.params.id;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: products } = (await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "description",
      "thumbnail",
      "status",
      "metadata",
      "categories.id",
      "categories.name",
      "variants.id",
      "variants.sku",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
    pagination: { take: 2000, skip: 0 },
  })) as { data: any[] };

  const p = products.find((prod) => {
    const meta = prod.metadata || {};
    return (
      prod.id === idOrLegacy ||
      prod.handle === idOrLegacy ||
      meta.legacy_id === idOrLegacy ||
      meta.legacy_product_id === idOrLegacy ||
      prod.variants?.some((v: any) => v.sku === idOrLegacy)
    );
  });

  if (!p) {
    return res.status(404).json({ message: "Product not found." });
  }

  const meta = p.metadata || {};
  const primaryVariant = p.variants?.[0];
  const inrPrice = primaryVariant?.prices?.find(
    (pr: any) => pr.currency_code?.toLowerCase() === "inr"
  )?.amount;
  const levels =
    primaryVariant?.inventory_items?.[0]?.inventory?.location_levels || [];
  const totalAvailable = levels.reduce(
    (sum: number, lvl: any) =>
      sum + Math.max(0, (lvl.stocked_quantity || 0) - (lvl.reserved_quantity || 0)),
    0
  );

  const product = {
    id: typeof meta.legacy_id === "string" ? meta.legacy_id : p.handle || p.id,
    medusa_id: p.id,
    sku: (typeof meta.sku === "string" ? meta.sku : null) || primaryVariant?.sku || p.handle,
    name: p.title,
    category: (typeof meta.category_name === "string" ? meta.category_name : null) || p.categories?.[0]?.name || "Aluminium",
    subcategory: typeof meta.subcategory === "string" ? meta.subcategory : (typeof meta.source_sheet === "string" ? meta.source_sheet : null),
    brand: typeof meta.brand === "string" ? meta.brand : "Sai Ajantha",
    model: typeof meta.model === "string" ? meta.model : "",
    product_number: typeof meta.product_number === "string" ? meta.product_number : "",
    size: typeof meta.size === "string" ? meta.size : "",
    measurements_and_units: typeof meta.measurements_and_units === "string" ? meta.measurements_and_units : "",
    material: typeof meta.material === "string" ? meta.material : "",
    description: p.description || (typeof meta.description === "string" ? meta.description : ""),
    src: p.thumbnail || (typeof meta.src === "string" ? meta.src : "/placeholder.png"),
    customer_price_inr: typeof meta.customer_price_inr === "number" ? meta.customer_price_inr : inrPrice ? inrPrice / 100 : null,
    contractor_price_inr: typeof meta.contractor_price_inr === "number" ? meta.contractor_price_inr : null,
    dealer_price_inr: typeof meta.dealer_price_inr === "number" ? meta.dealer_price_inr : null,
    distributor_price_inr: typeof meta.distributor_price_inr === "number" ? meta.distributor_price_inr : null,
    billing_unit: typeof meta.billing_unit === "string" ? meta.billing_unit : "PIECE",
    stock_qty: typeof meta.stock_qty === "number" ? meta.stock_qty : totalAvailable,
    gst_rate: typeof meta.gst_rate === "number" ? meta.gst_rate : 18,
    cms_status: typeof meta.cms_status === "string" ? meta.cms_status : "APPROVED",
    headline_need: typeof meta.headline_need === "string" ? meta.headline_need : undefined,
    highlights: Array.isArray(meta.highlights) ? meta.highlights : (Array.isArray(meta.features) ? meta.features : []),
    features: Array.isArray(meta.features) ? meta.features : (Array.isArray(meta.highlights) ? meta.highlights : []),
    benefits: Array.isArray(meta.benefits) ? meta.benefits : (Array.isArray(meta.customer_benefits) ? meta.customer_benefits : []),
    customer_benefits: Array.isArray(meta.customer_benefits) ? meta.customer_benefits : (Array.isArray(meta.benefits) ? meta.benefits : []),
    variants: Array.isArray(meta.variants) ? meta.variants : [],
    delivery_info: typeof meta.delivery_info === "string" ? meta.delivery_info : "",
    images: Array.isArray(meta.images) ? meta.images : (p.thumbnail ? [p.thumbnail] : []),
    other_document_links: Array.isArray(meta.other_document_links) ? meta.other_document_links : [],
    warranty_info: typeof meta.warranty_info === "string" ? meta.warranty_info : "",
    reference_selling_price_inr: typeof meta.reference_selling_price_inr === "number" ? meta.reference_selling_price_inr : null,
    faq: Array.isArray(meta.faq) ? meta.faq : [],
    product_specification:
      meta.product_specification && typeof meta.product_specification === "object"
        ? meta.product_specification
        : meta.spec_fields && typeof meta.spec_fields === "object"
        ? meta.spec_fields
        : {},
    sale_route: typeof meta.sale_route === "string" ? meta.sale_route : "DIRECT_SAI_AJANTHA",
    is_quote_only: typeof meta.is_quote_only === "boolean" ? meta.is_quote_only : false,
    min_order_qty: meta.min_order_qty !== undefined ? meta.min_order_qty : null,
    max_order_qty: typeof meta.max_order_qty === "number" ? meta.max_order_qty : null,
    installation_eligible: typeof meta.installation_eligible === "boolean" ? meta.installation_eligible : false,
    hsn_code: typeof meta.hsn_code === "string" ? meta.hsn_code : "",
    delivery_price_inr: typeof meta.delivery_price_inr === "number" ? meta.delivery_price_inr : null,
    technical_verification_status: typeof meta.technical_verification_status === "string" ? meta.technical_verification_status : "VERIFIED",
    content_verification_status: typeof meta.content_verification_status === "string" ? meta.content_verification_status : "VERIFIED",
    internal_notes: typeof meta.internal_notes === "string" ? meta.internal_notes : undefined,
    spec_fields: meta.spec_fields && typeof meta.spec_fields === "object" ? meta.spec_fields : undefined,
    is_manufactured: typeof meta.is_manufactured === "boolean" ? meta.is_manufactured : false,
    approved: p.status === ProductStatus.PUBLISHED ? 1 : 0,
    active: p.status === ProductStatus.PUBLISHED ? 1 : 0,
  };

  return res.json({ product });
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  const idOrLegacy = req.params.id;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { data: products } = (await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "status",
      "thumbnail",
      "categories.name",
      "metadata",
      "variants.id",
      "variants.sku",
      "variants.prices.id",
      "variants.prices.amount",
      "variants.prices.currency_code",
    ],
    pagination: { take: 2000, skip: 0 },
  })) as { data: GraphEditableProduct[] };

  const existing = products.find((p) => {
    const meta = p.metadata || {};
    return (
      p.id === idOrLegacy ||
      p.handle === idOrLegacy ||
      meta.legacy_id === idOrLegacy ||
      meta.legacy_product_id === idOrLegacy ||
      p.variants?.some((v) => v.sku === idOrLegacy)
    );
  });

  if (!existing) {
    return res.status(404).json({ message: "Product not found." });
  }

  const body = (req.body || {}) as {
    name?: string;
    description?: string;
    brand?: string;
    model?: string;
    productNumber?: string;
    size?: string;
    measurementsAndUnits?: string;
    material?: string;
    src?: string;
    customerPriceInr?: number | null;
    contractorPriceInr?: number | null;
    dealerPriceInr?: number | null;
    distributorPriceInr?: number | null;
    billingUnit?: string;
    gstRate?: number;
    stockQty?: number;
    approved?: boolean;
    active?: boolean;
    cmsStatus?: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
    headlineNeed?: string | null;
    highlights?: string[];
    benefits?: string[];
    features?: string[];
    customerBenefits?: string[];
    variants?: string[];
    deliveryInfo?: string;
    images?: string[];
    otherDocumentLinks?: string[];
    warrantyInfo?: string;
    referenceSellingPriceInr?: number | null;
    faq?: string[] | { question: string; answer?: string }[];
    productSpecification?: Record<string, unknown>;
    saleRoute?: string;
    isQuoteOnly?: boolean;
    minOrderQty?: string | number | null;
    maxOrderQty?: number | null;
    installationEligible?: boolean;
    hsnCode?: string | null;
    deliveryPriceInr?: number | null;
    technicalVerificationStatus?: string;
    contentVerificationStatus?: string;
    internalNotes?: string | null;
    specFields?: Record<string, string>;
  };

  // B5 Truth Gate: Server-side Owner Approval Hard Stop Gate
  // Prohibits direct mutation of the 281 protected genuine catalogue SKUs without verified owner approval.
  const metaSku = typeof existing.metadata?.sku === "string" ? existing.metadata.sku : "";
  const variantSku = existing.variants?.[0]?.sku || "";
  const targetSku = (metaSku || variantSku || existing.handle || "").toUpperCase();
  const isTestFixture = targetSku.startsWith("SA-TEST-") || targetSku.startsWith("TEST-") || targetSku.startsWith("DEMO-");

  if (!isTestFixture) {
    const mutationFields = Object.keys(body || {}).filter(
      (k) => (body as any)[k] !== undefined
    );
    const approvalCheck = await verifyOwnerApproval(req, targetSku, mutationFields);
    if (!approvalCheck.authorized) {
      return res.status(approvalCheck.statusCode || 403).json({
        code: approvalCheck.code || "PROTECTED_CATALOGUE_SKU_MERGE_STOP",
        message:
          approvalCheck.message ||
          `Direct mutation of protected catalogue SKU '${targetSku}' is forbidden without verified owner authorization.`,
        reason: approvalCheck.reason,
      });
    }
  }

  const existingMeta = { ...(existing.metadata || {}) };
  const nextTitle =
    body.name !== undefined ? body.name.trim() || existing.title : existing.title;

  const nextCustomerPrice =
    body.customerPriceInr !== undefined
      ? body.customerPriceInr === null
        ? null
        : Math.max(0, Number(body.customerPriceInr))
      : typeof existingMeta.customer_price_inr === "number"
        ? existingMeta.customer_price_inr
        : null;

  const nextDealerPrice =
    body.dealerPriceInr !== undefined
      ? body.dealerPriceInr === null
        ? null
        : Math.max(0, Number(body.dealerPriceInr))
      : typeof existingMeta.dealer_price_inr === "number"
        ? existingMeta.dealer_price_inr
        : null;

  const nextDistributorPrice =
    body.distributorPriceInr !== undefined
      ? body.distributorPriceInr === null
        ? null
        : Math.max(0, Number(body.distributorPriceInr))
      : typeof existingMeta.distributor_price_inr === "number"
        ? existingMeta.distributor_price_inr
        : null;

  const currentCmsStatus =
    typeof existingMeta.cms_status === "string" &&
    ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED"].includes(existingMeta.cms_status)
      ? existingMeta.cms_status
      : existing.status === ProductStatus.PUBLISHED && Boolean(existingMeta.approved)
        ? "PUBLISHED"
        : Boolean(existingMeta.approved)
          ? "APPROVED"
          : "DRAFT";

  const resolvedCmsStatus =
    body.cmsStatus && ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED"].includes(body.cmsStatus)
      ? body.cmsStatus
      : body.approved !== undefined || body.active !== undefined
        ? (body.active ?? existing.status === ProductStatus.PUBLISHED) &&
          (body.approved ?? Boolean(existingMeta.approved))
          ? "PUBLISHED"
          : (body.approved ?? Boolean(existingMeta.approved))
            ? "APPROVED"
            : "DRAFT"
        : currentCmsStatus;

  const ALLOWED_CMS_TRANSITIONS: Record<string, Set<string>> = {
    DRAFT: new Set(["DRAFT", "REVIEW"]),
    REVIEW: new Set(["DRAFT", "REVIEW", "APPROVED"]),
    APPROVED: new Set(["DRAFT", "APPROVED", "PUBLISHED"]),
    PUBLISHED: new Set(["DRAFT", "PUBLISHED"]),
  };

  if (
    resolvedCmsStatus !== currentCmsStatus &&
    !ALLOWED_CMS_TRANSITIONS[currentCmsStatus]?.has(resolvedCmsStatus)
  ) {
    return res.status(400).json({
      code: "INVALID_STAGE_TRANSITION",
      message: `Invalid CMS lifecycle jump from ${currentCmsStatus} to ${resolvedCmsStatus}. Required sequence: DRAFT -> REVIEW -> APPROVED -> PUBLISHED.`,
    });
  }

  const callerRole =
    typeof req.staff_user?.metadata?.role === "string" ? req.staff_user.metadata.role : "admin";
  const isFullAdmin = callerRole === "admin" || callerRole === "super_admin";
  if (
    !isFullAdmin &&
    (resolvedCmsStatus === "APPROVED" || resolvedCmsStatus === "PUBLISHED") &&
    existingMeta.created_by_id &&
    existingMeta.created_by_id === req.staff_user?.id &&
    currentCmsStatus !== resolvedCmsStatus
  ) {
    return res.status(403).json({
      code: "SELF_APPROVAL_FORBIDDEN",
      message: "Non-admin staff cannot self-approve or publish SKUs they authored.",
    });
  }

  const nextApproved = resolvedCmsStatus === "APPROVED" || resolvedCmsStatus === "PUBLISHED";
  const nextStatus =
    resolvedCmsStatus === "PUBLISHED" ? ProductStatus.PUBLISHED : ProductStatus.DRAFT;

  const nextContractorPrice =
    body.contractorPriceInr !== undefined
      ? body.contractorPriceInr === null
        ? null
        : Math.max(0, Number(body.contractorPriceInr))
      : typeof existingMeta.contractor_price_inr === "number"
      ? existingMeta.contractor_price_inr
      : null;

  const nextMeta: Record<string, unknown> = {
    ...existingMeta,
    customer_price_inr: nextCustomerPrice,
    contractor_price_inr: nextContractorPrice,
    dealer_price_inr: nextDealerPrice,
    distributor_price_inr: nextDistributorPrice,
    approved: nextApproved,
    cms_status: resolvedCmsStatus,
    ...(resolvedCmsStatus === "APPROVED" && currentCmsStatus !== "APPROVED"
      ? { approved_by_id: req.staff_user?.id || "admin", approved_at: new Date().toISOString() }
      : {}),
    ...(resolvedCmsStatus === "PUBLISHED" && currentCmsStatus !== "PUBLISHED"
      ? { published_by_id: req.staff_user?.id || "admin", published_at: new Date().toISOString() }
      : {}),
    ...(body.brand !== undefined ? { brand: body.brand.trim() } : {}),
    ...(body.model !== undefined ? { model: body.model.trim() } : {}),
    ...(body.productNumber !== undefined ? { product_number: body.productNumber.trim() } : {}),
    ...(body.size !== undefined ? { size: body.size.trim() } : {}),
    ...(body.measurementsAndUnits !== undefined ? { measurements_and_units: body.measurementsAndUnits.trim() } : {}),
    ...(body.material !== undefined ? { material: body.material.trim() } : {}),
    ...(body.billingUnit !== undefined ? { billing_unit: body.billingUnit.trim() } : {}),
    ...(body.gstRate !== undefined ? { gst_rate: Number(body.gstRate) } : {}),
    ...(body.headlineNeed !== undefined ? { headline_need: body.headlineNeed || "" } : {}),
    ...(body.highlights !== undefined ? { highlights: body.highlights } : {}),
    ...(body.features !== undefined ? { features: body.features } : {}),
    ...(body.benefits !== undefined ? { benefits: body.benefits } : {}),
    ...(body.customerBenefits !== undefined ? { customer_benefits: body.customerBenefits } : {}),
    ...(body.variants !== undefined ? { variants: body.variants } : {}),
    ...(body.deliveryInfo !== undefined ? { delivery_info: body.deliveryInfo } : {}),
    ...(body.images !== undefined ? { images: body.images } : {}),
    ...(body.otherDocumentLinks !== undefined ? { other_document_links: body.otherDocumentLinks } : {}),
    ...(body.warrantyInfo !== undefined ? { warranty_info: body.warrantyInfo } : {}),
    ...(body.referenceSellingPriceInr !== undefined ? { reference_selling_price_inr: body.referenceSellingPriceInr } : {}),
    ...(body.faq !== undefined ? { faq: body.faq } : {}),
    ...(body.productSpecification !== undefined ? { product_specification: body.productSpecification } : {}),
    ...(body.saleRoute !== undefined ? { sale_route: body.saleRoute } : {}),
    ...(body.isQuoteOnly !== undefined ? { is_quote_only: body.isQuoteOnly } : {}),
    ...(body.minOrderQty !== undefined ? { min_order_qty: body.minOrderQty } : {}),
    ...(body.maxOrderQty !== undefined ? { max_order_qty: body.maxOrderQty } : {}),
    ...(body.installationEligible !== undefined ? { installation_eligible: body.installationEligible } : {}),
    ...(body.hsnCode !== undefined ? { hsn_code: body.hsnCode } : {}),
    ...(body.deliveryPriceInr !== undefined ? { delivery_price_inr: body.deliveryPriceInr } : {}),
    ...(body.technicalVerificationStatus !== undefined ? { technical_verification_status: body.technicalVerificationStatus } : {}),
    ...(body.contentVerificationStatus !== undefined ? { content_verification_status: body.contentVerificationStatus } : {}),
    ...(body.internalNotes !== undefined ? { internal_notes: body.internalNotes || "" } : {}),
    ...(body.specFields !== undefined ? { spec_fields: body.specFields } : {}),
  };

  if (body.stockQty !== undefined) {
    nextMeta.stock_qty = Math.max(0, Math.floor(Number(body.stockQty)));
  }

  const primaryVariant = existing.variants?.[0];

  await updateProductsWorkflow(req.scope).run({
    input: {
      products: [
        {
          id: existing.id,
          title: nextTitle,
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.src !== undefined && body.src ? { thumbnail: body.src } : {}),
          status: nextStatus,
          metadata: nextMeta,
          ...(primaryVariant && nextCustomerPrice !== null
            ? {
                variants: [
                  {
                    id: primaryVariant.id,
                    prices: [
                      {
                        amount: nextCustomerPrice,
                        currency_code: "inr",
                      },
                    ],
                  },
                ],
              }
            : {}),
        },
      ],
    },
  });

  if (body.stockQty !== undefined) {
    await applyCatalogStockChanges(
      req.scope,
      [
        {
          productId: existing.id,
          name: nextTitle,
          units: Math.max(0, Math.floor(Number(body.stockQty))),
        },
      ],
      { mode: "set" }
    );
  }

  await recordDurableAuditEvent(req, "PRODUCT_UPDATE", `product:${existing.id}`, {
    id: existing.id,
    handle: existing.handle,
    status: nextStatus,
    cmsStatus: resolvedCmsStatus,
    title: nextTitle,
    stockQty: body.stockQty,
  });

  return res.json({
    product: {
      id:
        typeof nextMeta.legacy_id === "string"
          ? nextMeta.legacy_id
          : existing.handle || existing.id,
      medusa_id: existing.id,
      sku:
        (typeof nextMeta.sku === "string" ? nextMeta.sku : null) ||
        primaryVariant?.sku ||
        existing.handle,
      name: nextTitle,
      category:
        (typeof nextMeta.category_name === "string"
          ? nextMeta.category_name
          : null) ||
        existing.categories?.[0]?.name ||
        "Hardware",
      customer_price_inr: nextCustomerPrice,
      dealer_price_inr: nextDealerPrice,
      distributor_price_inr: nextDistributorPrice,
      stock_qty:
        body.stockQty !== undefined
          ? Math.max(0, Math.floor(Number(body.stockQty)))
          : typeof nextMeta.stock_qty === "number"
            ? nextMeta.stock_qty
            : 0,
      cms_status: resolvedCmsStatus,
      approved: nextApproved ? 1 : 0,
      active: nextStatus === ProductStatus.PUBLISHED ? 1 : 0,
    },
  });
}

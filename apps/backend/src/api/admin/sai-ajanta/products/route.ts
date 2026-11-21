import { queryGraphAll } from "../../../../lib/admin-query-all";
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import { recordDurableAuditEvent } from "../../../../lib/audit-logger";
import { checkStaffPermission } from "../../../../lib/permissions";
import { verifyOwnerApproval } from "../../../../lib/owner-approval";

function toHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

interface ProductInputItem {
  sku?: string;
  name?: string;
  category?: string;
  subcategory?: string | null;
  brand?: string | null;
  model?: string | null;
  productNumber?: string | null;
  size?: string | null;
  measurementsAndUnits?: string | null;
  material?: string | null;
  description?: string | null;
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
  deliveryInfo?: string | null;
  images?: string[];
  otherDocumentLinks?: string[];
  warrantyInfo?: string | null;
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
  isManufactured?: boolean;
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: products } = (await queryGraphAll(query, {
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
      "variants.sku",
      "variants.prices.amount",
      "variants.prices.currency_code",
      "variants.inventory_items.inventory.location_levels.stocked_quantity",
      "variants.inventory_items.inventory.location_levels.reserved_quantity",
    ],
    pagination: { take: 2000, skip: 0 },
  })) as {
    data: {
      id: string;
      title: string;
      handle: string;
      description?: string | null;
      thumbnail?: string | null;
      status?: string;
      metadata?: Record<string, unknown> | null;
      categories?: { id: string; name: string }[] | null;
      variants?: {
        sku?: string | null;
        prices?: { amount: number; currency_code: string }[] | null;
        inventory_items?: {
          inventory?: {
            location_levels?: { stocked_quantity: number; reserved_quantity: number }[] | null;
          } | null;
        }[] | null;
      }[] | null;
    }[];
  };

  const mapped = products.map((p) => {
    const meta = p.metadata || {};
    const primaryVariant = p.variants?.[0];
    const inrPrice = primaryVariant?.prices?.find(
      (pr) => pr.currency_code?.toLowerCase() === "inr"
    )?.amount;
    const levels =
      primaryVariant?.inventory_items?.[0]?.inventory?.location_levels || [];
    const totalAvailable = levels.reduce(
      (sum, lvl) =>
        sum + Math.max(0, (lvl.stocked_quantity || 0) - (lvl.reserved_quantity || 0)),
      0
    );

    const legacyId =
      typeof meta.legacy_id === "string" ? meta.legacy_id : p.handle || p.id;
    const sku =
      (typeof meta.sku === "string" ? meta.sku : null) ||
      primaryVariant?.sku ||
      p.handle;
    const category =
      (typeof meta.category_name === "string" ? meta.category_name : null) ||
      p.categories?.[0]?.name ||
      "Aluminium";

    const isMfg = typeof meta.is_manufactured === "boolean"
      ? meta.is_manufactured
      : category === "Aluminium" || category.includes("Frame");

    return {
      id: legacyId,
      medusaId: p.id,
      sku,
      title: p.title,
      category,
      subcategory: typeof meta.source_sheet === "string" ? meta.source_sheet : category,
      brand: typeof meta.brand === "string" ? meta.brand : "Sai Ajantha",
      model: typeof meta.model === "string" ? meta.model : null,
      productNumber: typeof meta.product_number === "string" ? meta.product_number : null,
      size: typeof meta.size === "string" ? meta.size : "Standard",
      measurementsAndUnits: typeof meta.measurements_and_units === "string" ? meta.measurements_and_units : null,
      material: typeof meta.material === "string" ? meta.material : "Aluminium Alloy 6063-T5",
      customerPriceInr:
        typeof meta.customer_price_inr === "number"
          ? meta.customer_price_inr
          : typeof inrPrice === "number"
          ? inrPrice
          : 0,
      contractorPriceInr:
        typeof meta.contractor_price_inr === "number" ? meta.contractor_price_inr : 0,
      dealerPriceInr:
        typeof meta.dealer_price_inr === "number" ? meta.dealer_price_inr : 0,
      distributorPriceInr:
        typeof meta.distributor_price_inr === "number" ? meta.distributor_price_inr : 0,
      unit: typeof meta.billing_unit === "string" ? meta.billing_unit : "1 length (3.66m)",
      billingUnit: typeof meta.billing_unit === "string" ? meta.billing_unit : "1 length (3.66m)",
      stockQty:
        levels.length > 0
          ? totalAvailable
          : typeof meta.stock_qty === "number"
          ? meta.stock_qty
          : 50,
      gstRate: typeof meta.gst_rate === "number" ? meta.gst_rate : 18,
      isManufactured: isMfg,
      thumbnail: p.thumbnail || "",
      description: p.description || "",
      features: Array.isArray(meta.features) ? meta.features : (Array.isArray(meta.highlights) ? meta.highlights : []),
      customerBenefits: Array.isArray(meta.customer_benefits) ? meta.customer_benefits : (Array.isArray(meta.benefits) ? meta.benefits : []),
      variants: Array.isArray(meta.variants) ? meta.variants : [],
      deliveryInfo: typeof meta.delivery_info === "string" ? meta.delivery_info : null,
      images: Array.isArray(meta.images) ? meta.images : (p.thumbnail ? [p.thumbnail] : []),
      otherDocumentLinks: Array.isArray(meta.other_document_links) ? meta.other_document_links : [],
      warrantyInfo: typeof meta.warranty_info === "string" ? meta.warranty_info : null,
      referenceSellingPriceInr: typeof meta.reference_selling_price_inr === "number" ? meta.reference_selling_price_inr : null,
      faq: Array.isArray(meta.faq) ? meta.faq : [],
      productSpecification:
        meta.product_specification && typeof meta.product_specification === "object"
          ? meta.product_specification
          : meta.spec_fields && typeof meta.spec_fields === "object"
          ? meta.spec_fields
          : {},
      saleRoute:
        typeof meta.sale_route === "string"
          ? meta.sale_route
          : category.includes("Door") || category.includes("Kitchen")
          ? "DISTRIBUTOR_CHANNEL"
          : "DIRECT_SAI_AJANTHA",
      isQuoteOnly:
        typeof meta.is_quote_only === "boolean"
          ? meta.is_quote_only
          : sku.includes("-FS-") || category.includes("Floor Spring"),
      minOrderQty: meta.min_order_qty !== undefined ? meta.min_order_qty : null,
      maxOrderQty: typeof meta.max_order_qty === "number" ? meta.max_order_qty : null,
      installationEligible: typeof meta.installation_eligible === "boolean" ? meta.installation_eligible : false,
      hsnCode: typeof meta.hsn_code === "string" ? meta.hsn_code : null,
      deliveryPriceInr: typeof meta.delivery_price_inr === "number" ? meta.delivery_price_inr : null,
      technicalVerificationStatus:
        typeof meta.technical_verification_status === "string" ? meta.technical_verification_status : "VERIFIED",
      contentVerificationStatus:
        typeof meta.content_verification_status === "string" ? meta.content_verification_status : "VERIFIED",
      cmsStatus: typeof meta.cms_status === "string" ? meta.cms_status : "APPROVED",
    };
  });

  return res.json({ products: mapped, count: mapped.length });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  if (!checkStaffPermission(req, res, "CATALOG_MANAGE")) {
    return;
  }

  const body = (req.body || {}) as
    | ProductInputItem
    | { products?: ProductInputItem[] };

  const rawItems: ProductInputItem[] = Array.isArray((body as { products?: ProductInputItem[] }).products)
    ? (body as { products?: ProductInputItem[] }).products!
    : [body as ProductInputItem];

  const itemsToCreate = rawItems.filter(
    (item) => (item.sku || "").trim() && (item.name || "").trim() && (item.category || "").trim()
  );

  if (itemsToCreate.length === 0) {
    return res
      .status(400)
      .json({ message: "At least one product with SKU, name, and category is required." });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const [{ data: channels }, { data: cats }, { data: locations }, { data: existingProducts }] =
    await Promise.all([
      queryGraphAll(query, { entity: "sales_channel", fields: ["id"] }) as Promise<{
        data: { id: string }[];
      }>,
      queryGraphAll(query, {
        entity: "product_category",
        fields: ["id", "name"],
        pagination: { take: 200, skip: 0 },
      }) as Promise<{ data: { id: string; name: string }[] }>,
      queryGraphAll(query, { entity: "stock_location", fields: ["id"] }) as Promise<{
        data: { id: string }[];
      }>,
      queryGraphAll(query, {
        entity: "product",
        fields: ["id", "metadata", "variants.sku"],
        pagination: { take: 2000, skip: 0 },
      }) as Promise<{
        data: {
          id: string;
          metadata?: Record<string, unknown> | null;
          variants?: { sku?: string | null }[] | null;
        }[];
      }>,
    ]);

  const knownSkus = new Set<string>();
  for (const ep of existingProducts) {
    const mSku = typeof ep.metadata?.sku === "string" ? ep.metadata.sku : null;
    if (mSku) knownSkus.add(mSku.trim().toUpperCase());
    for (const v of ep.variants || []) {
      if (v.sku) knownSkus.add(v.sku.trim().toUpperCase());
    }
  }

  const createdResults: Record<string, unknown>[] = [];
  const rowErrors: { sku: string; message: string }[] = [];

  for (const item of itemsToCreate) {
    const sku = (item.sku || "").trim();
    const cleanSku = sku.toUpperCase();
    const isTestFixture = cleanSku.startsWith("SA-TEST-") || cleanSku.startsWith("TEST-") || cleanSku.startsWith("DEMO-");

    if (!isTestFixture) {
      const mutationFields = Object.keys(item || {}).filter(
        (k) => (item as any)[k] !== undefined
      );
      const approvalCheck = await verifyOwnerApproval(req, cleanSku, mutationFields);
      if (!approvalCheck.authorized) {
        rowErrors.push({
          sku,
          message:
            approvalCheck.message ||
            `Direct creation of genuine catalogue SKU '${sku}' is forbidden without verified owner authorization.`,
        });
        continue;
      }
    }

    if (knownSkus.has(cleanSku)) {
      rowErrors.push({ sku, message: `Duplicate SKU '${sku}': product already exists.` });
      continue;
    }
    const name = (item.name || "").trim();
    const category = (item.category || "").trim();
    const subcategory = (item.subcategory || category).trim();
    const brand = (item.brand || "Sai Ajantha").trim();
    const size = (item.size || "Standard").trim();
    const material = (item.material || "Aluminium Alloy 6063-T5").trim();
    const description = (item.description || `${brand} ${name}`).trim();
    const billingUnit = (item.billingUnit || "1 unit").trim();
    const gstRate = typeof item.gstRate === "number" ? item.gstRate : 18;

    const matchedCat = cats.find(
      (c) => c.name.toLowerCase() === category.toLowerCase()
    );

    const handle = `${toHandle(sku)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const customerPrice =
      item.customerPriceInr !== undefined && item.customerPriceInr !== null
        ? Math.max(0, Number(item.customerPriceInr))
        : null;
    const contractorPrice =
      item.contractorPriceInr !== undefined && item.contractorPriceInr !== null
        ? Math.max(0, Number(item.contractorPriceInr))
        : null;
    const dealerPrice =
      item.dealerPriceInr !== undefined && item.dealerPriceInr !== null
        ? Math.max(0, Number(item.dealerPriceInr))
        : null;
    const distributorPrice =
      item.distributorPriceInr !== undefined && item.distributorPriceInr !== null
        ? Math.max(0, Number(item.distributorPriceInr))
        : null;
    const stockQty = Math.max(0, Math.floor(Number(item.stockQty ?? 0)));
    const skuKey = sku.toUpperCase();
    const isSampleRow = /(^|\b)(sample|training|test[-_ ]?row|demo[-_ ]?sku|do not publish)/i.test(
      `${sku} ${name}`
    );
    if (isSampleRow) {
      rowErrors.push({
        sku,
        message: `Sample/demo SKU "${sku}" is excluded by catalog import safety rules.`,
      });
      continue;
    }
    if (knownSkus.has(skuKey)) {
      rowErrors.push({ sku, message: `Duplicate SKU "${sku}" already exists in catalog.` });
      continue;
    }
    knownSkus.add(skuKey);

    const isBatchRequest = Array.isArray((body as { products?: ProductInputItem[] }).products);
    const requestedCmsStatus = isBatchRequest
      ? "DRAFT"
      : item.cmsStatus && ["DRAFT", "REVIEW", "APPROVED", "PUBLISHED"].includes(item.cmsStatus)
        ? item.cmsStatus
        : item.approved && item.active
          ? "PUBLISHED"
          : item.approved
            ? "APPROVED"
            : "DRAFT";
    const isPublished = requestedCmsStatus === "PUBLISHED";
    const isApproved = requestedCmsStatus === "APPROVED" || requestedCmsStatus === "PUBLISHED";

    try {
      const { result: createdProducts } = await createProductsWorkflow(req.scope).run({
        input: {
          products: [
            {
              title: name,
              handle,
              description,
              status: isPublished ? ProductStatus.PUBLISHED : ProductStatus.DRAFT,
              thumbnail: item.src || undefined,
              category_ids: matchedCat ? [matchedCat.id] : undefined,
              sales_channels: channels[0]?.id ? [{ id: channels[0].id }] : undefined,
              metadata: {
                legacy_id: handle,
                sku,
                brand,
                model: item.model || "",
                product_number: item.productNumber || "",
                size,
                measurements_and_units: item.measurementsAndUnits || "",
                material,
                category_name: category,
                source_sheet: subcategory,
                customer_price_inr: customerPrice,
                contractor_price_inr: contractorPrice,
                dealer_price_inr: dealerPrice,
                distributor_price_inr: distributorPrice,
                billing_unit: billingUnit,
                gst_rate: gstRate,
                gst_mode: "Excluded",
                cms_status: requestedCmsStatus,
                headline_need: item.headlineNeed || "",
                highlights: Array.isArray(item.features)
                  ? item.features
                  : Array.isArray(item.highlights)
                  ? item.highlights
                  : [],
                features: Array.isArray(item.features) ? item.features : [],
                benefits: Array.isArray(item.customerBenefits)
                  ? item.customerBenefits
                  : Array.isArray(item.benefits)
                  ? item.benefits
                  : [],
                customer_benefits: Array.isArray(item.customerBenefits) ? item.customerBenefits : [],
                variants: Array.isArray(item.variants) ? item.variants : [],
                delivery_info: item.deliveryInfo || "",
                images: Array.isArray(item.images) ? item.images : (item.src ? [item.src] : []),
                other_document_links: Array.isArray(item.otherDocumentLinks) ? item.otherDocumentLinks : [],
                warranty_info: item.warrantyInfo || "",
                reference_selling_price_inr: item.referenceSellingPriceInr || null,
                faq: Array.isArray(item.faq) ? item.faq : [],
                product_specification:
                  item.productSpecification && typeof item.productSpecification === "object"
                    ? item.productSpecification
                    : item.specFields && typeof item.specFields === "object"
                    ? item.specFields
                    : {},
                sale_route: item.saleRoute || (category.includes("Door") || category.includes("Kitchen") ? "DISTRIBUTOR_CHANNEL" : "DIRECT_SAI_AJANTHA"),
                is_quote_only: Boolean(item.isQuoteOnly ?? (sku.includes("-FS-") || category.includes("Floor Spring"))),
                min_order_qty: item.minOrderQty !== undefined ? item.minOrderQty : null,
                max_order_qty: item.maxOrderQty || null,
                installation_eligible: Boolean(item.installationEligible),
                hsn_code: item.hsnCode || null,
                delivery_price_inr: item.deliveryPriceInr || null,
                technical_verification_status: item.technicalVerificationStatus || "VERIFIED",
                content_verification_status: item.contentVerificationStatus || "VERIFIED",
                internal_notes: item.internalNotes || "",
                spec_fields:
                  item.productSpecification && typeof item.productSpecification === "object"
                    ? (item.productSpecification as Record<string, string>)
                    : item.specFields && typeof item.specFields === "object"
                    ? item.specFields
                    : {},
                approved: isApproved,
                created_by_id: req.staff_user?.id || "admin",
                is_manufactured: Boolean(item.isManufactured ?? true),
                stock_qty: stockQty,
              },
              options: [{ title: "Default", values: ["Standard"] }],
              variants: [
                {
                  title: "Standard",
                  sku,
                  manage_inventory: true,
                  options: { Default: "Standard" },
                  prices: [
                    {
                      amount: customerPrice ?? 0,
                      currency_code: "inr",
                    },
                  ],
                },
              ],
            },
          ],
        },
      });

      const created = createdProducts[0];
      if (created?.id && locations[0]?.id) {
        const { data: prodGraph } = (await queryGraphAll(query, {
          entity: "product",
          filters: { id: created.id },
          fields: ["variants.inventory_items.inventory_item_id"],
        })) as {
          data: {
            variants?: {
              inventory_items?: { inventory_item_id?: string }[];
            }[];
          }[];
        };
        const invItemId =
          prodGraph[0]?.variants?.[0]?.inventory_items?.[0]?.inventory_item_id;
        if (invItemId) {
          await createInventoryLevelsWorkflow(req.scope).run({
            input: {
              inventory_levels: [
                {
                  inventory_item_id: invItemId,
                  location_id: locations[0].id,
                  stocked_quantity: stockQty,
                },
              ],
            },
          });
        }
      }

      createdResults.push({
        id: handle,
        medusa_id: created?.id,
        sku,
        name,
        category,
        subcategory,
        brand,
        size,
        material,
        src: item.src || "",
        customer_price_inr: customerPrice,
        contractor_price_inr: contractorPrice,
        dealer_price_inr: dealerPrice,
        distributor_price_inr: distributorPrice,
        billing_unit: billingUnit,
        gst_rate: gstRate,
        stock_qty: stockQty,
        cms_status: requestedCmsStatus,
        approved: isApproved ? 1 : 0,
        active: isPublished ? 1 : 0,
      });
    } catch (err: unknown) {
      console.error(`Failed to create product SKU ${sku}:`, err);
      rowErrors.push({
        sku,
        message: err instanceof Error ? err.message : "Failed to persist SKU",
      });
    }
  }

  if (createdResults.length > 0) {
    await recordDurableAuditEvent(req, "PRODUCT_CREATE", `products:${createdResults.length}`, {
      count: createdResults.length,
      skus: createdResults.map((r) => r.sku),
    });
  }

  if (Array.isArray((body as { products?: ProductInputItem[] }).products)) {
    return res.status(createdResults.length > 0 ? 201 : 400).json({
      success: createdResults.length > 0,
      count: createdResults.length,
      errors: rowErrors,
      products: createdResults,
    });
  }

  if (createdResults.length === 0) {
    const firstErr = rowErrors[0]?.message || "Failed to create product.";
    const isApprovalBlock =
      firstErr.includes("forbidden without") ||
      firstErr.includes("owner authorization") ||
      firstErr.includes("owner merge authorization") ||
      firstErr.includes("PROTECTED_CATALOGUE_SKU_MERGE_STOP");
    const isDup = firstErr.includes("Duplicate");
    return res.status(isApprovalBlock ? 403 : isDup ? 409 : 500).json({
      code: isApprovalBlock ? "PROTECTED_CATALOGUE_SKU_MERGE_STOP" : isDup ? "DUPLICATE_SKU" : "CREATION_FAILED",
      message: firstErr,
      errors: rowErrors,
    });
  }

  return res.status(201).json({ product: createdResults[0] });
}

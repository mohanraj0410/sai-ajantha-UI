/**
 * SAI AJANTHA — RUNTIME-VALIDATED SHARED CONTRACTS (P4.2 / ADM-11 / ADM-17 / ARCH-01)
 * Authoritative shared DTO definitions, discriminated unions, and runtime validators
 * consumed across backend, admin, and storefront workspaces.
 */

// ============================================================================
// 1. Core Primitives & Validation Result Types
// ============================================================================

export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

export type ValidationResult<T> =
  | { success: true; data: T; errors?: never }
  | { success: false; data?: never; errors: ValidationErrorDetail[] };

export function successResult<T>(data: T): ValidationResult<T> {
  return { success: true, data };
}

export function failureResult<T>(errors: ValidationErrorDetail[]): ValidationResult<T> {
  return { success: false, errors };
}

// ============================================================================
// 2. Domain 1: Actor, Session & RBAC Permissions
// ============================================================================

export type CanonicalUserRole = "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "STAFF";
export type CanonicalApprovalStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "SUSPENDED";
export type CanonicalPriceTier = "CUSTOMER" | "DEALER" | "DISTRIBUTOR";

export interface ActorSessionDto {
  id: string;
  email: string;
  name: string;
  phone: string;
  organization: string;
  gstin: string | null;
  businessCity: string | null;
  role: CanonicalUserRole;
  approvalStatus: CanonicalApprovalStatus;
  isApprovedTradeAccount: boolean;
  effectivePriceTier: CanonicalPriceTier;
  createdAt: string;
}

export function validateActorSessionDto(input: unknown): ValidationResult<ActorSessionDto> {
  const errors: ValidationErrorDetail[] = [];
  if (!input || typeof input !== "object") {
    return failureResult([{ field: "root", message: "Input must be an object" }]);
  }

  const o = input as Record<string, unknown>;

  if (typeof o.id !== "string" || !o.id.trim()) {
    errors.push({ field: "id", message: "Actor ID must be a non-empty string" });
  }
  if (typeof o.email !== "string" || !o.email.includes("@")) {
    errors.push({ field: "email", message: "A valid email is required" });
  }
  if (typeof o.name !== "string" || !o.name.trim()) {
    errors.push({ field: "name", message: "Actor name is required" });
  }

  const roleStr = String(o.role || "").toUpperCase();
  const validRoles: CanonicalUserRole[] = ["CUSTOMER", "DEALER", "DISTRIBUTOR", "STAFF"];
  if (!validRoles.includes(roleStr as CanonicalUserRole)) {
    errors.push({ field: "role", message: `Invalid role: ${roleStr}` });
  }

  const statusStr = String(o.approvalStatus || "PENDING_APPROVAL").toUpperCase();
  const validStatuses: CanonicalApprovalStatus[] = [
    "APPROVED",
    "PENDING_APPROVAL",
    "REJECTED",
    "SUSPENDED",
  ];
  if (!validStatuses.includes(statusStr as CanonicalApprovalStatus)) {
    errors.push({ field: "approvalStatus", message: `Invalid approvalStatus: ${statusStr}` });
  }

  if (errors.length > 0) {
    return failureResult(errors);
  }

  const canonicalRole = roleStr as CanonicalUserRole;
  const canonicalStatus = statusStr as CanonicalApprovalStatus;

  // Derive trade privileges server-side: only APPROVED dealers/distributors receive trade tiers
  const isApprovedTrade =
    (canonicalRole === "DEALER" || canonicalRole === "DISTRIBUTOR") &&
    canonicalStatus === "APPROVED";

  let effectiveTier: CanonicalPriceTier = "CUSTOMER";
  if (isApprovedTrade) {
    effectiveTier = canonicalRole === "DISTRIBUTOR" ? "DISTRIBUTOR" : "DEALER";
  }

  return successResult({
    id: String(o.id).trim(),
    email: String(o.email).trim().toLowerCase(),
    name: String(o.name).trim(),
    phone: String(o.phone || "").trim(),
    organization: String(o.organization || "").trim(),
    gstin: o.gstin ? String(o.gstin).trim() : null,
    businessCity: o.businessCity ? String(o.businessCity).trim() : null,
    role: canonicalRole,
    approvalStatus: canonicalStatus,
    isApprovedTradeAccount: isApprovedTrade,
    effectivePriceTier: effectiveTier,
    createdAt: typeof o.createdAt === "string" ? o.createdAt : new Date().toISOString(),
  });
}

// ============================================================================
// 3. Domain 2: Catalogue & Allowlisted B2C vs Internal Trade DTOs
// ============================================================================

export type CanonicalSellerRoute = "SAI_AJANTHA_DIRECT" | "DISTRIBUTOR_RESALE" | "ENQUIRY_ONLY";

/**
 * Public Allowlisted B2C DTO.
 * CRITICAL (ADM-17 / SF-04): Strictly prohibits wholesale, dealer, or distributor prices.
 */
export interface PublicCatalogItemDto {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string | null;
  src: string;
  route: CanonicalSellerRoute;
  isQuoteOnly: boolean;
  publicPriceInr: number | null;
  publicPricePaise: number | null;
  isManufactured: boolean;
  inStock: boolean;
  specifications: Record<string, string>;
}

export function validatePublicCatalogItemDto(input: unknown): ValidationResult<PublicCatalogItemDto> {
  const errors: ValidationErrorDetail[] = [];
  if (!input || typeof input !== "object") {
    return failureResult([{ field: "root", message: "Catalog item must be an object" }]);
  }

  const o = input as Record<string, unknown>;

  // Check for confidential field leakage
  const forbiddenConfidentialFields = [
    "dealerPriceInr",
    "dealerPricePaise",
    "distributorPriceInr",
    "distributorPricePaise",
    "baseLandingCost",
    "landingCostPaise",
    "tradeDiscountPercent",
    "dealer_price",
    "distributor_price",
  ];

  for (const field of forbiddenConfidentialFields) {
    if (field in o && o[field] !== undefined && o[field] !== null) {
      errors.push({
        field,
        message: `Security violation: Confidential trade field '${field}' must not be present in public catalog DTO`,
      });
    }
  }

  if (typeof o.id !== "string" || !o.id.trim()) {
    errors.push({ field: "id", message: "Product ID is required" });
  }
  if (typeof o.name !== "string" || !o.name.trim()) {
    errors.push({ field: "name", message: "Product name is required" });
  }
  if (typeof o.category !== "string" || !o.category.trim()) {
    errors.push({ field: "category", message: "Product category is required" });
  }

  const routeStr = String(o.route || "ENQUIRY_ONLY");
  const validRoutes: CanonicalSellerRoute[] = [
    "SAI_AJANTHA_DIRECT",
    "DISTRIBUTOR_RESALE",
    "ENQUIRY_ONLY",
  ];
  if (!validRoutes.includes(routeStr as CanonicalSellerRoute)) {
    errors.push({ field: "route", message: `Invalid seller route: ${routeStr}` });
  }

  const isQuoteOnly = Boolean(o.isQuoteOnly);
  let priceInr: number | null = null;
  let pricePaise: number | null = null;

  if (isQuoteOnly) {
    priceInr = null;
    pricePaise = null;
  } else if (o.publicPriceInr !== null && o.publicPriceInr !== undefined) {
    const num = Number(o.publicPriceInr);
    if (isNaN(num) || num < 0) {
      errors.push({ field: "publicPriceInr", message: "publicPriceInr must be non-negative" });
    } else {
      priceInr = Math.round(num * 100) / 100;
      pricePaise = Math.round(priceInr * 100);
    }
  }

  if (errors.length > 0) {
    return failureResult(errors);
  }

  return successResult({
    id: String(o.id).trim(),
    sku: String(o.sku || o.code || "").trim(),
    name: String(o.name).trim(),
    category: String(o.category).trim(),
    subcategory: o.subcategory ? String(o.subcategory).trim() : null,
    src: String(o.src || "").trim(),
    route: routeStr as CanonicalSellerRoute,
    isQuoteOnly,
    publicPriceInr: priceInr,
    publicPricePaise: pricePaise,
    isManufactured: Boolean(o.isManufactured),
    inStock: o.inStock !== undefined ? Boolean(o.inStock) : true,
    specifications:
      typeof o.specifications === "object" && o.specifications !== null
        ? (o.specifications as Record<string, string>)
        : {},
  });
}

/**
 * Internal Staff/Trade DTO — Strictly for authenticated staff or verified trade sessions.
 */
export interface TradeCatalogItemDto extends PublicCatalogItemDto {
  dealerPricePaise: number | null;
  distributorPricePaise: number | null;
  baseLandingCostPaise: number | null;
  tradeDiscountPercent: number | null;
  minimumOrderQuantity: number;
}

// ============================================================================
// 4. Domain 3: Orders, Quotes & Line Items
// ============================================================================

export type CanonicalOrderType =
  | "DIRECT_SALE"
  | "DISTRIBUTOR_QUOTE"
  | "BOQ_ENQUIRY"
  | "VERIFIED_TRADE_PO";

export type CanonicalOrderStatus =
  | "PENDING_PAYMENT"
  | "BOQ_QUOTE_REQUESTED"
  | "CONFIRMED_TRADE_PO"
  | "CONFIRMED"
  | "PROCESSING"
  | "DISPATCHED"
  | "DELIVERED"
  | "CANCELLED"
  | "PAYMENT_FAILED";

export type CanonicalPaymentStatus =
  | "PENDING"
  | "PAID"
  | "REFUNDED"
  | "PAYMENT_RECEIVED_AFTER_EXPIRY"
  | "PENDING_OFFLINE_SETTLEMENT"
  | "FAILED";

export interface OrderLineItemDto {
  productId: string;
  sku: string;
  name: string;
  category: string;
  sellerId: string;
  locationId: string;
  inventoryItemId: string;
  quantity: number;
  unitPricePaise: number | null;
  lineTotalPaise: number | null;
  isQuoteItem: boolean;
}

export interface CanonicalOrderDto {
  id: string;
  orderNumber: string;
  orderType: CanonicalOrderType;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organization?: string;
  gstin?: string | null;
  shippingAddress: string;
  status: CanonicalOrderStatus;
  paymentStatus: CanonicalPaymentStatus;
  subtotalPaise: number;
  gstAmountPaise: number;
  totalPaise: number;
  hasQuoteItems: boolean;
  checkoutIntentId: string;
  createdAt: string;
  items: OrderLineItemDto[];
}

export function validateOrderLineItemDto(input: unknown): ValidationResult<OrderLineItemDto> {
  const errors: ValidationErrorDetail[] = [];
  if (!input || typeof input !== "object") {
    return failureResult([{ field: "root", message: "Line item must be an object" }]);
  }

  const o = input as Record<string, unknown>;

  if (typeof o.productId !== "string" || !o.productId.trim()) {
    errors.push({ field: "productId", message: "productId is required" });
  }
  if (typeof o.name !== "string" || !o.name.trim()) {
    errors.push({ field: "name", message: "item name is required" });
  }

  const qty = Number(o.quantity);
  if (isNaN(qty) || !Number.isInteger(qty) || qty <= 0) {
    errors.push({ field: "quantity", message: "quantity must be a positive integer >= 1" });
  }

  const isQuoteItem = Boolean(o.isQuoteItem || o.is_quote_item);
  let unitPricePaise: number | null = null;
  let lineTotalPaise: number | null = null;

  if (!isQuoteItem && o.unitPricePaise !== undefined && o.unitPricePaise !== null) {
    const p = Number(o.unitPricePaise);
    if (isNaN(p) || !Number.isInteger(p) || p < 0) {
      errors.push({ field: "unitPricePaise", message: "unitPricePaise must be a non-negative integer" });
    } else {
      unitPricePaise = p;
      lineTotalPaise = p * qty;
    }
  }

  if (errors.length > 0) {
    return failureResult(errors);
  }

  return successResult({
    productId: String(o.productId).trim(),
    sku: String(o.sku || "").trim(),
    name: String(o.name).trim(),
    category: String(o.category || "").trim(),
    sellerId: String(o.sellerId || o.seller_id || "sel_central_warehouse").trim(),
    locationId: String(o.locationId || o.location_id || "sloc_01M7HKTTVP6J72Y042MEEFPT6Z").trim(),
    inventoryItemId: String(o.inventoryItemId || o.inventory_item_id || o.productId).trim(),
    quantity: qty,
    unitPricePaise,
    lineTotalPaise,
    isQuoteItem,
  });
}

// ============================================================================
// 5. Domain 4: Payment Verification & Reservations
// ============================================================================

export interface PaymentVerificationResultDto {
  orderId: string;
  provider: "razorpay" | "offline_po";
  providerPaymentId: string | null;
  providerOrderId: string | null;
  amountPaise: number;
  currency: "INR";
  verified: boolean;
  status: "PAID" | "PAYMENT_RECEIVED_AFTER_EXPIRY" | "FAILED";
  signatureMatch: boolean;
}

export type ReservationLifecycleState = "RESERVED" | "CONFIRMED" | "RELEASED" | "EXPIRED";

export interface StockReservationDto {
  id: string;
  orderId: string;
  inventoryItemId: string;
  locationId: string;
  sellerId: string;
  sku: string;
  quantity: number;
  status: ReservationLifecycleState;
  expiresAt: string;
  confirmedAt?: string | null;
  releasedAt?: string | null;
  expiredAt?: string | null;
}

// ============================================================================
// 6. Domain 5: Standard API Error Envelope (BE-16 / SF-10 / SF-11)
// ============================================================================

export type StandardErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "STOCK_UNAVAILABLE"
  | "IDEMPOTENCY_CONFLICT"
  | "COMMERCIAL_FLOW_DISABLED"
  | "PAYMENT_VERIFICATION_FAILED"
  | "INTERNAL_SERVER_ERROR";

export interface StandardErrorEnvelopeDto {
  code: StandardErrorCode;
  message: string;
  httpStatus: number;
  correlationId: string;
  details?: Record<string, unknown> | null;
}

export function createStandardErrorEnvelope(
  code: StandardErrorCode,
  message: string,
  httpStatus: number,
  correlationId?: string,
  details?: Record<string, unknown> | null
): StandardErrorEnvelopeDto {
  // CRITICAL: Strip out any sensitive stack traces, connection strings, or private paths
  const sanitizedDetails = details ? { ...details } : null;
  if (sanitizedDetails) {
    delete (sanitizedDetails as Record<string, unknown>).stack;
    delete (sanitizedDetails as Record<string, unknown>).password;
    delete (sanitizedDetails as Record<string, unknown>).secret;
    delete (sanitizedDetails as Record<string, unknown>).database_url;
  }

  return {
    code,
    message,
    httpStatus,
    correlationId: correlationId || `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    details: sanitizedDetails,
  };
}

// ============================================================================
// 7. Domain 6: Product CMS, 11 Categories & Staged Import Lifecycle (Phase 06)
// ============================================================================

export type CanonicalProductLifecycleStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED"
  | "ARCHIVED";

export type Canonical11Category =
  | "Door Closer & Floor Spring"
  | "Kitchen Basket"
  | "Finished Insect Screens"
  | "Aluminium"
  | "Hardware"
  | "Ladders"
  | "Rubber and PVC"
  | "Clips"
  | "FGM Fittings channels"
  | "Frames and Channels"
  | "Mesh";

export interface CategoryRoutePolicy {
  category: Canonical11Category;
  slug: string;
  defaultRoute: CanonicalSellerRoute;
  defaultSellerId: string;
  isDistributorRoute: boolean;
  requiresQuoteOnlyByDefault: boolean;
}

export const CATEGORY_ROUTE_POLICIES: Record<Canonical11Category, CategoryRoutePolicy> = {
  "Door Closer & Floor Spring": {
    category: "Door Closer & Floor Spring",
    slug: "door-closer-and-floor-spring",
    defaultRoute: "DISTRIBUTOR_RESALE",
    defaultSellerId: "sel_distributor_pending",
    isDistributorRoute: true,
    requiresQuoteOnlyByDefault: false,
  },
  "Kitchen Basket": {
    category: "Kitchen Basket",
    slug: "kitchen-basket",
    defaultRoute: "DISTRIBUTOR_RESALE",
    defaultSellerId: "sel_distributor_pending",
    isDistributorRoute: true,
    requiresQuoteOnlyByDefault: false,
  },
  "Finished Insect Screens": {
    category: "Finished Insect Screens",
    slug: "insect-screens",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  Aluminium: {
    category: "Aluminium",
    slug: "aluminium",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  Hardware: {
    category: "Hardware",
    slug: "hardware",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  Ladders: {
    category: "Ladders",
    slug: "ladder",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  "Rubber and PVC": {
    category: "Rubber and PVC",
    slug: "rubber-pvc",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  Clips: {
    category: "Clips",
    slug: "clip",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  "FGM Fittings channels": {
    category: "FGM Fittings channels",
    slug: "fgm-fittings",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  "Frames and Channels": {
    category: "Frames and Channels",
    slug: "frames-channels",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
  Mesh: {
    category: "Mesh",
    slug: "mesh",
    defaultRoute: "SAI_AJANTHA_DIRECT",
    defaultSellerId: "sel_central_warehouse",
    isDistributorRoute: false,
    requiresQuoteOnlyByDefault: false,
  },
};

/**
 * Resolves authoritative seller route and quote-only state per DEC-002 policy.
 * Floor spring items are strictly enquiry-only blocked while floorSpringsRouteConfirmed=false.
 */
export function resolveProductSellerRoute(
  categoryName: string,
  sku?: string,
  productTitle?: string
): { route: CanonicalSellerRoute; isQuoteOnly: boolean; reason: string } {
  const normCat = (categoryName || "").trim();
  const normSku = (sku || "").toUpperCase().trim();
  const normTitle = (productTitle || "").toLowerCase().trim();

  const isFloorSpring =
    normSku.includes("-FS-") ||
    normSku.includes("FLOOR") ||
    normTitle.includes("floor spring");

  if (isFloorSpring) {
    return {
      route: "ENQUIRY_ONLY",
      isQuoteOnly: true,
      reason: "FLOOR_SPRINGS_ENQUIRY_ONLY_BLOCKED",
    };
  }

  // Check normalized category matches
  for (const policy of Object.values(CATEGORY_ROUTE_POLICIES)) {
    if (
      policy.category.toLowerCase() === normCat.toLowerCase() ||
      policy.slug.toLowerCase() === normCat.toLowerCase() ||
      (normCat.toLowerCase().includes("door closer") && policy.category === "Door Closer & Floor Spring") ||
      (normCat.toLowerCase().includes("kitchen") && policy.category === "Kitchen Basket") ||
      (normCat.toLowerCase().includes("insect") && policy.category === "Finished Insect Screens") ||
      (normCat.toLowerCase().includes("rubber") && policy.category === "Rubber and PVC") ||
      (normCat.toLowerCase().includes("clip") && policy.category === "Clips") ||
      (normCat.toLowerCase().includes("fgm") && policy.category === "FGM Fittings channels") ||
      (normCat.toLowerCase().includes("frame") && policy.category === "Frames and Channels") ||
      (normCat.toLowerCase().includes("ladder") && policy.category === "Ladders") ||
      (normCat.toLowerCase().includes("aluminium") && policy.category === "Aluminium") ||
      (normCat.toLowerCase().includes("hardware") && policy.category === "Hardware") ||
      (normCat.toLowerCase().includes("mesh") && policy.category === "Mesh")
    ) {
      return {
        route: policy.defaultRoute,
        isQuoteOnly: policy.requiresQuoteOnlyByDefault,
        reason: "CATEGORY_POLICY_MATCH",
      };
    }
  }

  return {
    route: "ENQUIRY_ONLY",
    isQuoteOnly: true,
    reason: "ROUTE_REVIEW_REQUIRED_FALLBACK",
  };
}

export type CanonicalImportJobStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "STAGED"
  | "REVIEW_REQUIRED"
  | "APPROVED_FOR_IMPORT"
  | "COMMITTING"
  | "COMPLETED"
  | "PARTIAL_FAILED"
  | "FAILED";

export type ImportRowSeverity =
  | "STAGED"
  | "VALID"
  | "WARNING"
  | "BLOCKED"
  | "DUPLICATE"
  | "EXCLUDED_SAMPLE";

// ============================================================================
// 7.1 Authoritative 34-Column Excel/CSV Field Definitions
// ============================================================================

export const EXCEL_34_COLUMNS = [
  "Product number",
  "Product name",
  "Brand",
  "Model",
  "Product code or SKU",
  "Category",
  "Description",
  "Features",
  "Customer benefits",
  "Size",
  "Measurements and units",
  "Material",
  "Variants",
  "Distributor price",
  "Dealer price",
  "Contractor price",
  "Customer price",
  "billing unit",
  "GST rate",
  "Quantity",
  "Delivery Info",
  "Images",
  "Other document links",
  "Warranty Info",
  "Reference selling price",
  "FAQ",
  "Product Specification",
  "sale_route",
  "isQuoteOnly",
  "min_order_qty",
  "max_order_qty",
  "installation_eligible",
  "hsn_code",
  "delivery_price",
] as const;

export type Excel34ColumnHeader = (typeof EXCEL_34_COLUMNS)[number];

export type FieldVerificationStatus =
  | "VERIFIED"
  | "PENDING_TECHNICAL_VERIFICATION"
  | "PENDING_CONTENT_VERIFICATION"
  | "UNVERIFIED";

export interface ScreenOrderItemAreaInput {
  widthInches: number;
  heightInches: number;
  quantity: number;
}

export function calculateScreenItemAreaSqFt(
  widthInches: number,
  heightInches: number,
  quantity: number
): number {
  if (widthInches <= 0 || heightInches <= 0 || quantity <= 0) return 0;
  const areaSqFt = (widthInches * heightInches) / 144;
  return Math.round(areaSqFt * quantity * 100) / 100;
}

export function validateCombinedScreenMoq(
  items: ScreenOrderItemAreaInput[]
): {
  isValid: boolean;
  totalAreaSqFt: number;
  requiredAreaSqFt: number;
  shortfallSqFt: number;
} {
  const totalAreaSqFt = items.reduce(
    (sum, item) =>
      sum + calculateScreenItemAreaSqFt(item.widthInches, item.heightInches, item.quantity),
    0
  );
  const roundedTotal = Math.round(totalAreaSqFt * 100) / 100;
  const requiredAreaSqFt = 50.0;
  const isValid = roundedTotal >= requiredAreaSqFt;
  const shortfallSqFt = isValid ? 0 : Math.round((requiredAreaSqFt - roundedTotal) * 100) / 100;
  return { isValid, totalAreaSqFt: roundedTotal, requiredAreaSqFt, shortfallSqFt };
}

export function generateExact34ColumnTemplateCsv(): string {
  const headers = EXCEL_34_COLUMNS.join(",");
  const sampleRow = [
    "SA-EX-001",
    "\"Aluminium Section Profile 6063-T5\"",
    "\"Sai Ajantha\"",
    "\"6063-T5\"",
    "SA-ALM-6063-001",
    "\"Aluminium Sections\"",
    "\"Standard commercial aluminium extrusion profile\"",
    "\"High structural strength; Architectural 6063-T5 alloy\"",
    "\"Corrosion resistance; Easy installation\"",
    "\"50mm x 25mm x 1.5mm\"",
    "\"1 length (3.66m)\"",
    "\"Aluminium Alloy 6063-T5\"",
    "\"Mill Silver; Champagne; Black\"",
    "980",
    "1150",
    "1300",
    "1450",
    "\"1 length\"",
    "18",
    "500",
    "\"Dispatched from Trichy Central Warehouse within 24-48 hours\"",
    "\"/products/sample.jpg\"",
    "\"\"",
    "\"1 Year standard manufacturer warranty\"",
    "1450",
    "\"\"",
    "\"{\\\"alloy\\\":\\\"6063-T5\\\",\\\"temper\\\":\\\"T5\\\"}\"",
    "\"SAI_AJANTHA_DIRECT\"",
    "false",
    "1",
    "500",
    "true",
    "\"7604.21.00\"",
    "0",
  ].join(",");
  return `${headers}\n${sampleRow}\n`;
}

export interface StagedImportRowDto {
  id: string;
  jobId: string;
  sourceRowNumber: number;
  sku: string;
  name: string;
  category: string;
  subcategory: string | null;
  brand: string;
  size: string | null;
  material: string | null;
  billingUnit: string;
  customerPriceInr: number | null;
  dealerPriceInr: number | null;
  distributorPriceInr: number | null;
  contractorPriceInr?: number | null;
  gstRate: number | null;
  stockQty: number | null;
  taxStatus?: "VERIFIED" | "UNVERIFIED";
  stockStatus?: "VERIFIED" | "UNVERIFIED";
  reviewStatus?: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  isManufactured: boolean;
  src: string | null;
  description: string;
  isSampleRow: boolean;
  severity: ImportRowSeverity;
  route: CanonicalSellerRoute;
  isQuoteOnly: boolean;
  errors: string[];
  warnings: string[];

  // Extended 34-column fields
  productNumber?: string | null;
  model?: string | null;
  features?: string[];
  customerBenefits?: string[];
  measurementsAndUnits?: string | null;
  variants?: string[];
  deliveryInfo?: string | null;
  images?: string[];
  otherDocumentLinks?: string[];
  warrantyInfo?: string | null;
  referenceSellingPriceInr?: number | null;
  faq?: string[] | { question: string; answer?: string }[];
  productSpecification?: Record<string, unknown>;
  saleRoute?: "DIRECT_SAI_AJANTHA" | "DISTRIBUTOR_CHANNEL" | string;
  minOrderQty?: string | number | null;
  maxOrderQty?: number | null;
  installationEligible?: boolean;
  hsnCode?: string | null;
  deliveryPriceInr?: number | null;
  technicalVerificationStatus?: FieldVerificationStatus;
  contentVerificationStatus?: FieldVerificationStatus;
  proposedAction?: "KEEP_OLD" | "PROPOSE_UPDATE" | "BLOCKED_NEEDS_REVIEW" | "UNCHANGED_NOOP";
}

export interface ProductImportJobDto {
  id: string;
  intentId: string;
  fileName: string;
  fileHash: string;
  status: CanonicalImportJobStatus;
  totalRows: number;
  candidateRows: number;
  excludedSamples: number;
  invalidRows: number;
  stagedRows: number;
  publishedRows: number;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
  errorMessage?: string | null;
}

// ============================================================================
// 8. Domain 7: Distributor Lifecycle, Coverage, Inventory & PO Management
// ============================================================================

export type CanonicalDistributorCoverageStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface DistributorCoverageDto {
  id: string;
  distributorId: string;
  distributorName?: string;
  postalCode: string; // 6-digit PIN string
  categoryName: string;
  categorySlug: string;
  canonicalRoute: CanonicalSellerRoute;
  status: CanonicalDistributorCoverageStatus;
  assignedBy: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AssignCoverageInput {
  distributorId: string;
  postalCode: string;
  categorySlug: string;
  notes?: string;
}

export function validateAssignCoverageInput(input: unknown): ValidationResult<AssignCoverageInput> {
  const errors: ValidationErrorDetail[] = [];
  if (!input || typeof input !== "object") {
    return failureResult([{ field: "root", message: "Input must be an object" }]);
  }
  const o = input as Record<string, unknown>;
  if (typeof o.distributorId !== "string" || !o.distributorId.trim()) {
    errors.push({ field: "distributorId", message: "distributorId is required" });
  }
  if (typeof o.postalCode !== "string" || !/^\d{6}$/.test(o.postalCode.trim())) {
    errors.push({ field: "postalCode", message: "postalCode must be a 6-digit numeric string" });
  }
  if (typeof o.categorySlug !== "string" || !o.categorySlug.trim()) {
    errors.push({ field: "categorySlug", message: "categorySlug is required" });
  }

  // Only Door Closers and Kitchen Baskets are authorized for distributor resale
  const normSlug = String(o.categorySlug || "").toLowerCase();
  const isAllowedCategory =
    normSlug.includes("door-closer") ||
    normSlug.includes("kitchen-basket") ||
    normSlug === "door-closer-floor-spring";

  if (!isAllowedCategory) {
    errors.push({
      field: "categorySlug",
      message: `Category '${o.categorySlug}' is not authorized for distributor resale. Only Door Closers and Kitchen Baskets are authorized.`,
    });
  }

  if (errors.length > 0) return failureResult(errors);
  return successResult({
    distributorId: String(o.distributorId).trim(),
    postalCode: String(o.postalCode).trim(),
    categorySlug: normSlug,
    notes: o.notes ? String(o.notes) : undefined,
  });
}

export type CanonicalDistributorPoStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "AWAITING_FINANCE_APPROVAL"
  | "APPROVED"
  | "ALLOCATED"
  | "DISPATCHED"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "RECONCILIATION_REQUIRED"
  | "CANCELLED";

export type CanonicalDistributorPoPaymentStatus =
  | "PAYMENT_PENDING_VERIFICATION"
  | "PAYMENT_VERIFIED"
  | "PAYMENT_FAILED"
  | "REFUNDED";

export interface DistributorPoItemDto {
  sku: string;
  title: string;
  variantId?: string;
  qty: number;
  unitPricePaise: number;
  gstRate: number | null;
  isQuoteOnly: boolean;
  lineTotalPaise: number;
}

export interface DistributorPoDto {
  id: string;
  poNumber: string;
  distributorId: string;
  distributorName?: string;
  status: CanonicalDistributorPoStatus;
  paymentStatus: CanonicalDistributorPoPaymentStatus;
  paymentProofReference?: string | null;
  paymentVerifiedBy?: string | null;
  paymentVerifiedAt?: string | null;
  sourceLocationId: string;
  destinationLocationId?: string | null;
  items: DistributorPoItemDto[];
  subtotalPaise: number;
  gstAmountPaise: number;
  totalPaise: number;
  dispatchReference?: string | null;
  dispatchedAt?: string | null;
  notes?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDistributorPoInput {
  distributorId: string;
  destinationLocationId?: string;
  items: {
    sku: string;
    qty: number;
  }[];
  notes?: string;
}

export function validateCreateDistributorPoInput(input: unknown): ValidationResult<CreateDistributorPoInput> {
  const errors: ValidationErrorDetail[] = [];
  if (!input || typeof input !== "object") {
    return failureResult([{ field: "root", message: "Input must be an object" }]);
  }
  const o = input as Record<string, unknown>;
  if (typeof o.distributorId !== "string" || !o.distributorId.trim()) {
    errors.push({ field: "distributorId", message: "distributorId is required" });
  }
  if (!Array.isArray(o.items) || o.items.length === 0) {
    errors.push({ field: "items", message: "At least one PO item is required" });
  } else {
    for (let i = 0; i < o.items.length; i++) {
      const item = o.items[i];
      if (!item || typeof item !== "object") {
        errors.push({ field: `items[${i}]`, message: "Item must be an object" });
        continue;
      }
      if (typeof item.sku !== "string" || !item.sku.trim()) {
        errors.push({ field: `items[${i}].sku`, message: "SKU is required" });
      } else {
        const skuUpper = item.sku.trim().toUpperCase();
        // Floor Springs are strictly ENQUIRY_ONLY per DEC-003
        if (skuUpper.includes("-FS-") || skuUpper.startsWith("SA-I-FS-")) {
          errors.push({
            field: `items[${i}].sku`,
            message: `Floor Springs (${skuUpper}) cannot be purchased via distributor stock PO. Floor springs remain ENQUIRY_ONLY per DEC-003.`,
          });
        }
      }
      if (typeof item.qty !== "number" || item.qty <= 0 || !Number.isInteger(item.qty)) {
        errors.push({ field: `items[${i}].qty`, message: "Quantity must be a positive integer" });
      }
    }
  }

  if (errors.length > 0) return failureResult(errors);
  return successResult({
    distributorId: String(o.distributorId).trim(),
    destinationLocationId: o.destinationLocationId ? String(o.destinationLocationId).trim() : undefined,
    items: (o.items as { sku: string; qty: number }[]).map((it) => ({
      sku: String(it.sku).trim(),
      qty: Number(it.qty),
    })),
    notes: o.notes ? String(o.notes) : undefined,
  });
}

export interface DistributorReceiptLineDto {
  sku: string;
  variantId?: string;
  expectedQty: number;
  receivedQty: number;
  damagedQty: number;
  missingQty: number;
  status: "MATCHED" | "SHORTAGE" | "DAMAGED";
}

export interface DistributorReceiptDto {
  id: string;
  receiptNumber: string;
  poId: string;
  distributorId: string;
  status: "DRAFT" | "SUBMITTED" | "VERIFIED" | "DISCREPANCY_FLAGGED";
  lines: DistributorReceiptLineDto[];
  inspectionNotes?: string | null;
  inspectionEvidenceUrls?: string[];
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export function validateDistributorReceiptLines(
  lines: unknown[]
): ValidationResult<DistributorReceiptLineDto[]> {
  const errors: ValidationErrorDetail[] = [];
  if (!Array.isArray(lines) || lines.length === 0) {
    return failureResult([{ field: "lines", message: "Receipt lines array is required and cannot be empty" }]);
  }

  const validated: DistributorReceiptLineDto[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] as Record<string, unknown>;
    if (!l || typeof l !== "object") {
      errors.push({ field: `lines[${i}]`, message: "Line item must be an object" });
      continue;
    }
    const sku = String(l.sku || "").trim();
    if (!sku) errors.push({ field: `lines[${i}].sku`, message: "Line item SKU is required" });

    const expectedQty = Number(l.expectedQty ?? 0);
    const receivedQty = Number(l.receivedQty ?? 0);
    const damagedQty = Number(l.damagedQty ?? 0);
    const missingQty = Number(l.missingQty ?? 0);

    if (expectedQty < 0 || receivedQty < 0 || damagedQty < 0 || missingQty < 0) {
      errors.push({ field: `lines[${i}]`, message: "Quantities cannot be negative" });
    }

    // Mathematical reconciliation invariant: expectedQty === receivedQty + damagedQty + missingQty
    if (expectedQty !== receivedQty + damagedQty + missingQty) {
      errors.push({
        field: `lines[${i}]`,
        message: `Quantity mismatch for ${sku}: expected (${expectedQty}) must equal received (${receivedQty}) + damaged (${damagedQty}) + missing (${missingQty})`,
      });
    }

    let status: "MATCHED" | "SHORTAGE" | "DAMAGED" = "MATCHED";
    if (damagedQty > 0) status = "DAMAGED";
    else if (missingQty > 0) status = "SHORTAGE";

    validated.push({
      sku,
      variantId: l.variantId ? String(l.variantId) : undefined,
      expectedQty,
      receivedQty,
      damagedQty,
      missingQty,
      status,
    });
  }

  if (errors.length > 0) return failureResult(errors);
  return successResult(validated);
}

export interface DistributorInventoryItemDto {
  id: string;
  distributorId: string;
  sku: string;
  variantId?: string;
  title: string;
  locationId: string;
  stockedQty: number;
  reservedQty: number;
  damagedQty: number;
  inTransitQty: number;
  availableSaleableQty: number; // stockedQty - reservedQty
  unitCostPaise?: number | null;
  updatedAt: string;
}

export interface SellerResolutionDto {
  resolvedRoute: CanonicalSellerRoute;
  sellerId: string; // 'SAI_AJANTHA_CENTRAL' or distributorId
  sellerName: string;
  isQuoteOnly: boolean;
  requiresEnquiry: boolean;
  reason: string;
}

export interface FinancialSeparationSummaryDto {
  saiAjanthaSupplierRevenuePaise: number;
  saiAjanthaPaymentPendingVerificationPaise: number;
  distributorQuotePipelineDemandPaise: number;
  distributorCompletedResaleGmvPaise: number;
  distributorResaleGmvPaise?: number; // Backward-compatible alias for completed GMV (= 0)
  distributorResaleGmvStatus: string;
  isRealGatewayEnabled: boolean;
  invoiceDisclaimer: string;
}

// ============================================================================
// 9. Domain 8: Canonical Seller Resolution, Persistent Cart & Mixed-Seller Groups
// ============================================================================

export type AllowedNextAction =
  | "READY_FOR_TEST_CHECKOUT"
  | "REQUEST_QUOTE"
  | "OUT_OF_STOCK"
  | "UNVERIFIED_PRICE_OR_TAX"
  | "UNSERVICEABLE_PIN"
  | "SESSION_REQUIRED"
  | "NOT_AVAILABLE";

export interface CanonicalSellerResolutionDto {
  sku: string;
  variantId?: string;
  title: string;
  categorySlug: string;
  categoryName: string;
  resolvedRoute: CanonicalSellerRoute;
  sellerId: string;
  sellerName: string;
  warehouseId: string;
  isQuoteOnly: boolean;
  requiresEnquiry: boolean;
  allowedNextAction: AllowedNextAction;
  serviceable: boolean;
  availableStock: number | null;
  inStock: boolean;
  unitPricePaise: number | null;
  taxRatePercent: number | null;
  reason: string;
  timestamp: string;
}

export interface CartLineItemDto {
  id: string;
  cartId: string;
  productId: string;
  variantId?: string;
  sku: string;
  title: string;
  quantity: number;
  sellerRoute: CanonicalSellerRoute;
  sellerId: string;
  sellerName: string;
  warehouseId: string;
  isQuoteOnly: boolean;
  unitPricePaise: number | null;
  totalPricePaise: number | null;
  taxRatePercent: number | null;
  customConfiguration?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CartSellerGroupDto {
  groupKey: string;
  sellerId: string;
  sellerName: string;
  sellerRoute: CanonicalSellerRoute;
  warehouseId: string;
  currency: string;
  fulfilmentPolicy: string;
  items: CartLineItemDto[];
  itemCount: number;
  subtotalPaise: number;
  gstAmountPaise: number;
  totalPaise: number;
  isQuoteOnly: boolean;
  checkoutEligibility: {
    canCheckout: boolean;
    nextAction: AllowedNextAction;
    reason: string;
  };
}

export interface PersistentCartDto {
  id: string;
  sessionToken?: string;
  customerId?: string | null;
  postalCode?: string | null;
  status: "ACTIVE" | "MERGED" | "ABANDONED" | "CONVERTED";
  currencyCode: string;
  groups: CartSellerGroupDto[];
  lines: CartLineItemDto[];
  totalItemCount: number;
  isMixedSeller: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddToCartInput {
  sku: string;
  quantity: number;
  postalCode?: string;
  customConfiguration?: Record<string, unknown>;
}

export function validateAddToCartInput(input: unknown): ValidationResult<AddToCartInput> {
  const errors: ValidationErrorDetail[] = [];
  if (!input || typeof input !== "object") {
    return failureResult([{ field: "root", message: "Input must be an object" }]);
  }
  const o = input as Record<string, unknown>;
  const sku = String(o.sku || "").trim();
  if (!sku) errors.push({ field: "sku", message: "sku is required" });

  const quantity = Number(o.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    errors.push({ field: "quantity", message: "quantity must be a positive integer" });
  }

  const postalCode = o.postalCode ? String(o.postalCode).trim() : undefined;
  if (postalCode && !/^\d{6}$/.test(postalCode)) {
    errors.push({ field: "postalCode", message: "postalCode must be a 6-digit numeric string" });
  }

  if (errors.length > 0) return failureResult(errors);
  return successResult({
    sku,
    quantity,
    postalCode,
    customConfiguration: (o.customConfiguration as Record<string, unknown>) || undefined,
  });
}

// =============================================================================
// DOMAIN 9: ORDERS, TAX ENGINE, FINANCE, FULFILMENT & RETURNS
// =============================================================================

export type CanonicalOrderLifecycleStatus =
  | "DRAFT"
  | "QUOTED"
  | "AWAITING_PAYMENT"
  | "CONFIRMED"
  | "CONFIRMED_TRADE_PO"
  | "PROCESSING"
  | "DISPATCHED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "CLOSED";

export type CanonicalPaymentLifecycleStatus =
  | "UNPAID"
  | "AWAITING_BANK_VERIFICATION"
  | "AUTHORIZED"
  | "PAID"
  | "PARTIALLY_REFUNDED"
  | "REFUNDED"
  | "FAILED"
  | "EXCEPTION";

export type CanonicalFulfilmentLifecycleStatus =
  | "UNALLOCATED"
  | "ALLOCATED"
  | "PACKED"
  | "DISPATCHED"
  | "DELIVERY_ATTEMPTED"
  | "DELIVERED"
  | "FAILED"
  | "RETURN_IN_TRANSIT"
  | "RETURN_RECEIVED";

export type CanonicalReturnLifecycleStatus =
  | "NONE"
  | "REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "IN_TRANSIT"
  | "RECEIVED_QUARANTINED"
  | "INSPECTED_ACCEPTED"
  | "INSPECTED_SCRAPPED"
  | "COMPLETED";

export type CanonicalRefundLifecycleStatus =
  | "NONE"
  | "REQUESTED"
  | "APPROVED_PENDING_PAYOUT"
  | "PROCESSED_SANDBOX"
  | "REJECTED";

export type CanonicalBankProofStatus =
  | "NONE"
  | "UTR_SUBMITTED"
  | "VERIFIED"
  | "REJECTED";

export type CanonicalDocumentType =
  | "PROFORMA"
  | "DRAFT_INVOICE"
  | "DRAFT_CREDIT_NOTE";

export interface LineTaxDetailDto {
  sku: string;
  hsnCode?: string | null;
  taxableValuePaise: number;
  gstRatePercent: number | null;
  taxType: "INTRA_STATE" | "INTER_STATE" | "UNVERIFIED";
  cgstRatePercent: number;
  cgstAmountPaise: number;
  sgstRatePercent: number;
  sgstAmountPaise: number;
  igstRatePercent: number;
  igstAmountPaise: number;
  totalTaxPaise: number;
  isTaxVerified: boolean;
}

export interface CalculatedOrderTotalsDto {
  subtotalPaise: number;
  cgstTotalPaise: number;
  sgstTotalPaise: number;
  igstTotalPaise: number;
  cgstPaise?: number;
  sgstPaise?: number;
  igstPaise?: number;
  totalTaxPaise: number;
  shippingPaise: number;
  shippingTaxPaise: number;
  discountPaise: number;
  grandTotalPaise: number;
  isTaxFullyVerified: boolean;
  isTaxVerified?: boolean;
  taxType?: "INTRA_STATE" | "INTER_STATE" | "UNVERIFIED";
  requiresQuotation: boolean;
  unverifiedReasons: string[];
}

export interface OrderTransitionInput {
  orderId: string;
  command:
    | "MARK_CONFIRMED"
    | "SUBMIT_BANK_PROOF"
    | "VERIFY_BANK_PAYMENT"
    | "REJECT_BANK_PAYMENT"
    | "ALLOCATE_STOCK"
    | "PACK_ORDER"
    | "DISPATCH_ORDER"
    | "MARK_DELIVERED"
    | "CANCEL_ORDER";
  actorRole: "STAFF_FINANCE" | "STAFF_LOGISTICS" | "STAFF_ADMIN" | "DISTRIBUTOR" | "CUSTOMER";
  actorId: string;
  notes?: string;
  carrierName?: string;
  trackingNumber?: string;
  bankReference?: string;
  verifiedAmountPaise?: number;
  cancellationReason?: string;
}

export interface ReturnRequestDto {
  id: string;
  orderId: string;
  lineId: string;
  sku: string;
  quantityRequested: number;
  reason: string;
  customerNotes?: string;
  status: CanonicalReturnLifecycleStatus;
  refundStatus: CanonicalRefundLifecycleStatus;
  inspectedQtyAccepted: number;
  inspectedQtyScrapped: number;
  restockedToInventory: boolean;
  refundAmountPaise?: number;
  createdAt: string;
  updatedAt: string;
}

export interface FinancialDocumentDto {
  docId: string;
  docNumber: string;
  docType: CanonicalDocumentType;
  orderId: string;
  sellerId: string;
  sellerLegalName: string;
  sellerGstin?: string | null;
  sellerAddress: string;
  buyerName: string;
  buyerEmail: string;
  buyerGstin?: string | null;
  shippingAddress: string;
  placeOfSupplyStateCode: string;
  currency: "INR";
  lines: LineTaxDetailDto[];
  totals: CalculatedOrderTotalsDto;
  disclaimer: "Draft / Not a Tax Invoice";
  isOfficialTaxDocument: false;
  issuedAt: string;
}

export function validateOrderTransition(
  currentStatus: CanonicalOrderLifecycleStatus,
  currentPaymentOrCommand: CanonicalPaymentLifecycleStatus | OrderTransitionInput["command"],
  maybeCommand?: OrderTransitionInput["command"]
): { allowed: boolean; reason?: string } {
  let currentPayment: CanonicalPaymentLifecycleStatus = "UNPAID";
  let command: OrderTransitionInput["command"];

  if (maybeCommand !== undefined) {
    currentPayment = currentPaymentOrCommand as CanonicalPaymentLifecycleStatus;
    command = maybeCommand;
  } else {
    command = currentPaymentOrCommand as OrderTransitionInput["command"];
  }

  // BE-13 & ADM-07: Strictly prevent CANCELLED -> INVOICED or transition from terminal states
  if (currentStatus === "CANCELLED") {
    return { allowed: false, reason: "Cannot transition a CANCELLED order." };
  }
  if (currentStatus === "CLOSED") {
    return { allowed: false, reason: "Order is CLOSED and cannot be modified." };
  }

  switch (command) {
    case "CANCEL_ORDER":
      if (currentStatus === "COMPLETED") {
        return { allowed: false, reason: "Completed orders cannot be cancelled; request a return instead." };
      }
      return { allowed: true };

    case "SUBMIT_BANK_PROOF":
      if (currentPayment === "PAID") {
        return { allowed: false, reason: "Order is already marked PAID." };
      }
      return { allowed: true };

    case "VERIFY_BANK_PAYMENT":
      if (
        currentPayment !== "AWAITING_BANK_VERIFICATION" &&
        (currentPayment as string) !== "AWAITING_FINANCE_APPROVAL" &&
        (currentPayment as string) !== "UTR_SUBMITTED" &&
        currentPayment !== "UNPAID"
      ) {
        return { allowed: false, reason: `Cannot verify payment from state '${currentPayment}'.` };
      }
      return { allowed: true };

    case "PACK_ORDER":
      if (currentStatus !== "CONFIRMED" && currentStatus !== "CONFIRMED_TRADE_PO" && currentStatus !== "PROCESSING") {
        return { allowed: false, reason: `Order must be CONFIRMED before packing (current: ${currentStatus}).` };
      }
      return { allowed: true };

    case "DISPATCH_ORDER":
      if (currentStatus !== "CONFIRMED" && currentStatus !== "CONFIRMED_TRADE_PO" && currentStatus !== "PROCESSING") {
        return { allowed: false, reason: `Order must be CONFIRMED or PACKED before dispatch.` };
      }
      return { allowed: true };

    case "MARK_DELIVERED":
      if (currentStatus === "AWAITING_PAYMENT" || (currentStatus as string) === "PENDING_PAYMENT") {
        return { allowed: false, reason: "Cannot deliver an unconfirmed or pending payment order." };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}





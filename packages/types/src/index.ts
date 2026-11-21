export type ProductCategory =
  | "Aluminium"
  | "Clip"
  | "Door Closer & Floor Spring"
  | "Door closers"
  | "Floor springs"
  | "FGM Fittings"
  | "Frames & Channels"
  | "Hardware"
  | "Insect Screens"
  | "Kitchen Basket"
  | "Kitchen baskets"
  | "Ladder"
  | "Mesh"
  | "Rubber & PVC"
  | "Finished insect screens"
  | "Aluminium sections"
  | "Ladders"
  | "Rubber and PVC beading"
  | "FGM fittings and channels"
  | "Clips"
  | "Frames and channels";

export type SellerRoute = "SAI_AJANTHA_DIRECT" | "DISTRIBUTOR_RESALE" | "ENQUIRY_ONLY";

export interface CommercialFeatureFlags {
  floorSpringsRouteConfirmed: boolean;
  distributorOnlineCheckoutEnabled: boolean;
  distributorPaymentCaptureEnabled: boolean;
  distributorRefundsEnabled: boolean;
  liveRazorpayEnabled: boolean;
  /**
   * @deprecated Admin authentication is strictly non-optional on the server.
   * This flag is retained solely for backward interface compatibility and cannot disable authentication.
   */
  authoritativeAdminAuthEnforced?: boolean;
}

export const DEFAULT_COMMERCIAL_FEATURE_FLAGS: CommercialFeatureFlags = {
  floorSpringsRouteConfirmed: false,
  distributorOnlineCheckoutEnabled: false,
  distributorPaymentCaptureEnabled: false,
  distributorRefundsEnabled: false,
  liveRazorpayEnabled: false,
  authoritativeAdminAuthEnforced: true,
};

export const CATEGORY_ROUTING: Record<string, SellerRoute> = {
  // Direct Sai Ajantha categories (9)
  "Finished insect screens": "SAI_AJANTHA_DIRECT",
  "Aluminium sections": "SAI_AJANTHA_DIRECT",
  "Hardware": "SAI_AJANTHA_DIRECT",
  "Ladders": "SAI_AJANTHA_DIRECT",
  "Rubber and PVC beading": "SAI_AJANTHA_DIRECT",
  "FGM fittings and channels": "SAI_AJANTHA_DIRECT",
  "Clips": "SAI_AJANTHA_DIRECT",
  "Frames and channels": "SAI_AJANTHA_DIRECT",
  "Mesh": "SAI_AJANTHA_DIRECT",
  // Legacy aliases
  "Aluminium": "SAI_AJANTHA_DIRECT",
  "Clip": "SAI_AJANTHA_DIRECT",
  "FGM Fittings": "SAI_AJANTHA_DIRECT",
  "Frames & Channels": "SAI_AJANTHA_DIRECT",
  "Insect Screens": "SAI_AJANTHA_DIRECT",
  "Ladder": "SAI_AJANTHA_DIRECT",
  "Rubber & PVC": "SAI_AJANTHA_DIRECT",
  // House of Ajantha distributor-led categories (2)
  "Door closers": "DISTRIBUTOR_RESALE",
  "Kitchen baskets": "DISTRIBUTOR_RESALE",
  "Kitchen Basket": "DISTRIBUTOR_RESALE",
  // Unresolved category (enquiry-only fallback per DEC-003)
  "Floor springs": "ENQUIRY_ONLY",
  "Door Closer & Floor Spring": "ENQUIRY_ONLY",
};

export interface ProductItem {
  id: string;
  filename: string;
  src: string;
  category: ProductCategory;
  subcategory: string | null;
  code: string | null;
  name: string;
  isManufactured?: boolean;
  verifiedPriceInr?: number | null;
}

export type UserRole = "CUSTOMER" | "DISTRIBUTOR" | "DEALER" | "ADMIN";
export type ApprovalStatus = "APPROVED" | "PENDING_APPROVAL" | "REJECTED";
export type EffectivePriceTier = "CUSTOMER" | "DEALER" | "DISTRIBUTOR";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  gstin: string | null;
  businessCity: string | null;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
}

export interface TradeOrderItem {
  id: string;
  order_id: string;
  product_id: string;
  sku: string;
  name: string;
  category: string;
  finish: string | null;
  pack_label: string | null;
  pack_multiplier: number;
  unit_price_inr: number | null;
  quantity: number;
  line_total_inr: number | null;
  is_manufactured?: boolean;
}

export type OrderRoutingStatus =
  | "DIRECT_FULFILLMENT"
  | "PENDING_DISTRIBUTOR_ASSIGNMENT"
  | "ROUTED_TO_DISTRIBUTOR"
  | "ASSIGNED_TO_DEALER"
  | "DELIVERED_BY_DEALER";

export interface TradeOrderRecord {
  id: string;
  order_number: string;
  customer_id: string;
  role_at_order: string;
  price_tier_applied: string;
  status: string;
  payment_status: string;
  payment_method: string;
  razorpay_order_id?: string | null;
  razorpay_payment_id?: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  organization: string;
  gstin?: string | null;
  shipping_address: string;
  subtotal_inr: number;
  gst_amount_inr: number;
  total_inr: number;
  has_quote_items: boolean;
  shipping_carrier?: string | null;
  tracking_reference?: string | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  refund_status: string;
  items: TradeOrderItem[];
  routing_status?: OrderRoutingStatus;
  assigned_distributor_id?: string | null;
  assigned_distributor_name?: string | null;
  assigned_dealer_id?: string | null;
  assigned_dealer_name?: string | null;
  has_manufactured_items?: boolean;
  created_at: string;
}

export interface TradeEnquiryRecord {
  id: string;
  name: string;
  role: string;
  organization: string;
  phone: string;
  email: string;
  city: string;
  division: string;
  notes: string;
  source: string;
  status: string;
  created_at: string;
}

/**
 * Escapes HTML characters to prevent XSS in print popups and dynamic HTML rendering (ADM-02).
 */
export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Safely serializes objects for embedding inside JSON-LD `<script>` elements (SF-05).
 * Encodes `<`, `>`, `&`, and unicode line terminators to prevent script injection / breakout.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// Re-export runtime-validated shared contracts (P4.2)
export type {
  ValidationErrorDetail,
  ValidationResult,
  CanonicalUserRole,
  CanonicalApprovalStatus,
  CanonicalPriceTier,
  ActorSessionDto,
  CanonicalSellerRoute,
  PublicCatalogItemDto,
  TradeCatalogItemDto,
  CanonicalOrderType,
  CanonicalOrderStatus,
  CanonicalPaymentStatus,
  OrderLineItemDto,
  CanonicalOrderDto,
  PaymentVerificationResultDto,
  ReservationLifecycleState,
  StockReservationDto,
  StandardErrorCode,
  StandardErrorEnvelopeDto,
  CanonicalProductLifecycleStatus,
  Canonical11Category,
  CategoryRoutePolicy,
  CanonicalImportJobStatus,
  ImportRowSeverity,
  StagedImportRowDto,
  ProductImportJobDto,
  CanonicalDistributorCoverageStatus,
  DistributorCoverageDto,
  AssignCoverageInput,
  CanonicalDistributorPoStatus,
  CanonicalDistributorPoPaymentStatus,
  DistributorPoItemDto,
  DistributorPoDto,
  CreateDistributorPoInput,
  DistributorReceiptLineDto,
  DistributorReceiptDto,
  DistributorInventoryItemDto,
  SellerResolutionDto,
  FinancialSeparationSummaryDto,
  AllowedNextAction,
  CanonicalSellerResolutionDto,
  CartLineItemDto,
  CartSellerGroupDto,
  PersistentCartDto,
  AddToCartInput,
  CanonicalOrderLifecycleStatus,
  CanonicalPaymentLifecycleStatus,
  CanonicalFulfilmentLifecycleStatus,
  CanonicalReturnLifecycleStatus,
  CanonicalRefundLifecycleStatus,
  CanonicalBankProofStatus,
  CanonicalDocumentType,
  LineTaxDetailDto,
  CalculatedOrderTotalsDto,
  OrderTransitionInput,
  ReturnRequestDto,
  FinancialDocumentDto,
  Excel34ColumnHeader,
  FieldVerificationStatus,
  ScreenOrderItemAreaInput,
} from "./contracts.js";

export {
  successResult,
  failureResult,
  validateActorSessionDto,
  validatePublicCatalogItemDto,
  validateOrderLineItemDto,
  createStandardErrorEnvelope,
  CATEGORY_ROUTE_POLICIES,
  resolveProductSellerRoute,
  validateAssignCoverageInput,
  validateCreateDistributorPoInput,
  validateDistributorReceiptLines,
  validateAddToCartInput,
  validateOrderTransition,
  calculateScreenItemAreaSqFt,
  validateCombinedScreenMoq,
  generateExact34ColumnTemplateCsv,
  EXCEL_34_COLUMNS,
} from "./contracts.js";



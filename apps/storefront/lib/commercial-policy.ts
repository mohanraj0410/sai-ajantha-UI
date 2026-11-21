import type { ProductCategory, ProductItem } from "@/lib/products";

/**
 * Fail-closed frontend commercial safety flags mirroring backend DEC-002 / DEC-003.
 * Never overrides server authorization; prevents misleading "Buy Now" or live-money CTAs.
 */
export const COMMERCIAL_FLAGS = {
  liveRazorpayEnabled: false,
  distributorOnlineCheckoutEnabled: false,
  distributorPaymentCaptureEnabled: false,
  distributorRefundsEnabled: false,
  floorSpringsRouteConfirmed: false,
} as const;

export const DIRECT_SALE_CATEGORIES: readonly ProductCategory[] = [
  "Insect Screens",
  "Aluminium",
  "Hardware",
  "Ladder",
  "Rubber & PVC",
  "FGM Fittings",
  "Clip",
  "Frames & Channels",
  "Mesh",
] as const;

export const HOUSE_OF_AJANTHA_CATEGORIES: readonly ProductCategory[] = [
  "Door Closer & Floor Spring",
  "Kitchen Basket",
] as const;

export type ProductSaleRoute =
  | "SAI_AJANTHA_DIRECT"
  | "DISTRIBUTOR_RESALE"
  | "FLOOR_SPRING_UNCONFIRMED"
  | "ENQUIRY_ONLY";

export type ProductCtaMode = "BUY_NOW" | "CHECK_AVAILABILITY" | "REQUEST_QUOTE";

export interface ProductPolicyEvaluation {
  route: ProductSaleRoute;
  ctaMode: ProductCtaMode;
  isFloorSpring: boolean;
  isDistributorCategory: boolean;
  hasSpecConflict: boolean;
  sellerLabel: string;
  ctaLabel: string;
  policyNote: string;
}

/**
 * Known workbook SKUs flagged in the official Product Presentation SOP for manual verification
 * before assertions or payable checkout are enabled.
 */
const SOP_CONFLICT_SKUS = new Set(["ma-d-mesh black 3-001", "sa-m-dc-60-001"]);

export function isFloorSpringProduct(item: Pick<ProductItem, "category" | "subcategory" | "name" | "code">): boolean {
  const haystack = `${item.subcategory ?? ""} ${item.name} ${item.code ?? ""}`.toLowerCase();
  return (
    haystack.includes("floor spring") ||
    haystack.includes("sa-i-fs") ||
    haystack.includes("sa-m-fs")
  );
}

export function isDistributorLedCategory(category: ProductCategory): boolean {
  return HOUSE_OF_AJANTHA_CATEGORIES.includes(category);
}

/**
 * Evaluates a product's honest route & CTA mode strictly from source rules:
 * - Floor springs -> always REQUEST_QUOTE while floorSpringsRouteConfirmed === false
 * - Spec-conflicting SKUs (e.g. MA-D-Mesh black 3-001) -> REQUEST_QUOTE
 * - Unpriced / unapproved SKUs -> REQUEST_QUOTE (never Rs.0)
 * - Door Closers & Kitchen Baskets -> distributor-led route; CHECK_AVAILABILITY until PIN/seller & checkout flag confirmed
 * - 9 direct categories -> Sai Ajantha Direct; CHECK_AVAILABILITY if PIN/stock/payment unconfirmed, BUY_NOW only when eligible
 */
export function evaluateProductPolicy(
  item: ProductItem,
  options?: {
    resolvedPriceInr?: number | null;
    pincodeConfirmed?: boolean;
    assignedSellerName?: string | null;
    userRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ADMIN" | null;
  }
): ProductPolicyEvaluation {
  const floorSpring = isFloorSpringProduct(item);
  const distributorCat = isDistributorLedCategory(item.category);
  const skuKey = (item.code ?? "").trim().toLowerCase();
  const hasSpecConflict = SOP_CONFLICT_SKUS.has(skuKey);
  const unitPrice = options?.resolvedPriceInr ?? item.customerPriceInr ?? item.unitPriceInr ?? null;
  const isApproved = Boolean(item.approved);
  const hasStock = (item.stockQty ?? 0) > 0;

  if (floorSpring && !COMMERCIAL_FLAGS.floorSpringsRouteConfirmed) {
    return {
      route: "FLOOR_SPRING_UNCONFIRMED",
      ctaMode: "REQUEST_QUOTE",
      isFloorSpring: true,
      isDistributorCategory: distributorCat,
      hasSpecConflict,
      sellerLabel: "Sales Route Pending Owner Confirmation",
      ctaLabel: "Request a Quote",
      policyNote:
        "Floor springs require quotation and sales-route confirmation before ordering.",
    };
  }

  if (skuKey === "ma-d-mesh black 3-001") {
    return {
      route: "SAI_AJANTHA_DIRECT",
      ctaMode: "REQUEST_QUOTE",
      isFloorSpring: false,
      isDistributorCategory: false,
      hasSpecConflict: true,
      sellerLabel: "Sai Ajantha Interior Solutions",
      ctaLabel: "Request a Quote",
      policyNote:
        "Send opening measurements, quantity, and delivery PIN code so Sai Ajantha can confirm supply unit, composition, and price.",
    };
  }

  if (unitPrice === null || !isApproved) {
    return {
      route: distributorCat ? "DISTRIBUTOR_RESALE" : "SAI_AJANTHA_DIRECT",
      ctaMode: "REQUEST_QUOTE",
      isFloorSpring: false,
      isDistributorCategory: distributorCat,
      hasSpecConflict,
      sellerLabel: distributorCat
        ? options?.assignedSellerName || "Authorized Regional Distributor (Assigned by PIN)"
        : "Sai Ajantha Interior Solutions",
      ctaLabel: "Request a Quote",
      policyNote:
        "Custom sizing, bulk quantities, or unconfirmed pricing require a formal quotation before payment.",
    };
  }

  if (distributorCat) {
    // Distributor Buy Stock wholesale orders have Sai Ajantha as seller
    if (options?.userRole === "DISTRIBUTOR") {
      return {
        route: "SAI_AJANTHA_DIRECT",
        ctaMode: hasStock ? "CHECK_AVAILABILITY" : "REQUEST_QUOTE",
        isFloorSpring: false,
        isDistributorCategory: true,
        hasSpecConflict,
        sellerLabel: "Sai Ajantha Interior Solutions (Wholesale Stock Supply)",
        ctaLabel: "Check Availability",
        policyNote:
          "Distributor Buy Stock orders are supplied and invoiced by Sai Ajantha against approved wholesale terms.",
      };
    }

    const sellerResolved = Boolean(options?.pincodeConfirmed && options?.assignedSellerName);
    const canBuyOnline =
      sellerResolved &&
      hasStock &&
      COMMERCIAL_FLAGS.distributorOnlineCheckoutEnabled &&
      COMMERCIAL_FLAGS.liveRazorpayEnabled;

    return {
      route: "DISTRIBUTOR_RESALE",
      ctaMode: canBuyOnline ? "BUY_NOW" : "CHECK_AVAILABILITY",
      isFloorSpring: false,
      isDistributorCategory: true,
      hasSpecConflict,
      sellerLabel:
        options?.assignedSellerName ||
        "Regional Distributor (Check Delivery PIN Code)",
      ctaLabel: canBuyOnline ? "Buy Now" : "Check Availability",
      policyNote: sellerResolved
        ? "Distributor online checkout is awaiting payment-provider sign-off; submit availability enquiry or Trade PO."
        : "Enter your delivery PIN code to check regional distributor coverage and stock availability.",
    };
  }

  // 9 Direct-sale categories sold by Sai Ajantha
  const directReady =
    Boolean(options?.pincodeConfirmed) &&
    hasStock &&
    !hasSpecConflict &&
    COMMERCIAL_FLAGS.liveRazorpayEnabled;

  return {
    route: "SAI_AJANTHA_DIRECT",
    ctaMode: directReady ? "BUY_NOW" : "CHECK_AVAILABILITY",
    isFloorSpring: false,
    isDistributorCategory: false,
    hasSpecConflict,
    sellerLabel: "Sai Ajantha Interior Solutions (Direct Seller)",
    ctaLabel: directReady ? "Buy Now" : "Check Availability",
    policyNote: !hasStock
      ? "Check current stock and dispatch schedule for your delivery PIN code."
      : !COMMERCIAL_FLAGS.liveRazorpayEnabled
        ? "Live online payment is disabled pending launch approval; you may add to schedule or submit a Trade PO / enquiry."
        : "Enter delivery PIN code to confirm freight and dispatch timing.",
  };
}

/**
 * Shared typed contracts for seller routing, split-cart checkout, quotations,
 * separate installation requests, and return inspections.
 */
export interface SellerResolutionResult {
  pincode: string;
  serviceable: boolean;
  sellerId: string;
  sellerName: string;
  sellerType: "SAI_AJANTHA" | "DISTRIBUTOR" | "UNCONFIRMED";
  deliveryChargeInr: number | null;
  deliveryEtaNote: string;
  checkoutEligible: boolean;
  blockedReason: string | null;
}

export interface QuotationRequestPayload {
  productId?: string;
  sku?: string;
  productName?: string;
  category: string;
  dimensions: string;
  dimensionUnit: "mm" | "cm" | "ft" | "inch" | "m";
  quantity: number;
  deliveryPincode: string;
  targetDate?: string;
  photoNotes?: string;
  notes?: string;
  contactName: string;
  phone: string;
  email?: string;
}

export interface InstallationRequestPayload {
  contactName: string;
  phone: string;
  email?: string;
  deliveryPincode: string;
  city: string;
  category: string;
  productReference?: string;
  siteDetails: string;
  preferredDate?: string;
}

export type SellerGroupKey = "sai_ajantha" | "distributor" | "enquiry";

export interface CartGroupItemLike {
  key: string;
  productId: string;
  sku: string;
  name: string;
  category: string;
  unitPriceInr: number | null;
  quantity: number;
}

export interface GroupedSellerCart<T extends CartGroupItemLike> {
  groupKey: SellerGroupKey;
  sellerName: string;
  sellerBadge: string;
  items: T[];
  pricedSubtotalInr: number;
  estimatedGstInr: number;
  payableTotalInr: number;
  payableOnline: boolean;
  tradePoAllowed: boolean;
  blockedReason: string | null;
  policySummary: string;
}

/**
 * Groups cart items strictly by responsible legal seller & commercial policy:
 * - Enquiry / Quote-only group (Floor Springs, unpriced, conflicting SKUs)
 * - Sai Ajantha Direct group (9 direct categories + Distributor Buy Stock)
 * - Authorized Distributor group (Door Closers & Kitchen Baskets for Homeowners/Dealers)
 */
export function groupCartItemsBySeller<T extends CartGroupItemLike>(
  items: readonly T[],
  options?: {
    pincode?: string | null;
    userRole?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" | "ADMIN" | null;
    distributorSellerName?: string | null;
  }
): GroupedSellerCart<T>[] {
  const saiItems: T[] = [];
  const distItems: T[] = [];
  const enquiryItems: T[] = [];

  for (const item of items) {
    const floorSpring = isFloorSpringProduct({
      category: item.category as ProductCategory,
      subcategory: null,
      name: item.name,
      code: item.sku,
    });
    const skuLower = (item.sku || "").trim().toLowerCase();
    const isConflict = SOP_CONFLICT_SKUS.has(skuLower) && skuLower === "ma-d-mesh black 3-001";

    if (floorSpring || item.unitPriceInr === null || isConflict) {
      enquiryItems.push(item);
      continue;
    }

    const distCat = isDistributorLedCategory(item.category as ProductCategory);
    if (distCat && options?.userRole !== "DISTRIBUTOR") {
      distItems.push(item);
    } else {
      saiItems.push(item);
    }
  }

  const validPin = Boolean(options?.pincode && /^\d{6}$/.test(options.pincode.trim()));
  const groups: GroupedSellerCart<T>[] = [];

  if (saiItems.length > 0) {
    const sub = saiItems.reduce((s, i) => s + (i.unitPriceInr ?? 0) * i.quantity, 0);
    const gst = Math.round(sub * 0.18 * 100) / 100;
    groups.push({
      groupKey: "sai_ajantha",
      sellerName: "Sai Ajantha Interior Solutions",
      sellerBadge:
        options?.userRole === "DISTRIBUTOR"
          ? "Wholesale Stock Seller (Sai Ajantha)"
          : "Direct Seller · 9 Core Categories",
      items: saiItems,
      pricedSubtotalInr: Math.round(sub * 100) / 100,
      estimatedGstInr: gst,
      payableTotalInr: Math.round((sub + gst) * 100) / 100,
      payableOnline: validPin && COMMERCIAL_FLAGS.liveRazorpayEnabled,
      tradePoAllowed: validPin,
      blockedReason: !validPin
        ? "Enter and confirm a 6-digit delivery PIN code to verify freight & seller coverage."
        : !COMMERCIAL_FLAGS.liveRazorpayEnabled
          ? "Live online payment is disabled pending launch approval (test/Trade PO enquiry mode)."
          : null,
      policySummary:
        "Sai Ajantha invoices, dispatches, and handles returns directly for this seller group.",
    });
  }

  if (distItems.length > 0) {
    const sub = distItems.reduce((s, i) => s + (i.unitPriceInr ?? 0) * i.quantity, 0);
    const gst = Math.round(sub * 0.18 * 100) / 100;
    groups.push({
      groupKey: "distributor",
      sellerName: options?.distributorSellerName || (validPin
        ? `Regional Distributor (PIN ${options?.pincode?.trim()})`
        : "Authorized Regional Distributor (PIN Required)"),
      sellerBadge: "House of Ajantha · Distributor Resale",
      items: distItems,
      pricedSubtotalInr: Math.round(sub * 100) / 100,
      estimatedGstInr: gst,
      payableTotalInr: Math.round((sub + gst) * 100) / 100,
      payableOnline: false, // DEC-002: distributorOnlineCheckoutEnabled === false
      tradePoAllowed: false,
      blockedReason: !validPin
        ? "Enter a 6-digit delivery PIN code to check regional distributor assignment."
        : "Distributor online resale checkout is disabled pending payment-provider & settlement sign-off (DEC-002). Submit as enquiry without paying.",
      policySummary:
        "The assigned regional distributor owns billing, delivery, returns, and refunds for House of Ajantha items.",
    });
  }

  if (enquiryItems.length > 0) {
    groups.push({
      groupKey: "enquiry",
      sellerName: "Quotation / Verification Desk",
      sellerBadge: "Quote-Only Items (Excluded from Payable Totals)",
      items: enquiryItems,
      pricedSubtotalInr: 0,
      estimatedGstInr: 0,
      payableTotalInr: 0,
      payableOnline: false,
      tradePoAllowed: false,
      blockedReason:
        "Includes Floor Springs (route unconfirmed), custom sizes, or unpriced items. Request a formal quotation without payment.",
      policySummary:
        "These items are kept separate from payable totals and routed to the seller for formal quotation.",
    });
  }

  return groups;
}

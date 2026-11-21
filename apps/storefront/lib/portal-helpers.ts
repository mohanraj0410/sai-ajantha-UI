import type { ProductItem } from "@/lib/products";

export type PortalStatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface FormattedStatus {
  label: string;
  tone: PortalStatusTone;
}

export interface PortalOrderLineItem {
  id?: string;
  sku: string;
  name: string;
  category?: string;
  finish?: string;
  pack_label?: string;
  unit_price_inr: number | null;
  quantity: number;
  line_total_inr: number;
}

export interface PortalOrderEvent {
  id: string;
  status: string;
  note: string;
  actor_name: string;
  created_at: string;
}

export interface PortalOrderRecord {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  price_tier_applied: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  organization: string;
  gstin?: string | null;
  shipping_address: string;
  subtotal_inr: number;
  gst_amount_inr: number;
  total_inr: number;
  shipping_carrier?: string | null;
  tracking_reference?: string | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  refund_status?: string;
  created_at: string;
  items?: PortalOrderLineItem[];
  events?: PortalOrderEvent[];
}

export const OPENING_STOCK_TARGET_INR = 300000;

export const HOUSE_OF_AJANTHA_CATEGORIES = new Set([
  "Door Closer & Floor Spring",
  "Kitchen Basket",
]);

export function getProductSku(product: Pick<ProductItem, "code" | "id">): string {
  return product.code || product.id.toUpperCase();
}

export function formatInr(amount: number | null | undefined): string {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return "Quote on request";
  }
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function isFloorSpringProduct(
  product: Pick<ProductItem, "code" | "id" | "name" | "category" | "sellerRoute">
): boolean {
  if (product.sellerRoute === "ENQUIRY_ONLY") return true;
  const sku = getProductSku(product).toUpperCase();
  const name = (product.name || "").toLowerCase();
  return (
    product.category === "Door Closer & Floor Spring" &&
    (sku.includes("-FS-") || name.includes("floor spring") || name.includes("floor-spring"))
  );
}

export function isDistributorBuyStockEligible(product: ProductItem): boolean {
  if (!HOUSE_OF_AJANTHA_CATEGORIES.has(product.category)) return false;
  if (isFloorSpringProduct(product)) return false;
  return true;
}

export function getApprovalStatusMeta(status?: string | null): FormattedStatus {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "APPROVED":
    case "ACTIVE":
      return { label: "Approved", tone: "success" };
    case "PENDING_APPROVAL":
      return { label: "Pending Approval", tone: "warning" };
    case "REJECTED":
      return { label: "Not Approved", tone: "danger" };
    case "SUSPENDED":
      return { label: "Suspended", tone: "danger" };
    case "DEACTIVATED":
      return { label: "Inactive", tone: "neutral" };
    default:
      return { label: status ? status.replace(/_/g, " ") : "Active", tone: "info" };
  }
}

export function getOrderStatusMeta(status?: string | null): FormattedStatus {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "DELIVERED":
    case "COMPLETED":
    case "PAID":
      return { label: formatReadableEnum(normalized), tone: "success" };
    case "DISPATCHED":
    case "IN_TRANSIT":
    case "PROCESSING":
    case "CONFIRMED_TRADE_PO":
    case "CONFIRMED":
      return { label: formatReadableEnum(normalized), tone: "info" };
    case "QUOTE_REQUESTED":
    case "PENDING_APPROVAL":
    case "PENDING_OFFLINE_SETTLEMENT":
    case "AWAITING_PAYMENT":
      return { label: formatReadableEnum(normalized), tone: "warning" };
    case "CANCELLED":
    case "REJECTED":
    case "FAILED":
      return { label: formatReadableEnum(normalized), tone: "danger" };
    default:
      return { label: formatReadableEnum(normalized || "PENDING"), tone: "neutral" };
  }
}

export function formatReadableEnum(value: string): string {
  const special: Record<string, string> = {
    CONFIRMED_TRADE_PO: "Trade PO Confirmed",
    PENDING_OFFLINE_SETTLEMENT: "Offline Settlement Pending",
    QUOTE_REQUESTED: "Quotation Requested",
    PENDING_APPROVAL: "Pending Approval",
    IN_TRANSIT: "In Transit",
    AWAITING_PAYMENT: "Awaiting Payment",
    NOT_APPLICABLE: "Not Applicable",
  };
  if (special[value]) return special[value];
  return value
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function filterDealerCatalog(
  products: ProductItem[],
  opts: {
    query: string;
    category: string;
    routeFilter: "ALL" | "DIRECT" | "HOUSE_OF_AJANTHA" | "ENQUIRY_ONLY";
  }
): ProductItem[] {
  const q = opts.query.trim().toLowerCase();
  return products.filter((p) => {
    if (opts.category && opts.category !== "ALL" && p.category !== opts.category) {
      return false;
    }
    const floorSpring = isFloorSpringProduct(p);
    const houseOfAjantha = HOUSE_OF_AJANTHA_CATEGORIES.has(p.category) && !floorSpring;

    if (opts.routeFilter === "ENQUIRY_ONLY" && !floorSpring) return false;
    if (opts.routeFilter === "HOUSE_OF_AJANTHA" && !houseOfAjantha) return false;
    if (opts.routeFilter === "DIRECT" && (floorSpring || houseOfAjantha)) return false;

    if (!q) return true;
    const sku = getProductSku(p).toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      sku.includes(q) ||
      p.category.toLowerCase().includes(q) ||
      (p.subcategory || "").toLowerCase().includes(q)
    );
  });
}

export function filterDistributorBuyStockCatalog(
  products: ProductItem[],
  opts: {
    query: string;
    category: "ALL" | "Door Closer & Floor Spring" | "Kitchen Basket";
  }
): ProductItem[] {
  const q = opts.query.trim().toLowerCase();
  return products.filter((p) => {
    if (!isDistributorBuyStockEligible(p)) return false;
    if (opts.category !== "ALL" && p.category !== opts.category) return false;
    if (!q) return true;
    const sku = getProductSku(p).toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      sku.includes(q) ||
      (p.subcategory || "").toLowerCase().includes(q)
    );
  });
}

export interface OpeningStockProgress {
  currentInr: number;
  targetInr: number;
  remainingInr: number;
  percent: number;
  meetsThreshold: boolean;
}

export function computeOpeningStockProgress(
  currentInr: number,
  targetInr: number = OPENING_STOCK_TARGET_INR
): OpeningStockProgress {
  const safeCurrent = Number.isFinite(currentInr) && currentInr > 0 ? currentInr : 0;
  const safeTarget = Number.isFinite(targetInr) && targetInr > 0 ? targetInr : OPENING_STOCK_TARGET_INR;
  const remainingInr = Math.max(0, safeTarget - safeCurrent);
  const percent = Math.min(100, Math.round((safeCurrent / safeTarget) * 100));
  return {
    currentInr: safeCurrent,
    targetInr: safeTarget,
    remainingInr,
    percent,
    meetsThreshold: safeCurrent >= safeTarget,
  };
}

export interface OrderSummaryMetrics {
  totalCount: number;
  activeCount: number;
  quoteCount: number;
  deliveredCount: number;
  totalValueInr: number;
}

export function summarizeOrders(orders: PortalOrderRecord[]): OrderSummaryMetrics {
  let activeCount = 0;
  let quoteCount = 0;
  let deliveredCount = 0;
  let totalValueInr = 0;

  for (const order of orders) {
    const status = (order.status || "").toUpperCase();
    if (status === "QUOTE_REQUESTED") {
      quoteCount += 1;
    } else if (status === "DELIVERED" || status === "COMPLETED") {
      deliveredCount += 1;
    } else if (status !== "CANCELLED" && status !== "REJECTED") {
      activeCount += 1;
    }
    if (
      status !== "CANCELLED" &&
      typeof order.total_inr === "number" &&
      Number.isFinite(order.total_inr)
    ) {
      totalValueInr += order.total_inr;
    }
  }

  return {
    totalCount: orders.length,
    activeCount,
    quoteCount,
    deliveredCount,
    totalValueInr,
  };
}

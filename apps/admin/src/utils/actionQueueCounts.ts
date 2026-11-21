import type {
  PortalResponseDto,
  StaffPermission,
  TradeQuoteDto,
} from "../api/adminClient";

export interface ActionQueueMetrics {
  orderActions: number;
  dispatchQueue: number;
  openQuotes: number;
  openEnquiries: number;
  activeReturns: number;
  unapprovedProducts: number;
  pendingDealers: number;
  pendingDistributors: number;
  pendingPartnersCount: number;
  lowStockSkus: number;
  pendingBankProofs: number;
}

export interface SidebarCountBadge {
  count: number;
  tone: "muted" | "teal" | "warning" | "error";
  label: string;
}

export function computeActionQueueMetrics(
  portal?: PortalResponseDto | null,
  quotes?: TradeQuoteDto[] | null
): ActionQueueMetrics {
  const orders = portal?.orders || [];
  const products = portal?.products || [];
  const users = portal?.users || [];
  const enquiries = portal?.enquiries || [];
  const quoteList = quotes || [];

  const dispatchQueue = orders.filter((o) =>
    ["CONFIRMED", "CONFIRMED_TRADE_PO", "PROCESSING", "PACKED"].includes(o.status)
  ).length;

  const openQuotes = quoteList.filter(
    (q) => q.status === "DRAFT" || q.status === "REVIEWED"
  ).length;

  const openEnquiries = enquiries.filter(
    (e) => e.status === "NEW" || e.status === "IN_REVIEW"
  ).length;

  const activeReturns = orders.filter((o) => {
    const rStat = ((o as any).return_status as string) || "NONE";
    const cStat = ((o as any).damage_claim_status as string) || "NONE";
    return rStat !== "NONE" || cStat !== "NONE";
  }).length;

  const unapprovedProducts = products.filter((p) => p.cms_status === "DRAFT" || p.cms_status === "REVIEW").length;

  const pendingDealers = users.filter(
    (u) => u.role === "DEALER" && u.approval_status === "PENDING_APPROVAL"
  ).length;

  const pendingDistributors = users.filter(
    (u) => u.role === "DISTRIBUTOR" && u.approval_status === "PENDING_APPROVAL"
  ).length;

  const lowStockSkus = products.filter((p) => p.stock_qty > 0 && p.stock_qty <= 10).length;

  const pendingBankProofs = orders.filter((o) =>
    ["AWAITING_FINANCE_APPROVAL", "UTR_SUBMITTED"].includes(o.payment_status) ||
    o.status === "AWAITING_FINANCE_APPROVAL"
  ).length;

  return {
    orderActions: orders.filter(o => ["CONFIRMED", "CONFIRMED_TRADE_PO", "PROCESSING", "PACKED"].includes(o.status) ||
      ["AWAITING_FINANCE_APPROVAL", "UTR_SUBMITTED"].includes(o.payment_status) || o.status === "AWAITING_FINANCE_APPROVAL").length,
    dispatchQueue,
    openQuotes,
    openEnquiries,
    activeReturns,
    unapprovedProducts,
    pendingDealers,
    pendingDistributors,
    pendingPartnersCount: pendingDealers + pendingDistributors,
    lowStockSkus,
    pendingBankProofs,
  };
}

export function getTotalActionQueueCount(
  metrics: ActionQueueMetrics,
  hasPermission: (perm?: StaffPermission) => boolean
): number {
  let total = 0;
  if (hasPermission("ORDERS_MANAGE")) {
    total += metrics.dispatchQueue + metrics.activeReturns + metrics.pendingBankProofs;
  }
  if (hasPermission("ENQUIRIES_MANAGE")) {
    total += metrics.openEnquiries + metrics.openQuotes;
  }
  if (hasPermission("CUSTOMERS_MANAGE")) {
    total += metrics.pendingPartnersCount;
  }
  if (hasPermission("CATALOG_MANAGE")) {
    total += metrics.lowStockSkus + metrics.unapprovedProducts;
  }
  return total;
}

export function getSidebarActionBadge(
  path: string,
  metrics: ActionQueueMetrics,
): SidebarCountBadge | null {
  switch (path) {
    case "/orders": {
      const sum = metrics.orderActions;
      return {
        count: sum,
        tone: metrics.pendingBankProofs > 0 ? "warning" : sum > 0 ? "teal" : "muted",
        label: metrics.pendingBankProofs > 0 ? "orders needing dispatch or payment verification" : "orders to dispatch",
      };
    }
    case "/quotes":
      return {
        count: metrics.openQuotes,
        tone: metrics.openQuotes > 0 ? "warning" : "muted",
        label: "open quotes",
      };
    case "/enquiries":
      return {
        count: metrics.openEnquiries,
        tone: metrics.openEnquiries > 0 ? "teal" : "muted",
        label: "open enquiries",
      };
    case "/returns":
      return {
        count: metrics.activeReturns,
        tone: metrics.activeReturns > 0 ? "warning" : "muted",
        label: "orders with return or damage records",
      };
    case "/products":
      return {
        count: metrics.unapprovedProducts,
        tone: metrics.unapprovedProducts > 0 ? "warning" : "muted",
        label: "SKUs needing review",
      };
    case "/dealers":
      return {
        count: metrics.pendingDealers,
        tone: metrics.pendingDealers > 0 ? "warning" : "muted",
        label: "dealer approvals pending",
      };
    case "/distributors":
      return {
        count: metrics.pendingDistributors,
        tone: metrics.pendingDistributors > 0 ? "warning" : "muted",
        label: "distributor approvals pending",
      };
    case "/inventory":
      return {
        count: metrics.lowStockSkus,
        tone: metrics.lowStockSkus > 0 ? "error" : "muted",
        label: "low stock alerts",
      };
    default:
      return null;
  }
}

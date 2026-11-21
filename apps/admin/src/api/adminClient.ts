import type { ProductItem } from "../types";

export const BACKEND_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_MEDUSA_BACKEND_URL) ||
  "";

const TOKEN_STORAGE_KEY = "sai_ajanta_admin_token";
const USER_STORAGE_KEY = "sai_ajanta_admin_user";

export type StaffPermission =
  | "CUSTOMERS_MANAGE"
  | "ORDERS_MANAGE"
  | "CATALOG_MANAGE"
  | "ANALYTICS_VIEW"
  | "ENQUIRIES_MANAGE"
  | "SETTINGS_MANAGE";

export interface StaffProfile {
  id?: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
  permissions: StaffPermission[];
  isFullAdmin: boolean;
}

export class AdminApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "AdminApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getStoredAdminToken(): string | null {
  try {
    return (
      sessionStorage.getItem(TOKEN_STORAGE_KEY) ||
      localStorage.getItem(TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

export function setStoredAdminToken(token: string | null, remember = true): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      if (remember) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getStoredStaffProfile(): StaffProfile | null {
  try {
    const raw =
      sessionStorage.getItem(USER_STORAGE_KEY) ||
      localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StaffProfile>;
    if (!parsed.email) return null;
    return {
      id: parsed.id,
      email: parsed.email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      role: parsed.role || "admin",
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
      isFullAdmin:
        parsed.isFullAdmin !== undefined
          ? Boolean(parsed.isFullAdmin)
          : (parsed.role || "admin") === "admin" ||
            (parsed.role || "") === "super_admin",
    };
  } catch {
    return null;
  }
}

export function setStoredStaffProfile(profile: StaffProfile | null): void {
  try {
    if (profile) {
      const json = JSON.stringify(profile);
      sessionStorage.setItem(USER_STORAGE_KEY, json);
      localStorage.setItem(USER_STORAGE_KEY, json);
    } else {
      sessionStorage.removeItem(USER_STORAGE_KEY);
      localStorage.removeItem(USER_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export async function adminFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredAdminToken();
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${BACKEND_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (res.status === 401) {
    setStoredAdminToken(null);
    setStoredStaffProfile(null);
    window.dispatchEvent(new CustomEvent("admin:unauthorized"));
    throw new AdminApiError("Staff administrator session expired. Please sign in again.", 401, "UNAUTHORIZED");
  }

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const errObj = (parsed && typeof parsed === "object" ? parsed : {}) as {
      message?: string;
      code?: string;
      details?: unknown;
    };
    throw new AdminApiError(
      errObj.message || `Request failed with HTTP ${res.status}`,
      res.status,
      errObj.code,
      errObj.details
    );
  }

  return parsed as T;
}

export async function fetchCurrentStaffProfile(fallbackEmail: string): Promise<StaffProfile> {
  try {
    const res = await adminFetch<{
      staff?: StaffProfile;
    }>("/admin/sai-ajanta/me");

    if (res.staff && res.staff.email) {
      const profile: StaffProfile = {
        id: res.staff.id,
        email: res.staff.email || fallbackEmail,
        firstName: res.staff.firstName ?? null,
        lastName: res.staff.lastName ?? null,
        role: res.staff.role || "staff",
        permissions: Array.isArray(res.staff.permissions) ? res.staff.permissions : [],
        isFullAdmin: Boolean(res.staff.isFullAdmin),
      };
      setStoredStaffProfile(profile);
      return profile;
    }
    throw new Error("Missing staff profile payload");
  } catch (err) {
    if (err instanceof AdminApiError && (err.status === 401 || err.status === 403)) {
      throw err;
    }
    // Fail-closed: never elevate privileges to full admin if /admin/sai-ajanta/me fails
    const restricted: StaffProfile = {
      email: fallbackEmail,
      role: "restricted",
      permissions: [],
      isFullAdmin: false,
    };
    setStoredStaffProfile(restricted);
    return restricted;
  }
}

export async function loginStaff(
  email: string,
  password: string,
  remember = true
): Promise<StaffProfile> {
  const res = await fetch(`${BACKEND_BASE_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const text = await res.text();
  let parsed: { token?: string; message?: string } = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = {};
  }

  if (!res.ok) {
    throw new AdminApiError(
      parsed.message || "Invalid staff administrator email or password.",
      res.status
    );
  }

  if (!parsed.token) {
    throw new AdminApiError("Authentication succeeded but no token was issued.", 500);
  }

  setStoredAdminToken(parsed.token, remember);
  return await fetchCurrentStaffProfile(email.trim());
}

export function logoutStaff(): void {
  setStoredAdminToken(null);
  setStoredStaffProfile(null);
  window.dispatchEvent(new CustomEvent("admin:logout"));
}

/* ==================== BACKEND PORTAL & OVERVIEW DTOs ==================== */

export interface PortalUserRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  gstin: string | null;
  business_city: string | null;
  role: "CUSTOMER" | "DEALER" | "DISTRIBUTOR";
  approval_status: "APPROVED" | "PENDING_APPROVAL" | "REJECTED" | "SUSPENDED";
  rejection_reason: string | null;
  created_at: string;
}

export interface PortalProductRow {
  id: string;
  medusa_id: string;
  sku: string;
  name: string;
  title?: string;
  category: string;
  subcategory: string | null;
  brand?: string;
  size?: string;
  material?: string;
  description?: string;
  src: string;
  thumbnail?: string;
  customer_price_inr: number | null;
  contractor_price_inr?: number | null;
  dealer_price_inr: number | null;
  distributor_price_inr: number | null;
  billing_unit: string;
  stock_qty: number;
  seller_route?: string;
  cms_status?: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
  headline_need?: string;
  highlights?: string[];
  benefits?: string[];
  internal_notes?: string;
  spec_fields?: Record<string, string>;
  metadata?: Record<string, unknown>;
  is_manufactured?: boolean;
  approved: number;
  active: number;
}

export interface PortalOrderRow {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  organization?: string;
  price_tier_applied?: string;
  shipping_address?: string;
  subtotal_inr?: number;
  gst_inr?: number;
  total_inr: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  bank_reference?: string | null;
  refund_status?: string;
  shipping_carrier?: string | null;
  tracking_reference?: string | null;
  routing_status?: string;
  assigned_distributor_id?: string | null;
  assigned_distributor_name?: string | null;
  assigned_dealer_id?: string | null;
  assigned_dealer_name?: string | null;
  is_manufactured?: boolean;
  items_summary?: string;
  items?: {
    product_id: string;
    sku: string;
    name: string;
    quantity: number;
    unit_price_inr: number | null;
    line_total_inr: number | null;
    seller_name?: string;
  }[];
  events?: {
    id: string;
    status: string;
    note: string;
    actor_name?: string;
    created_at: string;
  }[];
  created_at: string;
}

export interface PortalPaymentRow {
  id: string;
  order_id: string;
  order_number?: string;
  customer_name?: string;
  provider_order_id?: string;
  provider_payment_id?: string;
  amount_paise: number;
  signature_verified: boolean;
  status: string;
  created_at: string;
}

export interface PortalEnquiryRow {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  phone: string;
  email: string;
  city?: string;
  postal_code?: string;
  division: string;
  notes?: string;
  source: string;
  status:
    | "NEW"
    | "IN_REVIEW"
    | "AWAITING_CUSTOMER_DETAILS"
    | "AWAITING_SELLER"
    | "QUOTE_PREPARING"
    | "QUOTED"
    | "QUOTE_ACCEPTED"
    | "CONVERTED_TO_ORDER"
    | "CLOSED";
  lead_type?: "PRODUCT_QUOTE" | "INSTALLATION";
  items?: { sku: string; name: string; quantity: number; size?: string; unit?: string; notes?: string }[] | null;
  attachments?: any[] | null;
  assigned_seller_id?: string | null;
  assigned_seller_name?: string | null;
  assigned_seller_type?: string | null;
  assigned_staff_id?: string | null;
  assigned_staff_email?: string | null;
  follow_up_date?: string | null;
  closure_reason?: string | null;
  contractor_id?: string | null;
  contractor_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnquiryActivityDto {
  id: string;
  enquiry_id: string;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  actor_id?: string | null;
  actor_email?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export interface EnquiryDetailResponseDto {
  enquiry: PortalEnquiryRow;
  quotes: TradeQuoteDto[];
  activity: EnquiryActivityDto[];
  recommendedSeller?: {
    sellerId: string | null;
    sellerName: string | null;
    sellerType: string | null;
    route: string;
    authorizedSellerExists: boolean;
    reason: string;
  } | null;
  availableStaff: { id: string; email: string; first_name?: string | null; last_name?: string | null }[];
  contractors: { id: string; name: string; role: string; territory?: string | null; status: string }[];
  distributors: { id: string; name: string; role: string; territory?: string | null; status: string }[];
}

export interface PortalResponseDto {
  users: PortalUserRow[];
  products: PortalProductRow[];
  orders: PortalOrderRow[];
  payments: PortalPaymentRow[];
  enquiries: PortalEnquiryRow[];
  reports: {
    totalUsers: number;
    pendingApplications: number;
    totalProducts: number;
    lowStockProducts: number;
    totalOrders: number;
    paidOrders: number;
    paidRevenueInr: number;
    totalEnquiries: number;
  };
}

export interface OverviewResponseDto {
  products: {
    id: string;
    legacyId: string;
    sku: string;
    title: string;
    category: string;
    brand: string;
    size: string;
    thumbnail: string | null;
    customerPriceInr: number | null;
    dealerPriceInr: number | null;
    distributorPriceInr: number | null;
    billingUnit: string;
    gstRate: number;
    stockQty: number;
    approved: boolean;
    active: boolean;
  }[];
  categories: { id: string; name: string; handle: string }[];
  stockLocations: { id: string; name: string }[];
}

export interface AnalyticsResponseDto {
  kpis: {
    pending: number;
    delivered: number;
    shipped: number;
    invoiced: number;
    cancelled: number;
    totalVolumeInr: number;
    totalOrders: number;
  };
  credit: {
    totalSanctionedInr: number | null;
    totalUtilizedInr: number | null;
    utilizationRatio: number | null;
    utilizationRatioDisplay?: string;
    statusNotice?: string;
    creditedDistributorsCount: number;
    distributors: {
      id: string;
      name: string;
      companyName: string;
      territory: string;
      creditLimit: number | null;
      creditLimitDisplay?: string;
      creditUsed: number | null;
      creditUsedDisplay?: string;
      ordersCount: number;
      totalVolumeInr: number;
      status: string;
    }[];
  };
  financialYear: {
    selectedFY: string;
    totalEarningsInr: number;
    yoy: string;
    months: {
      key: string;
      name: string;
      mNum: number;
      totalAmount: number;
      ordersCount: number;
    }[];
  };
  channelMetrics: {
    distVol: number;
    dealerVol: number;
    customerVol: number;
    distPct: number;
    dealerPct: number;
    customerPct: number;
    trends: {
      key: string;
      label: string;
      distCount: number;
      dealerCount: number;
      custCount: number;
    }[];
  };
  fulfillmentVelocity: {
    totalCount: number;
    deliveredClean: number;
    deliveredCleanRate: number;
    damagedCount: number;
    damageRate: string;
    returnedCount: number;
    returnRate: string;
    failedShipmentsCount: number;
    failureRate: string;
    cancelledCount: number;
    cancelRate: string;
    deliveryOrders: number;
    pickupOrders: number;
    deliveryPercent: number;
    pickupPercent: number;
  };
  topProductsDemand: {
    id: string;
    sku: string;
    title: string;
    category: string;
    totalUnits: number;
    dealerUnits: number;
    customerUnits: number;
    totalRevenue: number;
    dealerSharePercent: number;
    customerSharePercent: number;
    orderCount: number;
  }[];
}

export const adminClient = {
  fetchPortal: (signal?: AbortSignal) =>
    adminFetch<PortalResponseDto>("/admin/sai-ajanta/portal", { signal }),

  fetchOverview: (signal?: AbortSignal) =>
    adminFetch<OverviewResponseDto>("/admin/sai-ajanta/overview", { signal }),

  fetchAnalytics: (
    params: { fy?: string; onlySaiAjantaLogistics?: boolean; countPaidDistributorBulk?: boolean } = {},
    signal?: AbortSignal
  ) => {
    const qs = new URLSearchParams();
    if (params.fy) qs.set("fy", params.fy);
    if (params.onlySaiAjantaLogistics !== undefined) {
      qs.set("onlySaiAjantaLogistics", String(params.onlySaiAjantaLogistics));
    }
    if (params.countPaidDistributorBulk !== undefined) {
      qs.set("countPaidDistributorBulk", String(params.countPaidDistributorBulk));
    }
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return adminFetch<AnalyticsResponseDto>(`/admin/sai-ajanta/analytics${query}`, { signal });
  },

  createProduct: (p: {
    sku: string;
    name: string;
    category: string;
    subcategory?: string;
    brand?: string;
    size?: string;
    material?: string;
    description?: string;
    src?: string;
    customerPriceInr: number | null;
    dealerPriceInr: number | null;
    distributorPriceInr: number | null;
    billingUnit: string;
    gstRate: number;
    stockQty: number;
    isManufactured: boolean;
    approved?: boolean;
    cmsStatus?: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
    headlineNeed?: string;
    highlights?: string[];
    benefits?: string[];
    internalNotes?: string;
    specFields?: Record<string, string>;
  }) =>
    adminFetch<{ success?: boolean; product?: unknown }>("/admin/sai-ajanta/products", {
      method: "POST",
      body: JSON.stringify(p),
    }),

  createProductBatch: (products: ProductItem[]) =>
    adminFetch<{
      success: boolean;
      count: number;
      errors?: { sku: string; message: string }[];
    }>("/admin/sai-ajanta/products", {
      method: "POST",
      body: JSON.stringify({
        products: products.map((p) => ({
          sku: p.sku,
          name: p.title,
          category: p.category,
          subcategory: p.subcategory,
          brand: p.brand,
          size: p.size,
          material: p.material,
          description: p.description,
          src: p.thumbnail,
          customerPriceInr: p.customerPriceInr > 0 ? p.customerPriceInr : null,
          dealerPriceInr: p.dealerPriceInr > 0 ? p.dealerPriceInr : null,
          distributorPriceInr: p.distributorPriceInr > 0 ? p.distributorPriceInr : null,
          billingUnit: p.unit,
          gstRate: p.gstRate,
          stockQty: p.stockQty,
          isManufactured: p.isManufactured,
          cmsStatus: p.cmsStatus,
          approved: p.cmsStatus === "APPROVED" || p.cmsStatus === "PUBLISHED",
        })),
      }),
    }),

  stageProductImport: (payload: {
    intentId?: string;
    fileName?: string;
    fileContentBase64?: string;
    fileContentText?: string;
  }) =>
    adminFetch<{
      jobId: string;
      intentId: string;
      fileName: string;
      status: string;
      totalRows: number;
      candidateRows: number;
      excludedSamples: number;
      invalidRows: number;
      stagedRows: number;
      rows: any[];
    }>("/admin/sai-ajanta/products/import/stage", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  publishProductImport: (jobId: string) =>
    adminFetch<{
      jobId: string;
      status: string;
      publishedCount: number;
      failedCount: number;
      committedSkus: string[];
      errors: { sku: string; error: string }[];
    }>(`/admin/sai-ajanta/products/import/jobs/${jobId}/publish`, {
      method: "POST",
    }),

  updateProduct: (
    productId: string,
    payload: {
      name?: string;
      description?: string;
      brand?: string;
      size?: string;
      material?: string;
      src?: string;
      customerPriceInr?: number | null;
      dealerPriceInr?: number | null;
      distributorPriceInr?: number | null;
      stockQty?: number;
      approved?: boolean;
      active?: boolean;
      cmsStatus?: "DRAFT" | "REVIEW" | "APPROVED" | "PUBLISHED";
      headlineNeed?: string | null;
      highlights?: string[];
      benefits?: string[];
      internalNotes?: string | null;
      specFields?: Record<string, string>;
    }
  ) =>
    adminFetch<{ ok?: boolean; product?: unknown }>(
      `/admin/sai-ajanta/products/${encodeURIComponent(productId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  fetchProductDetail: (productId: string, signal?: AbortSignal) =>
    adminFetch<{ product: PortalProductRow }>(
      `/admin/sai-ajanta/products/${encodeURIComponent(productId)}`,
      { signal }
    ),

  fetchOrderDetail: (orderId: string, signal?: AbortSignal) =>
    adminFetch<{ order: PortalOrderRow }>(
      `/admin/sai-ajanta/orders/${encodeURIComponent(orderId)}`,
      { signal }
    ),

  updateOrder: (
    orderId: string,
    payload: {
      action?: "CANCEL";
      reason?: string;
      status?: string;
      shippingCarrier?: string | null;
      trackingReference?: string | null;
      eventNote?: string;
      actorName?: string;
      routingStatus?: string;
      assignedDistributorId?: string | null;
      assignedDistributorName?: string | null;
      assignedDealerId?: string | null;
      assignedDealerName?: string | null;
    }
  ) =>
    adminFetch<{ ok: boolean; order?: PortalOrderRow }>(
      `/admin/sai-ajanta/orders/${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  transitionOrder: (
    orderId: string,
    payload: {
      command:
        | "MARK_CONFIRMED"
        | "PACK_ORDER"
        | "DISPATCH_ORDER"
        | "MARK_DELIVERED"
        | "VERIFY_BANK_PAYMENT"
        | "REJECT_BANK_PAYMENT"
        | "RECORD_PAYMENT_EXCEPTION"
        | "CANCEL_ORDER";
      notes?: string;
      carrierName?: string;
      trackingNumber?: string;
      bankReference?: string;
      verifiedAmountPaise?: number;
      cancellationReason?: string;
    }
  ) =>
    adminFetch<{ transition: any }>(
      `/admin/sai-ajanta/orders/${encodeURIComponent(orderId)}/transition`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  fetchOrderDocuments: (orderId: string, signal?: AbortSignal) =>
    adminFetch<{ documents: any[] }>(
      `/admin/sai-ajanta/orders/${encodeURIComponent(orderId)}/documents`,
      { signal }
    ),

  generateOrderDocument: (
    orderId: string,
    payload: {
      docType: "PROFORMA" | "DRAFT_INVOICE" | "DRAFT_CREDIT_NOTE";
      issuerLegalName?: string;
      issuerGstin?: string | null;
      buyerStateCode?: string;
    }
  ) =>
    adminFetch<{ document: any }>(
      `/admin/sai-ajanta/orders/${encodeURIComponent(orderId)}/documents`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  inspectOrderReturn: (
    returnId: string,
    payload: {
      inspectedQtyAccepted: number;
      inspectedQtyScrapped: number;
      notes?: string;
    }
  ) =>
    adminFetch<{ inspection: any }>(
      `/admin/sai-ajanta/orders/returns/${encodeURIComponent(returnId)}/inspect`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  createCustomerAccount: (payload: {
    name: string;
    company_name?: string;
    business_name?: string;
    gstin?: string;
    gst_number?: string;
    phone: string;
    email: string;
    territory?: string;
    city?: string;
    role: "CUSTOMER" | "DEALER" | "DISTRIBUTOR";
    status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
    credit_limit?: number;
  }) =>
    adminFetch<{ customer: unknown }>("/admin/sai-ajanta/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateCustomerProfile: (
    customerId: string,
    payload: {
      status?: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED" | "REJECTED";
      role?: "CUSTOMER" | "DEALER" | "DISTRIBUTOR";
      rejection_reason?: string | null;
      parent_distributor_id?: string | null;
    }
  ) =>
    adminFetch<{ customer_id: string; profile: unknown }>(
      `/admin/sai-ajanta/customers/${encodeURIComponent(customerId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  updateEnquiryStatus: (
    enquiryId: string,
    status: PortalEnquiryRow["status"]
  ) =>
    adminFetch<{ ok: boolean; status: string }>(
      `/admin/sai-ajanta/enquiries/${encodeURIComponent(enquiryId)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    ),

  fetchEnquiryDetail: (enquiryId: string, signal?: AbortSignal) =>
    adminFetch<EnquiryDetailResponseDto>(
      `/admin/sai-ajanta/enquiries/${encodeURIComponent(enquiryId)}`,
      { signal }
    ),

  executeEnquiryAction: (
    enquiryId: string,
    payload: {
      action?: string;
      status?: string;
      notes?: string;
      message?: string;
      closure_reason?: string;
      seller_id?: string;
      seller_name?: string;
      seller_type?: string;
      staff_id?: string;
      staff_email?: string;
      follow_up_date?: string;
      contractor_id?: string;
      contractor_name?: string;
    }
  ) =>
    adminFetch<{ ok: boolean; message: string; enquiry: PortalEnquiryRow }>(
      `/admin/sai-ajanta/enquiries/${encodeURIComponent(enquiryId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  convertQuoteToOrder: (quoteId: string) =>
    adminFetch<{ ok: boolean; message: string; orderId: string; orderNumber: string }>(
      `/admin/sai-ajanta/quotes/${encodeURIComponent(quoteId)}/convert`,
      {
        method: "POST",
      }
    ),

  fetchEnquiries: (params?: { status?: string; lead_type?: string; role?: string; seller?: string; staff?: string; q?: string }, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.lead_type) qs.set("lead_type", params.lead_type);
    if (params?.role) qs.set("role", params.role);
    if (params?.seller) qs.set("seller", params.seller);
    if (params?.staff) qs.set("staff", params.staff);
    if (params?.q) qs.set("q", params.q);
    const queryStr = qs.toString() ? `?${qs.toString()}` : "";
    return adminFetch<{ enquiries: PortalEnquiryRow[]; count: number; counts: any }>(
      `/admin/sai-ajanta/enquiries${queryStr}`,
      { signal }
    );
  },

  syncNasMedia: () =>
    adminFetch<{ ok?: boolean; message?: string; syncedCount?: number }>(
      "/admin/sai-ajanta/sync-nas",
      { method: "POST" }
    ),

  fetchAuditLogs: (
    params: {
      page?: number;
      pageSize?: number;
      action?: string;
      actor?: string;
      outcome?: string;
      resource?: string;
    } = {},
    signal?: AbortSignal
  ) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("pageSize", String(params.pageSize));
    if (params.action) qs.set("action", params.action);
    if (params.actor) qs.set("actor", params.actor);
    if (params.outcome && params.outcome !== "ALL") qs.set("outcome", params.outcome);
    if (params.resource) qs.set("resource", params.resource);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return adminFetch<AuditLogResponseDto>(`/admin/sai-ajanta/audit-log${query}`, { signal });
  },

  fetchStaffUsers: (signal?: AbortSignal) =>
    adminFetch<StaffDirectoryResponseDto>("/admin/sai-ajanta/staff", { signal }),

  createStaffUser: (payload: {
    email: string;
    first_name: string;
    last_name?: string;
    password: string;
    permissions: string[];
  }) =>
    adminFetch<{ staff: StaffDirectoryRow }>("/admin/sai-ajanta/staff", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateStaffUser: (
    staffId: string,
    payload: {
      first_name?: string;
      last_name?: string;
      active?: boolean;
      permissions?: string[];
    }
  ) =>
    adminFetch<{ staff: StaffDirectoryRow }>(`/admin/sai-ajanta/staff/${encodeURIComponent(staffId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  fetchAdminSettings: (signal?: AbortSignal) =>
    adminFetch<AdminSettingsResponseDto>("/admin/sai-ajanta/settings", { signal }),

  updateAdminSettings: (payload: {
    display_locale?: "en-IN" | "en-US";
    timezone?: "Asia/Kolkata" | "UTC";
    default_page_size?: number;
    enquiry_alert_email_enabled?: boolean;
    order_dispatch_alert_enabled?: boolean;
    low_stock_threshold?: number;
    expectedVersion?: number;
  }) =>
    adminFetch<AdminSettingsResponseDto>("/admin/sai-ajanta/settings", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),

  fetchSellerCoverage: (params: { pin?: string; category?: string } = {}, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (params.pin) qs.set("pin", params.pin);
    if (params.category) qs.set("category", params.category);
    const query = qs.toString() ? `?${qs.toString()}` : "";
    return adminFetch<SellerCoverageResponseDto>(`/admin/sai-ajanta/seller-coverage${query}`, {
      signal,
    });
  },

  createSellerCoverage: (payload: {
    distributorId: string;
    postalCode: string;
    categorySlug?: string;
    categoryName?: string;
    notes?: string;
  }) =>
    adminFetch<{ id: string; message: string; hasOverlap?: boolean }>("/admin/sai-ajanta/seller-coverage", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  patchSellerCoverage: (payload: {
    coverageId: string;
    status: "ACTIVE" | "REVOKED" | "SUSPENDED";
    notes?: string;
  }) =>
    adminFetch<{ success: boolean; coverage: any }>("/admin/sai-ajanta/seller-coverage", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  linkDealerToDistributor: (payload: {
    dealerId: string;
    parentDistributorId: string | null;
  }) =>
    adminFetch<{ success: boolean; message: string }>("/admin/sai-ajanta/seller-coverage", {
      method: "POST",
      body: JSON.stringify({ action: "LINK_DEALER", ...payload }),
    }),

  fetchTradeQuotes: (signal?: AbortSignal) =>
    adminFetch<{ quotes: TradeQuoteDto[]; nonpayableNotice: string }>("/admin/sai-ajanta/quotes", {
      signal,
    }),

  createTradeQuote: (payload: {
    enquiry_id?: string | null;
    customer_name: string;
    customer_email?: string;
    organization?: string;
    division: string;
    valid_until?: string | null;
    items: { sku: string; name: string; quantity: number; unitPriceInr: number }[];
    customer_notes?: string;
    internal_notes?: string;
  }) =>
    adminFetch<{ quote: TradeQuoteDto }>("/admin/sai-ajanta/quotes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateTradeQuote: (
    quoteId: string,
    payload: {
      status?: "DRAFT" | "REVIEWED" | "SHARED_NONPAYABLE" | "EXPIRED" | "ARCHIVED";
      valid_until?: string | null;
      customer_notes?: string;
      internal_notes?: string;
      revision_note?: string;
      items?: { sku: string; name: string; quantity: number; unitPriceInr: number }[];
    }
  ) =>
    adminFetch<{ quote: TradeQuoteDto }>(`/admin/sai-ajanta/quotes/${encodeURIComponent(quoteId)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  fetchInventoryLedger: (signal?: AbortSignal) =>
    adminFetch<InventoryLedgerResponseDto>("/admin/sai-ajanta/inventory/ledger", { signal }),

  updateReturnInspection: (
    orderId: string,
    payload: {
      return_status?: "NONE" | "REQUESTED" | "RETURNED" | "INSPECTED";
      damage_claim_status?: "NONE" | "REPORTED" | "VERIFIED" | "REPLACED";
      damaged_qty?: number;
      damage_notes?: string | null;
    }
  ) =>
    adminFetch<{ order: PortalOrderRow }>(
      `/admin/sai-ajanta/returns/${encodeURIComponent(orderId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    ),

  fetchReturns: (signal?: AbortSignal) =>
    adminFetch<{ returns: PortalOrderRow[]; count: number }>(
      "/admin/sai-ajanta/returns",
      { signal }
    ),

  fetchPromotionDrafts: (signal?: AbortSignal) =>
    adminFetch<{
      promotions: PromoDraftDto[];
      checkoutDiscountingEnabled: boolean;
      policyNotice: string;
    }>("/admin/sai-ajanta/promotions", { signal }),

  createPromotionDraft: (payload: {
    code: string;
    title: string;
    target_tier: "CUSTOMER" | "DEALER" | "DISTRIBUTOR";
    category_scope: string;
    discount_percent: number;
    valid_from?: string | null;
    valid_until?: string | null;
    status?: "DRAFT" | "PENDING_APPROVAL" | "ARCHIVED";
    internal_notes?: string;
  }) =>
    adminFetch<{ promotion: PromoDraftDto; overlapWarning: boolean }>(
      "/admin/sai-ajanta/promotions",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    ),

  // Phase 07 Distributor Lifecycle & Inventory APIs
  fetchDistributorCoverages: (params: { distributorId?: string; status?: string } = {}, signal?: AbortSignal) => {
    const qs = new URLSearchParams();
    if (params.distributorId) qs.set("distributorId", params.distributorId);
    if (params.status) qs.set("status", params.status);
    const q = qs.toString() ? `?${qs.toString()}` : "";
    return adminFetch<{ coverages: any[] }>(`/admin/sai-ajanta/distributors/coverage${q}`, { signal });
  },

  assignDistributorCoverage: (payload: { distributorId: string; postalCode: string; categorySlug: string; notes?: string }) =>
    adminFetch<{ coverage: any }>("/admin/sai-ajanta/distributors/coverage", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  revokeDistributorCoverage: (coverageId: string, reason?: string) =>
    adminFetch<{ success: boolean; message: string }>(`/admin/sai-ajanta/distributors/coverage/${encodeURIComponent(coverageId)}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  fetchDistributorPurchaseOrders: (distributorId?: string, signal?: AbortSignal) => {
    const q = distributorId ? `?distributorId=${encodeURIComponent(distributorId)}` : "";
    return adminFetch<{ purchaseOrders: any[] }>(`/admin/sai-ajanta/distributors/purchase-orders${q}`, { signal });
  },

  createDistributorPurchaseOrder: (payload: {
    distributorId: string;
    destinationLocationId?: string;
    items: { sku: string; qty: number }[];
    notes?: string;
  }) =>
    adminFetch<{ purchaseOrder: any }>("/admin/sai-ajanta/distributors/purchase-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  submitPoPaymentProof: (poId: string, payload: { distributorId: string; utrReference: string }) =>
    adminFetch<{ purchaseOrder: any }>(`/admin/sai-ajanta/distributors/purchase-orders/${encodeURIComponent(poId)}/payment-proof`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  financeApprovePo: (poId: string) =>
    adminFetch<{ purchaseOrder: any }>(`/admin/sai-ajanta/distributors/purchase-orders/${encodeURIComponent(poId)}/finance-approve`, {
      method: "POST",
    }),

  allocateAndDispatchPo: (poId: string, payload: { dispatchReference?: string } = {}) =>
    adminFetch<{ purchaseOrder: any }>(`/admin/sai-ajanta/distributors/purchase-orders/${encodeURIComponent(poId)}/allocate-dispatch`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  recordPoReceipt: (
    poId: string,
    payload: {
      distributorId: string;
      lines: any[];
      inspectionNotes?: string;
      inspectionEvidenceUrls?: string[];
    }
  ) =>
    adminFetch<{ receipt: any; poStatus: string }>(`/admin/sai-ajanta/distributors/purchase-orders/${encodeURIComponent(poId)}/receipt`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  fetchDistributorInventory: (distributorId: string, signal?: AbortSignal) =>
    adminFetch<{ inventory: any[] }>(`/admin/sai-ajanta/distributors/${encodeURIComponent(distributorId)}/inventory`, { signal }),

  fetchDistributorReconciliation: (distributorId: string, signal?: AbortSignal) =>
    adminFetch<{ report: any }>(`/admin/sai-ajanta/distributors/${encodeURIComponent(distributorId)}/reconciliation`, { signal }),

  fetchFinancialSeparationSummary: (signal?: AbortSignal) =>
    adminFetch<{ financialSummary: any }>("/admin/sai-ajanta/distributors/financial-separation", { signal }),
};

export interface StaffDirectoryRow {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  permissions: string[];
  active: boolean;
  is_full_admin: boolean;
  is_self: boolean;
  created_at: string;
}

export interface StaffDirectoryResponseDto {
  staff: StaffDirectoryRow[];
  count: number;
  callerIsFullAdmin: boolean;
  ownerPolicyGate: {
    code: string;
    superAdminCreationLocked: boolean;
    note: string;
  };
}

export interface AdminSettingsDto {
  setting_key: string;
  display_locale: "en-IN" | "en-US";
  timezone: "Asia/Kolkata" | "UTC";
  default_page_size: number;
  enquiry_alert_email_enabled: boolean;
  order_dispatch_alert_enabled: boolean;
  low_stock_threshold: number;
  version: number;
  updated_by_email: string | null;
}

export interface AdminSettingsResponseDto {
  settings: AdminSettingsDto;
  lockedCommercialFlags: Record<string, boolean>;
}

export interface SellerCoverageResponseDto {
  distributors: {
    id: string;
    customer_id: string;
    business_name: string;
    status: string;
    territory_city: string | null;
    structured_pincodes: string[];
    assigned_pins?: string[];
    coverages?: any[];
    coverage_mode: "PIN_STRUCTURED" | "UNSTRUCTURED_CITY_ONLY";
    linked_dealers_count: number;
    stock_location_id: string | null;
  }[];
  stockLocations: { id: string; name: string }[];
  overlappingPins: { pin: string; distributors: string[] }[];
  coverages?: {
    id: string;
    distributor_id: string;
    postal_code: string;
    category_name: string;
    category_slug: string;
    canonical_route: string;
    status: string;
    assigned_by: string;
    notes: string | null;
    created_at: string;
  }[];
  unstructuredCount: number;
  writePolicyLocked: boolean;
  ownerDecisionCode: string;
  simulation: {
    pin: string | null;
    category: string;
    outcome: string;
    seller_route: string;
    autoAssignedSeller: string | null;
    candidates?: string[];
    reason: string;
  } | null;
}

export interface TradeQuoteDto {
  id: string;
  quote_number: string;
  enquiry_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  postal_code?: string;
  organization: string;
  division: string;
  status:
    | "DRAFT"
    | "REVIEWED"
    | "SHARED_NONPAYABLE"
    | "ACCEPTED"
    | "REJECTED"
    | "REVISION_REQUESTED"
    | "CONVERTED_TO_ORDER"
    | "EXPIRED"
    | "ARCHIVED";
  revision: number;
  valid_until: string | null;
  assigned_staff_id?: string | null;
  assigned_staff_email: string | null;
  seller_id?: string | null;
  seller_name?: string | null;
  seller_type?: string | null;
  subtotal_inr: number;
  tax_inr?: number;
  total_inr?: number;
  converted_order_id?: string | null;
  is_service_quote?: boolean;
  contractor_id?: string | null;
  contractor_name?: string | null;
  customer_response?: string | null;
  customer_response_notes?: string | null;
  customer_response_at?: string | null;
  items: { sku: string; name: string; quantity: number; unitPriceInr: number; gstRate?: number }[] | null;
  revisions: {
    revision: number;
    status: string;
    subtotal_inr: number;
    actor_email: string;
    updated_at: string;
    note: string;
  }[] | null;
  customer_notes: string;
  internal_notes: string;
  created_at?: string;
}

export interface InventoryLedgerResponseDto {
  readOnlyPhase03Protected: boolean;
  stockLocations: { id: string; name: string }[];
  reservations: {
    id: string;
    order_id: string;
    sku: string;
    quantity: number;
    status: string;
    seller_id: string;
    location_id: string;
    expires_at: string;
    created_at?: string;
  }[];
  movements: {
    id: string;
    operation_key: string;
    inventory_item_id: string;
    movement_type: string;
    delta_physical: number;
    delta_reserved: number;
    order_id: string | null;
    actor_type: string;
    reason: string | null;
    created_at?: string;
  }[];
  activeHoldsCount: number;
  expiredCount: number;
}

export interface PromoDraftDto {
  id: string;
  code: string;
  title: string;
  target_tier: string;
  category_scope: string;
  discount_percent: number;
  valid_from: string | null;
  valid_until: string | null;
  status: string;
  internal_notes: string;
  created_at?: string;
}

export async function fetchForgotPasswordCapabilities(): Promise<{
  staffEmailResetConfigured: boolean;
  providerState: string;
}> {
  const res = await fetch(`${BACKEND_BASE_URL}/store/sai-ajanta/auth/forgot-password-capabilities`);
  if (!res.ok) return { staffEmailResetConfigured: false, providerState: "BLOCKED_EXTERNAL_PROVIDER" };
  return (await res.json()) as { staffEmailResetConfigured: boolean; providerState: string };
}

export async function requestStaffPasswordReset(email: string): Promise<void> {
  await fetch(`${BACKEND_BASE_URL}/auth/user/emailpass/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email.trim().toLowerCase() }),
  });
}

export async function confirmStaffPasswordReset(
  token: string,
  newPassword: string
): Promise<void> {
  const res = await fetch(`${BACKEND_BASE_URL}/auth/user/emailpass/update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.trim()}`,
    },
    body: JSON.stringify({ password: newPassword }),
  });
  if (!res.ok) {
    throw new AdminApiError(
      "Password reset token is invalid or expired.",
      res.status
    );
  }
}

export interface StaffAuditEventDto {
  id: string;
  actor_id: string;
  actor_email: string | null;
  actor_role: string;
  action: string;
  resource: string;
  outcome: string;
  reason: string | null;
  correlation_id: string | null;
  summary: Record<string, unknown> | null;
  occurred_at: string;
}

export interface AuditLogResponseDto {
  events: StaffAuditEventDto[];
  total: number;
  page: number;
  pageSize: number;
  immutableLedger: boolean;
}

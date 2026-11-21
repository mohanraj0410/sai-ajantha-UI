import "server-only";
import fs from "node:fs";
import path from "node:path";
import { PRODUCT_CATEGORIES, type ProductCategory, type ProductItem } from "@/lib/products";

export interface MedusaCatalogProduct {
  medusaId: string;
  id: string;
  handle: string;
  sku: string;
  name: string;
  description?: string | null;
  category: string;
  subcategory: string | null;
  src: string;
  images: string[];
  customerPriceInr: number | null;
  contractorPriceInr?: number | null;
  dealerPriceInr: number | null;
  distributorPriceInr: number | null;
  billingUnit: string;
  gstRate: number;
  gstMode: string;
  stockQty: number;
  approved: boolean;
  metadata?: Record<string, unknown>;
}

export type MedusaCatalogResult =
  | { ok: true; products: MedusaCatalogProduct[] }
  | { ok: false; error: string; status: number };

interface MedusaPublicConfig {
  backendUrl?: string;
  publishableKey?: string;
}

export function getMedusaBaseUrl(): string {
  return (
    process.env.MEDUSA_BACKEND_URL ||
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
    "http://localhost:9000"
  ).replace(/\/+$/, "");
}

function readDiscoveredPublicConfig(): MedusaPublicConfig | null {
  try {
    const envDir = process.env.NAS_PUBLIC_MEDIA_ROOT || process.env.LOCAL_NAS_DIR;
    const candidates = [
      envDir ? path.resolve(process.cwd(), envDir, "medusa-public-config.json") : null,
      path.resolve(process.cwd(), "..", "..", "..", "local-nas", "medusa-public-config.json"),
      path.resolve(process.cwd(), "..", "..", "local-nas", "medusa-public-config.json"),
      path.resolve(process.cwd(), "..", "local-nas", "medusa-public-config.json"),
      path.resolve(process.cwd(), "local-nas", "medusa-public-config.json"),
    ].filter((p): p is string => Boolean(p));
    for (const configPath of candidates) {
      if (fs.existsSync(/*turbopackIgnore: true*/ configPath)) {
        return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ configPath, "utf8")) as MedusaPublicConfig;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function getMedusaPublishableKey(): string | null {
  const discovered = readDiscoveredPublicConfig();
  if (discovered?.publishableKey?.trim()) {
    return discovered.publishableKey.trim();
  }
  const envKey =
    process.env.MEDUSA_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;
  if (envKey && envKey.trim()) return envKey.trim();
  return null;
}

async function medusaFetchWithStatus<T>(
  routePath: string,
  init: RequestInit = {},
  timeoutMs = 5000
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const baseUrl = getMedusaBaseUrl();
  const publishableKey = getMedusaPublishableKey();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (publishableKey && !headers.has("x-publishable-api-key")) {
    headers.set("x-publishable-api-key", publishableKey);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}${routePath}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      let detail = "";
      try {
        const errJson = (await res.json()) as { message?: string };
        if (errJson?.message) detail = ` (${errJson.message})`;
      } catch {
        // Ignore parse failure
      }
      return {
        ok: false,
        status: res.status >= 500 ? 503 : res.status,
        error: `Medusa backend responded with HTTP ${res.status}${detail}.`,
      };
    }
    let data: T;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = (await res.json()) as T;
    } else {
      const text = await res.text();
      data = (text ? { message: text } : {}) as T;
    }
    return { ok: true, data };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      status: 503,
      error: isAbort
        ? `Timed out waiting for Medusa backend API at ${baseUrl}.`
        : `Unable to reach Medusa backend API at ${baseUrl}. Please ensure the Medusa server is running.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMedusaCatalogStrict(): Promise<MedusaCatalogResult> {
  const publishableKey = getMedusaPublishableKey();
  if (!publishableKey) {
    return {
      ok: false,
      status: 503,
      error: "Medusa publishable API key is not configured.",
    };
  }

  const res = await medusaFetchWithStatus<{ products?: MedusaCatalogProduct[] }>(
    "/store/sai-ajanta/catalog"
  );
  if (!res.ok) {
    return res;
  }
  if (!Array.isArray(res.data.products)) {
    return {
      ok: false,
      status: 502,
      error: "Medusa backend returned an invalid catalog payload.",
    };
  }

  const sanitizedProducts = res.data.products.filter((prod) => {
    const handle = prod.handle || "";
    const sku = prod.sku || "";
    const id = prod.id || "";
    const meta = (prod.metadata || {}) as Record<string, unknown>;
    if (
      handle.startsWith("sa-test-") ||
      sku.startsWith("SA-TEST-") ||
      id.startsWith("sa-test-") ||
      meta.test_fixture === true ||
      meta.is_test_fixture === true
    ) {
      return false;
    }
    return true;
  });

  return { ok: true, products: sanitizedProducts };
}

export async function fetchMedusaCatalog(): Promise<MedusaCatalogProduct[] | null> {
  const res = await fetchMedusaCatalogStrict();
  return res.ok ? res.products : null;
}

function normalizeCategory(rawCategory: string): ProductCategory {
  if (PRODUCT_CATEGORIES.includes(rawCategory as ProductCategory)) {
    return rawCategory as ProductCategory;
  }
  const lower = rawCategory.trim().toLowerCase();
  const matched = PRODUCT_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return matched ?? "Hardware";
}

function readMetaStr(meta: Record<string, unknown>, key: string): string | null {
  const val = meta[key];
  return typeof val === "string" && val.trim() ? val.trim() : null;
}

function readMetaNum(meta: Record<string, unknown>, key: string): number | null {
  const val = meta[key];
  return typeof val === "number" && Number.isFinite(val) ? val : null;
}

export function medusaCatalogProductToProductItem(
  mp: MedusaCatalogProduct,
  unitPriceInr?: number | null,
  effectiveTier: "CUSTOMER" | "DEALER" | "DISTRIBUTOR" = "CUSTOMER"
): ProductItem {
  const meta = mp.metadata || {};
  const src = mp.src || mp.images?.[0] || "";
  const filename = src.split("/").pop() || mp.sku || mp.id;

  // Confidential trade pricing enforcement (BE-07 / SF-01)
  const isDealer = effectiveTier === "DEALER" || effectiveTier === "DISTRIBUTOR";
  const isDistributor = effectiveTier === "DISTRIBUTOR";

  return {
    id: mp.id,
    medusaId: mp.medusaId,
    handle: mp.handle,
    filename,
    src,
    images: mp.images,
    category: normalizeCategory(mp.category),
    subcategory: mp.subcategory,
    code: mp.sku,
    name: mp.name,
    productNumber: readMetaStr(meta, "product_number"),
    brand: readMetaStr(meta, "brand"),
    model: readMetaStr(meta, "model"),
    size: readMetaStr(meta, "size"),
    measurements: readMetaStr(meta, "measurements"),
    material: readMetaStr(meta, "material"),
    variantsNote: readMetaStr(meta, "variants_note"),
    description: mp.description ?? readMetaStr(meta, "description") ?? readMetaStr(meta, "verified_description"),
    buyingHighlights: readMetaStr(meta, "buying_highlights"),
    features: readMetaStr(meta, "features"),
    customerBenefits: readMetaStr(meta, "customer_benefits"),
    specificationSummary: readMetaStr(meta, "specification_summary"),
    warranty: readMetaStr(meta, "warranty"),
    moq: readMetaStr(meta, "moq"),
    availability: readMetaStr(meta, "availability"),
    deliveryTime: readMetaStr(meta, "delivery_time"),
    unitPriceInr: unitPriceInr !== undefined ? unitPriceInr : mp.customerPriceInr,
    customerPriceInr: mp.customerPriceInr,
    contractorPriceInr: null,
    dealerPriceInr: isDealer ? mp.dealerPriceInr : null,
    distributorPriceInr: isDistributor ? mp.distributorPriceInr : null,
    billingUnit: mp.billingUnit,
    gstRate: mp.gstRate > 1 ? mp.gstRate / 100 : mp.gstRate,
    gstMode: mp.gstMode,
    stockQty: mp.stockQty,
    approved: mp.approved,
    isQuoteOnly: Boolean(meta.is_quote_only || meta.seller_route === "ENQUIRY_ONLY" || mp.customerPriceInr === null),
    sellerRoute: typeof meta.seller_route === "string" ? meta.seller_route : null,
    metadata: meta,
  };
}

export interface MedusaCustomerRecord {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  company_name?: string | null;
  created_at?: string;
}

export interface MedusaDmsProfile {
  id: string;
  customer_id: string;
  role: "CUSTOMER" | "DEALER" | "DISTRIBUTOR";
  status: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
  business_name?: string | null;
  gst_number?: string | null;
  territory?: string | null;
  dynamic_attributes?: Record<string, unknown> | null;
}

export type MedusaAuthSessionResult =
  | {
      ok: true;
      token: string;
      customer: MedusaCustomerRecord;
      profile: MedusaDmsProfile | null;
    }
  | { ok: false; status: number; error: string };

export type MedusaAdminAuthResult =
  | {
      ok: true;
      token: string;
      adminUser: {
        id: string;
        email: string;
        first_name?: string | null;
        last_name?: string | null;
      };
    }
  | { ok: false; status: number; error: string };

export async function fetchMedusaCustomerSessionStrict(
  token: string
): Promise<MedusaAuthSessionResult> {
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "Invalid customer session token.",
    };
  }
  const publishableKey = getMedusaPublishableKey();
  if (!publishableKey) {
    return {
      ok: false,
      status: 503,
      error: "Authentication service is temporarily unconfigured.",
    };
  }

  const meRes = await medusaFetchWithStatus<{ customer?: MedusaCustomerRecord }>(
    "/store/customers/me",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!meRes.ok) {
    return meRes;
  }
  if (!meRes.data.customer?.id) {
    return {
      ok: false,
      status: 401,
      error: "Medusa customer session is invalid or expired.",
    };
  }

  const profRes = await medusaFetchWithStatus<{ profile?: MedusaDmsProfile | null }>(
    "/store/sai-ajanta/profile",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!profRes.ok && profRes.status >= 500) {
    return profRes;
  }

  return {
    ok: true,
    token,
    customer: meRes.data.customer,
    profile: profRes.ok ? (profRes.data.profile ?? null) : null,
  };
}

export async function loginCustomerInMedusaStrict(
  email: string,
  password: string
): Promise<MedusaAuthSessionResult> {
  const publishableKey = getMedusaPublishableKey();
  if (!publishableKey) {
    return {
      ok: false,
      status: 503,
      error: "Customer login service is temporarily unconfigured.",
    };
  }

  const authRes = await medusaFetchWithStatus<{ token?: string }>(
    "/auth/customer/emailpass",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );

  if (!authRes.ok) {
    if (authRes.status === 401 || authRes.status === 400) {
      return { ok: false, status: 401, error: "Invalid email or password. Please try again." };
    }
    return authRes;
  }

  if (!authRes.data.token) {
    return { ok: false, status: 401, error: "Invalid email or password. Please try again." };
  }

  return fetchMedusaCustomerSessionStrict(authRes.data.token);
}

export async function registerCustomerInMedusaStrict(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role?: string;
  organization?: string;
  gstin?: string | null;
  businessCity?: string | null;
  preferred_pins?: string[] | string;
  proposed_pins?: string[] | string;
  categories?: string[];
  invite_token?: string;
  operating_location?: string;
}): Promise<MedusaAuthSessionResult> {
  const publishableKey = getMedusaPublishableKey();
  if (!publishableKey) {
    return {
      ok: false,
      status: 503,
      error: "Customer registration service is temporarily unconfigured.",
    };
  }

  const reg = await medusaFetchWithStatus<{ token?: string }>(
    "/auth/customer/emailpass/register",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    }
  );
  if (!reg.ok) {
    const lower = reg.error.toLowerCase();
    if (reg.status === 409 || reg.status === 422 || lower.includes("already exists")) {
      return {
        ok: false,
        status: 409,
        error: "An account with this email already exists.",
      };
    }
    return reg;
  }

  const regToken = reg.data.token;
  if (!regToken) {
    return {
      ok: false,
      status: 502,
      error: "Medusa registration did not return an auth token.",
    };
  }

  const nameParts = input.name.trim().split(/\s+/);
  const firstName = nameParts[0] || input.name;
  const lastName = nameParts.slice(1).join(" ") || "";

  const customerRes = await medusaFetchWithStatus<{ customer?: { id: string } }>(
    "/store/customers",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${regToken}`,
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email: input.email,
        phone: input.phone || undefined,
        company_name: input.organization || undefined,
      }),
    }
  );

  if (!customerRes.ok) {
    return customerRes;
  }
  if (!customerRes.data.customer?.id) {
    return {
      ok: false,
      status: 502,
      error: "Failed to create customer profile in Medusa.",
    };
  }

  // Exchange email/password for a customer-scoped JWT (actor_id = cus_...) before creating DMS profile
  const loginRes = await medusaFetchWithStatus<{ token?: string }>(
    "/auth/customer/emailpass",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        password: input.password,
      }),
    }
  );
  if (!loginRes.ok || !loginRes.data.token) {
    return {
      ok: false,
      status: loginRes.ok ? 502 : loginRes.status,
      error: loginRes.ok
        ? "Customer created in Medusa, but customer token acquisition failed."
        : loginRes.error,
    };
  }

  const customerToken = loginRes.data.token;

  const profRes = await medusaFetchWithStatus<{ profile?: MedusaDmsProfile }>(
    "/store/sai-ajanta/profile",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        role: input.role || "CUSTOMER",
        business_name: input.organization || "",
        gst_number: input.gstin || null,
        territory: input.businessCity || null,
        phone: input.phone || null,
        preferred_pins: input.preferred_pins,
        proposed_pins: input.proposed_pins,
        categories: input.categories,
        invite_token: input.invite_token,
        operating_location: input.operating_location,
      }),
    }
  );

  if (!profRes.ok) {
    return profRes;
  }

  return fetchMedusaCustomerSessionStrict(customerToken);
}

export async function updateMedusaCustomerProfileStrict(
  token: string,
  input: {
    name: string;
    phone?: string;
    organization?: string;
    gstin?: string | null;
    businessCity?: string | null;
  }
): Promise<MedusaAuthSessionResult> {
  if (!token || !getMedusaPublishableKey()) {
    return {
      ok: false,
      status: 401,
      error: "Invalid customer session.",
    };
  }
  const nameParts = input.name.trim().split(/\s+/);
  const firstName = nameParts[0] || input.name;
  const lastName = nameParts.slice(1).join(" ") || "";

  const custRes = await medusaFetchWithStatus<{ customer?: MedusaCustomerRecord }>(
    "/store/customers/me",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        phone: input.phone || undefined,
        company_name: input.organization || undefined,
      }),
    }
  );
  if (!custRes.ok) {
    return custRes;
  }

  const profRes = await medusaFetchWithStatus<{ profile?: MedusaDmsProfile }>(
    "/store/sai-ajanta/profile",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        business_name: input.organization || "",
        gst_number: input.gstin || null,
        territory: input.businessCity || null,
        phone: input.phone || null,
      }),
    }
  );
  if (!profRes.ok) {
    return profRes;
  }

  return fetchMedusaCustomerSessionStrict(token);
}

export async function requestPasswordResetInMedusaStrict(
  email: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!getMedusaPublishableKey()) {
    return { ok: true, status: 200 };
  }
  const normalizedEmail = email.trim().toLowerCase();
  const res = await medusaFetchWithStatus<Record<string, unknown>>(
    "/auth/customer/emailpass/reset-password",
    {
      method: "POST",
      body: JSON.stringify({
        identifier: normalizedEmail,
      }),
    }
  );

  // Non-enumeration: even if identity does not exist in Medusa, Medusa returns 201/200.
  // If backend returns 200, 201, or 404, we treat as ok: true to prevent user enumeration.
  if (res.ok || res.status === 404 || res.status === 503) {
    return { ok: true, status: 200 };
  }

  return {
    ok: false,
    status: res.status,
    error: res.error,
  };
}

export async function completePasswordResetInMedusaStrict(
  token: string,
  newPassword: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  if (!token || !token.trim()) {
    return { ok: false, status: 400, error: "Reset token is required." };
  }
  if (!newPassword || newPassword.length < 8) {
    return {
      ok: false,
      status: 400,
      error: "New password must be at least 8 characters long.",
    };
  }

  // Attempt the authoritative reset route which consumes token and bumps session_revoked_at
  const res = await medusaFetchWithStatus<{ ok?: boolean; message?: string }>(
    "/store/sai-ajanta/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify({
        token: token.trim(),
        password: newPassword,
      }),
    }
  );

  if (res.ok) {
    return { ok: true, status: 200 };
  }

  // Fallback to native Medusa update route if custom route returns 404
  if (res.status === 404) {
    const nativeRes = await medusaFetchWithStatus<{ success?: boolean }>(
      "/auth/customer/emailpass/update",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({
          password: newPassword,
        }),
      }
    );

    if (!nativeRes.ok) {
      if (nativeRes.status === 401 || nativeRes.status === 400) {
        return {
          ok: false,
          status: 400,
          error:
            "Reset token has expired or is invalid. Please request a new password reset.",
        };
      }
      return { ok: false, status: nativeRes.status, error: nativeRes.error };
    }
    return { ok: true, status: 200 };
  }

  return {
    ok: false,
    status: res.status,
    error:
      res.status === 400 || res.status === 401
        ? res.error ||
          "Reset token has expired or is invalid. Please request a new password reset."
        : res.error,
  };
}

export async function fetchMedusaAdminSessionStrict(
  token: string
): Promise<MedusaAdminAuthResult> {
  const meRes = await medusaFetchWithStatus<{
    user?: {
      id: string;
      email: string;
      first_name?: string | null;
      last_name?: string | null;
    };
  }>("/admin/users/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!meRes.ok) {
    return meRes;
  }
  if (!meRes.data.user?.id) {
    return {
      ok: false,
      status: 401,
      error: "Medusa admin session is invalid or expired.",
    };
  }
  return {
    ok: true,
    token,
    adminUser: meRes.data.user,
  };
}

export async function loginAdminInMedusaStrict(
  email: string,
  password: string
): Promise<MedusaAdminAuthResult> {
  const authRes = await medusaFetchWithStatus<{ token?: string }>(
    "/auth/user/emailpass",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
  if (!authRes.ok) {
    if (authRes.status === 401 || authRes.status === 400) {
      return { ok: false, status: 401, error: "Invalid email or password." };
    }
    return authRes;
  }
  if (!authRes.data.token) {
    return { ok: false, status: 401, error: "Invalid email or password." };
  }
  return fetchMedusaAdminSessionStrict(authRes.data.token);
}

export async function updateMedusaCustomerDmsStatusStrict(
  adminToken: string,
  customerId: string,
  payload: {
    status: "ACTIVE" | "PENDING_APPROVAL" | "SUSPENDED";
    rejectionReason?: string | null;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await medusaFetchWithStatus(
    `/admin/sai-ajanta/customers/${encodeURIComponent(customerId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: payload.status,
        rejection_reason: payload.rejectionReason || null,
      }),
    }
  );
  if (!res.ok) return res;
  return { ok: true };
}

export interface StorefrontAddressRow {
  id: string;
  label: string;
  recipient: string;
  organization: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  created_at: string;
}

interface MedusaAddressRecord {
  id: string;
  address_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  address_1?: string | null;
  city?: string | null;
  province?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
}

function mapMedusaAddress(addr: MedusaAddressRecord): StorefrontAddressRow {
  const meta = addr.metadata || {};
  const label =
    (typeof meta.label === "string" && meta.label.trim()) ||
    addr.address_name ||
    "Saved Address";
  const recipient = [addr.first_name, addr.last_name]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ")
    .trim();

  return {
    id: addr.id,
    label,
    recipient: recipient || (typeof meta.recipient === "string" ? meta.recipient : ""),
    organization:
      addr.company ||
      (typeof meta.organization === "string" ? meta.organization : ""),
    line1: addr.address_1 || "",
    city: addr.city || "",
    state: addr.province || "",
    pincode: addr.postal_code || "",
    phone: addr.phone || "",
    created_at: addr.created_at || new Date().toISOString(),
  };
}

export async function listMedusaAddressesStrict(
  customerToken: string
): Promise<
  | { ok: true; addresses: StorefrontAddressRow[] }
  | { ok: false; status: number; error: string }
> {
  if (!customerToken || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid customer session." };
  }
  const res = await medusaFetchWithStatus<{ addresses?: MedusaAddressRecord[] }>(
    "/store/customers/me/addresses",
    {
      headers: { Authorization: `Bearer ${customerToken}` },
    }
  );
  if (!res.ok) return res;
  const rows = (res.data.addresses || []).map(mapMedusaAddress);
  rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { ok: true, addresses: rows };
}

export async function createMedusaAddressStrict(
  customerToken: string,
  input: {
    label: string;
    recipient: string;
    organization: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
  }
): Promise<
  | { ok: true; address: StorefrontAddressRow }
  | { ok: false; status: number; error: string }
> {
  if (!customerToken || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid customer session." };
  }
  const parts = input.recipient.trim().split(/\s+/);
  const firstName = parts[0] || input.recipient;
  const lastName = parts.slice(1).join(" ") || "";

  const res = await medusaFetchWithStatus<{ customer?: { addresses?: MedusaAddressRecord[] } }>(
    "/store/customers/me/addresses",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify({
        address_name: input.label,
        first_name: firstName,
        last_name: lastName,
        company: input.organization,
        address_1: input.line1,
        city: input.city,
        province: input.state,
        postal_code: input.pincode,
        country_code: "in",
        phone: input.phone,
        metadata: {
          label: input.label,
          recipient: input.recipient,
          organization: input.organization,
        },
      }),
    }
  );
  if (!res.ok) return res;
  const addresses = (res.data.customer?.addresses || []).map(mapMedusaAddress);
  const created =
    addresses.find(
      (a) => a.label === input.label && a.line1 === input.line1
    ) ||
    addresses[addresses.length - 1] || {
      id: `addr-${Date.now()}`,
      ...input,
      created_at: new Date().toISOString(),
    };
  return { ok: true, address: created };
}

export async function deleteMedusaAddressStrict(
  customerToken: string,
  addressId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!customerToken || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid customer session." };
  }
  return medusaFetchWithStatus(
    `/store/customers/me/addresses/${encodeURIComponent(addressId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${customerToken}` },
    }
  );
}

export async function submitEnquiryToMedusaStrict(payload: {
  name: string;
  role: string;
  organization: string;
  phone: string;
  email: string;
  city: string;
  division: string;
  notes: string;
  source: string;
  postal_code?: string;
  lead_type?: string;
  items?: any[];
  attachments?: any[];
}): Promise<
  | { ok: true; id: string; message: string; status?: string; assignedSellerName?: string | null }
  | { ok: false; status: number; error: string }
> {
  if (!getMedusaPublishableKey()) {
    return { ok: false, status: 503, error: "Enquiry service is temporarily unconfigured." };
  }
  const res = await medusaFetchWithStatus<{ id: string; message: string; status?: string; assignedSellerName?: string | null }>(
    "/store/sai-ajanta/enquiries",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    return res;
  }
  return { ok: true, id: res.data.id, message: res.data.message, status: res.data.status, assignedSellerName: res.data.assignedSellerName };
}

export async function listOrdersFromMedusaStrict(
  role: string,
  medusaToken: string
): Promise<
  | { ok: true; orders: Record<string, unknown>[] }
  | { ok: false; status: number; error: string }
> {
  if (!medusaToken || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid session token." };
  }
  const endpoint =
    role === "ADMIN" ? "/admin/sai-ajanta/orders" : "/store/sai-ajanta/orders";
  const res = await medusaFetchWithStatus<{ orders?: Record<string, unknown>[] }>(
    endpoint,
    {
      headers: { Authorization: `Bearer ${medusaToken}` },
    }
  );
  if (!res.ok) return res;
  return { ok: true, orders: res.data.orders || [] };
}

export async function listEnquiriesFromMedusaStrict(
  token: string
): Promise<{ ok: true; enquiries: Record<string, unknown>[] } | { ok: false; status: number; error: string }> {
  if (!token || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid session token." };
  }
  const res = await medusaFetchWithStatus<{ enquiries?: Record<string, unknown>[] }>(
    "/store/sai-ajanta/enquiries",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) return res;
  return { ok: true, enquiries: res.data.enquiries || [] };
}

export async function createOrderInMedusaStrict(
  customerToken: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string
): Promise<
  | { ok: true; order: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  if (!customerToken || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid session token." };
  }
  const headers: Record<string, string> = {
    Authorization: `Bearer ${customerToken}`,
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  const res = await medusaFetchWithStatus<{ order: Record<string, unknown> }>(
    "/store/sai-ajanta/orders",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    return res;
  }
  return { ok: true, order: res.data.order };
}

export async function getOrderFromMedusaStrict(
  role: string,
  medusaToken: string,
  id: string
): Promise<
  | { ok: true; order: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  if (!medusaToken || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid session token." };
  }
  const prefix =
    role === "ADMIN" ? "/admin/sai-ajanta/orders" : "/store/sai-ajanta/orders";
  const res = await medusaFetchWithStatus<{ order: Record<string, unknown> }>(
    `${prefix}/${encodeURIComponent(id)}`,
    {
      headers: { Authorization: `Bearer ${medusaToken}` },
    }
  );
  if (!res.ok) return res;
  return { ok: true, order: res.data.order };
}

export async function cancelOrderInMedusaStrict(
  role: string,
  medusaToken: string,
  id: string,
  payload: { reason: string; actorName: string }
): Promise<
  | { ok: true; status: string; refundStatus: string }
  | { ok: false; status: number; error: string }
> {
  if (!medusaToken || !getMedusaPublishableKey()) {
    return { ok: false, status: 401, error: "Invalid session token." };
  }
  const prefix =
    role === "ADMIN" ? "/admin/sai-ajanta/orders" : "/store/sai-ajanta/orders";
  const res = await medusaFetchWithStatus<{
    ok: true;
    status: string;
    refundStatus: string;
  }>(
    `${prefix}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${medusaToken}` },
      body: JSON.stringify({
        action: "CANCEL",
        reason: payload.reason,
        actorName: payload.actorName,
      }),
    }
  );
  if (!res.ok) return res;
  return {
    ok: true,
    status: res.data.status,
    refundStatus: res.data.refundStatus,
  };
}

export async function updateOrderPaymentInMedusaStrict(
  customerToken: string,
  orderId: string,
  payload: {
    action: "CAPTURE" | "FAIL" | "SIGNATURE_FAILED";
    razorpayOrderId: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    reason?: string;
    actorName?: string;
  }
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const res = await medusaFetchWithStatus<Record<string, unknown>>(
    `/store/sai-ajanta/orders/${encodeURIComponent(orderId)}/payment`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${customerToken}` },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) return res;
  return { ok: true, data: res.data };
}

export async function forwardRazorpayWebhookToMedusaStrict(
  signature: string,
  payload: {
    rawEventJson: string;
    eventType: string;
    providerOrderId: string;
    providerPaymentId?: string;
    failureReason?: string;
  }
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await medusaFetchWithStatus<{ received: boolean }>(
    "/store/sai-ajanta/payments/webhook",
    {
      method: "POST",
      headers: {
        "x-razorpay-signature": signature,
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) return res;
  return { ok: true };
}

export async function fetchAdminPortalOverviewStrict(
  adminToken: string
): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  return medusaFetchWithStatus<Record<string, unknown>>(
    "/admin/sai-ajanta/portal",
    {
      headers: { Authorization: `Bearer ${adminToken}` },
    }
  );
}

export async function updateAdminOrderInMedusaStrict(
  adminToken: string,
  id: string,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; order: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const res = await medusaFetchWithStatus<{ order: Record<string, unknown> }>(
    `/admin/sai-ajanta/orders/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) return res;
  return { ok: true, order: res.data.order };
}

export async function updateAdminEnquiryInMedusaStrict(
  adminToken: string,
  id: string,
  status: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const res = await medusaFetchWithStatus(
    `/admin/sai-ajanta/enquiries/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) return res;
  return { ok: true };
}

export async function createAdminProductInMedusaStrict(
  adminToken: string,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; product: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const res = await medusaFetchWithStatus<{ product: Record<string, unknown> }>(
    "/admin/sai-ajanta/products",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) return res;
  return { ok: true, product: res.data.product };
}

export async function updateAdminProductInMedusaStrict(
  adminToken: string,
  id: string,
  payload: Record<string, unknown>
): Promise<
  | { ok: true; product: Record<string, unknown> }
  | { ok: false; status: number; error: string }
> {
  const res = await medusaFetchWithStatus<{ product: Record<string, unknown> }>(
    `/admin/sai-ajanta/products/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) return res;
  return { ok: true, product: res.data.product };
}


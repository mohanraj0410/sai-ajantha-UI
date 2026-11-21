import "server-only";
import type { SafeUser } from "@/lib/server/auth";
import {
  fetchMedusaCatalogStrict,
  type MedusaCatalogProduct,
} from "@/lib/server/medusa";

export class MedusaUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.name = "MedusaUnavailableError";
    this.status = status;
  }
}

export type EffectivePriceTier = "CUSTOMER" | "DEALER" | "DISTRIBUTOR";

export interface CartQuoteRequestItem {
  productId: string;
  finish: string;
  packLabel: string;
  packMultiplier: number;
  quantity: number;
}

export interface ComputedOrderLine {
  productId: string;
  sku: string;
  name: string;
  category: string;
  finish: string;
  packLabel: string;
  packMultiplier: number;
  unitPriceInr: number | null;
  quantity: number;
  lineTotalInr: number;
  gstRate: number;
  gstMode: string;
}

export interface ComputedOrderSummary {
  priceTierApplied: EffectivePriceTier;
  wholesaleUnlocked: boolean;
  items: ComputedOrderLine[];
  subtotalInr: number;
  gstAmountInr: number;
  totalInr: number;
  hasQuoteItems: boolean;
}

const ALLOWED_PACK_MULTIPLIERS = new Set([1, 10, 50]);

export function getEffectivePriceTier(user: SafeUser | null): {
  tier: EffectivePriceTier;
  wholesaleUnlocked: boolean;
} {
  if (!user) {
    return { tier: "CUSTOMER", wholesaleUnlocked: false };
  }
  if (user.role === "DISTRIBUTOR" && user.approvalStatus === "APPROVED") {
    return { tier: "DISTRIBUTOR", wholesaleUnlocked: true };
  }
  if (user.role === "DEALER" && user.approvalStatus === "APPROVED") {
    return { tier: "DEALER", wholesaleUnlocked: true };
  }
  // Pending or Rejected wholesale accounts and Customers get standard customer tier only
  return { tier: "CUSTOMER", wholesaleUnlocked: false };
}

export function resolveMedusaProductUnitPrice(
  product: MedusaCatalogProduct,
  tier: EffectivePriceTier
): number | null {
  if (tier === "DISTRIBUTOR") {
    return (
      product.distributorPriceInr ??
      product.dealerPriceInr ??
      product.customerPriceInr
    );
  }
  if (tier === "DEALER") {
    return product.dealerPriceInr ?? product.customerPriceInr;
  }
  return product.customerPriceInr;
}

export async function computeAuthoritativeOrderQuote(
  rawItems: CartQuoteRequestItem[],
  user: SafeUser | null,
  options?: { validateStock?: boolean }
): Promise<ComputedOrderSummary> {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Order must contain at least one item.");
  }

  const catalogRes = await fetchMedusaCatalogStrict();
  if (!catalogRes.ok) {
    throw new MedusaUnavailableError(catalogRes.error, catalogRes.status || 503);
  }

  const { tier, wholesaleUnlocked } = getEffectivePriceTier(user);

  const lines: ComputedOrderLine[] = [];
  let subtotalInr = 0;
  let gstAmountInr = 0;
  let hasQuoteItems = false;

  const byKey = new Map<string, MedusaCatalogProduct>();
  for (const mp of catalogRes.products) {
    byKey.set(mp.id, mp);
    if (mp.medusaId) byKey.set(mp.medusaId, mp);
    if (mp.handle) byKey.set(mp.handle, mp);
  }

  // Pre-validate aggregated stock demand across all cart lines (BE-05)
  if (options?.validateStock) {
    const unitsByProduct = new Map<string, number>();
    for (const raw of rawItems) {
      const qty = Math.max(1, Math.min(1000, Math.floor(Number(raw.quantity) || 1)));
      const mult = ALLOWED_PACK_MULTIPLIERS.has(Number(raw.packMultiplier))
        ? Number(raw.packMultiplier)
        : 1;
      const units = qty * mult;
      unitsByProduct.set(raw.productId, (unitsByProduct.get(raw.productId) || 0) + units);
    }
    for (const [prodId, totalUnits] of unitsByProduct.entries()) {
      const prod = byKey.get(prodId);
      if (prod && prod.stockQty < totalUnits) {
        throw new Error(
          `Insufficient stock for ${prod.name} (${prod.sku}). Available: ${prod.stockQty} units, Requested: ${totalUnits} units.`
        );
      }
    }
  }

  for (const raw of rawItems) {
    const product = byKey.get(raw.productId);

    if (!product) {
      throw new Error(`Product ${raw.productId} is unavailable in the live Medusa catalog.`);
    }

    const quantity = Math.max(1, Math.min(1000, Math.floor(Number(raw.quantity) || 1)));
    const packMultiplier = ALLOWED_PACK_MULTIPLIERS.has(Number(raw.packMultiplier))
      ? Number(raw.packMultiplier)
      : 1;

    const requiredUnits = quantity * packMultiplier;
    if (options?.validateStock && product.stockQty < requiredUnits) {
      throw new Error(
        `Insufficient stock for ${product.name} (${product.sku}). Available: ${product.stockQty} units.`
      );
    }

    const baseUnitPrice = resolveMedusaProductUnitPrice(product, tier);
    const packUnitPrice =
      baseUnitPrice !== null
        ? Math.round(baseUnitPrice * packMultiplier * 100) / 100
        : null;

    if (packUnitPrice === null) {
      hasQuoteItems = true;
    }

    const lineTotalInr =
      packUnitPrice !== null
        ? Math.round(packUnitPrice * quantity * 100) / 100
        : 0;

    subtotalInr += lineTotalInr;

    const rawGst = Number(product.gstRate) || 0.18;
    const normalizedGstRate = rawGst > 1 ? rawGst / 100 : rawGst;
    const gstMode = product.gstMode || "Excluded";

    if (lineTotalInr > 0) {
      if (gstMode.toLowerCase() === "included") {
        const basePortion = lineTotalInr / (1 + normalizedGstRate);
        gstAmountInr += lineTotalInr - basePortion;
      } else {
        gstAmountInr += lineTotalInr * normalizedGstRate;
      }
    }

    lines.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      finish: String(raw.finish || "Standard Finish").slice(0, 80),
      packLabel: String(raw.packLabel || `Lot (${packMultiplier}x)`).slice(0, 80),
      packMultiplier,
      unitPriceInr: packUnitPrice,
      quantity,
      lineTotalInr,
      gstRate: normalizedGstRate,
      gstMode,
    });
  }

  subtotalInr = Math.round(subtotalInr * 100) / 100;
  gstAmountInr = Math.round(gstAmountInr * 100) / 100;
  const totalInr = Math.round((subtotalInr + gstAmountInr) * 100) / 100;

  return {
    priceTierApplied: tier,
    wholesaleUnlocked,
    items: lines,
    subtotalInr,
    gstAmountInr,
    totalInr,
    hasQuoteItems,
  };
}


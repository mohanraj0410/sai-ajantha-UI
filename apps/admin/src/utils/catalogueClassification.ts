export type CatalogueRouteGroup =
  | "SAI_AJANTHA_DIRECT"
  | "DISTRIBUTOR_CATEGORY"
  | "FLOOR_SPRING_QUOTE_ONLY";

export interface CatalogueClassifiableProduct {
  sku?: string | null;
  name?: string | null;
  title?: string | null;
  category?: string | null;
  subcategory?: string | null;
  customer_price_inr?: number | null;
  stock_qty?: number | null;
  stockQty?: number | null;
  approved?: boolean | number | null;
  active?: boolean | number | null;
}

export const DISTRIBUTOR_LED_CATEGORIES = new Set([
  "Door Closer & Floor Spring",
  "Kitchen Basket",
]);

/**
 * Authoritative Floor Spring detector (QA-V25-02):
 * Matches all 8 SA-I-FS-* SKUs (including SKUs with internal spaces such as
 * "SA-I-FS- TON110-008") as well as explicit "Floor Spring" product titles/subcategories.
 * Floor Springs remain enquiry / quote-only with seller route pending owner approval.
 */
export function isFloorSpringProduct(product: CatalogueClassifiableProduct): boolean {
  const skuCompact = String(product.sku || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  if (skuCompact.startsWith("SA-I-FS-")) {
    return true;
  }
  const text = `${product.name || product.title || ""} ${product.subcategory || ""}`.toLowerCase();
  return /\bfloor\s*spring\b/.test(text);
}

export function classifyCatalogueProduct(product: CatalogueClassifiableProduct): {
  routeGroup: CatalogueRouteGroup;
  isFloorSpring: boolean;
  isQuoteOnly: boolean;
  isDirectCheckoutEligible: boolean;
  label: string;
} {
  const isFloorSpring = isFloorSpringProduct(product);
  const category = String(product.category || "").trim();
  const hasCustomerPrice = Number(product.customer_price_inr || 0) > 0;
  const isApproved = Boolean(product.approved);
  const isActive = product.active === undefined || product.active === null ? true : Boolean(product.active);
  const stockQty = Number(product.stock_qty ?? product.stockQty ?? 0);

  if (isFloorSpring) {
    return {
      routeGroup: "FLOOR_SPRING_QUOTE_ONLY",
      isFloorSpring: true,
      isQuoteOnly: true,
      isDirectCheckoutEligible: false,
      label: "Floor Spring (Quote Only)",
    };
  }

  if (DISTRIBUTOR_LED_CATEGORIES.has(category)) {
    return {
      routeGroup: "DISTRIBUTOR_CATEGORY",
      isFloorSpring: false,
      isQuoteOnly: !hasCustomerPrice,
      // Distributor resale online checkout remains locked pending owner approval.
      isDirectCheckoutEligible: false,
      label: "Distributor Category",
    };
  }

  return {
    routeGroup: "SAI_AJANTHA_DIRECT",
    isFloorSpring: false,
    isQuoteOnly: !hasCustomerPrice,
    isDirectCheckoutEligible: hasCustomerPrice && isApproved && isActive && stockQty > 0,
    label: "Sai Ajantha Direct",
  };
}

export interface CatalogueAnalyticsSummary {
  totalSkus: number;
  publishedSkus: number;
  inStockSkus: number;
  directCategorySkus: number;
  distributorCategorySkus: number;
  floorSpringQuoteOnlySkus: number;
  missingPriceQuoteOnlySkus: number;
  totalQuoteOnlySkus: number;
  directCheckoutEligibleSkus: number;
}

export function summarizeCatalogueAnalytics(
  products: CatalogueClassifiableProduct[]
): CatalogueAnalyticsSummary {
  let publishedSkus = 0;
  let inStockSkus = 0;
  let directCategorySkus = 0;
  let distributorCategorySkus = 0;
  let floorSpringQuoteOnlySkus = 0;
  let missingPriceQuoteOnlySkus = 0;
  let totalQuoteOnlySkus = 0;
  let directCheckoutEligibleSkus = 0;

  for (const p of products) {
    const c = classifyCatalogueProduct(p);
    const stock = Number(p.stock_qty ?? p.stockQty ?? 0);
    if (Boolean(p.approved)) publishedSkus++;
    if (stock > 0) inStockSkus++;

    if (c.routeGroup === "SAI_AJANTHA_DIRECT") directCategorySkus++;
    else if (c.routeGroup === "DISTRIBUTOR_CATEGORY") distributorCategorySkus++;
    else if (c.routeGroup === "FLOOR_SPRING_QUOTE_ONLY") floorSpringQuoteOnlySkus++;

    if (c.isQuoteOnly) {
      totalQuoteOnlySkus++;
      if (!c.isFloorSpring) missingPriceQuoteOnlySkus++;
    }
    if (c.isDirectCheckoutEligible) directCheckoutEligibleSkus++;
  }

  return {
    totalSkus: products.length,
    publishedSkus,
    inStockSkus,
    directCategorySkus,
    distributorCategorySkus,
    floorSpringQuoteOnlySkus,
    missingPriceQuoteOnlySkus,
    totalQuoteOnlySkus,
    directCheckoutEligibleSkus,
  };
}

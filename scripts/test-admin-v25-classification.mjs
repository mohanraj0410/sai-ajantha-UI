import assert from "node:assert/strict";

const ADMIN_URL = "http://localhost:7001";

const DISTRIBUTOR_LED_CATEGORIES = new Set([
  "Door Closer & Floor Spring",
  "Kitchen Basket",
]);

function isFloorSpringProduct(product) {
  const skuCompact = String(product.sku || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
  if (skuCompact.startsWith("SA-I-FS-")) return true;
  const text = `${product.name || product.title || ""} ${product.subcategory || ""}`.toLowerCase();
  return /\bfloor\s*spring\b/.test(text);
}

function classifyCatalogueProduct(product) {
  const isFloorSpring = isFloorSpringProduct(product);
  const category = String(product.category || "").trim();
  const hasCustomerPrice = Number(product.customer_price_inr || 0) > 0;
  const isApproved = Boolean(product.approved);
  const isActive =
    product.active === undefined || product.active === null ? true : Boolean(product.active);
  const stockQty = Number(product.stock_qty ?? product.stockQty ?? 0);

  if (isFloorSpring) {
    return {
      routeGroup: "FLOOR_SPRING_QUOTE_ONLY",
      isFloorSpring: true,
      isQuoteOnly: true,
      isDirectCheckoutEligible: false,
    };
  }
  if (DISTRIBUTOR_LED_CATEGORIES.has(category)) {
    return {
      routeGroup: "DISTRIBUTOR_CATEGORY",
      isFloorSpring: false,
      isQuoteOnly: !hasCustomerPrice,
      isDirectCheckoutEligible: false,
    };
  }
  return {
    routeGroup: "SAI_AJANTHA_DIRECT",
    isFloorSpring: false,
    isQuoteOnly: !hasCustomerPrice,
    isDirectCheckoutEligible: hasCustomerPrice && isApproved && isActive && stockQty > 0,
  };
}

async function main() {
  console.log("=== QA-V25-02: CATALOGUE CLASSIFICATION & FLOOR SPRING GUARD UNIT TEST ===\n");

  // 1. Unit tests on synthetic edge cases
  const syntheticFloorSpringWithSpace = classifyCatalogueProduct({
    sku: "SA-I-FS- TON110-008",
    name: "Hydraulic Floor Spring",
    category: "Door Closer & Floor Spring",
    customer_price_inr: 10322,
    stock_qty: 50,
    approved: 1,
    active: 1,
  });
  assert.equal(syntheticFloorSpringWithSpace.routeGroup, "FLOOR_SPRING_QUOTE_ONLY");
  assert.equal(syntheticFloorSpringWithSpace.isFloorSpring, true);
  assert.equal(syntheticFloorSpringWithSpace.isQuoteOnly, true);
  assert.equal(syntheticFloorSpringWithSpace.isDirectCheckoutEligible, false);
  console.log("[PASS] Floor Spring with internal SKU space stays Quote-Only & non-checkout");

  const syntheticDistCat = classifyCatalogueProduct({
    sku: "SA-M-DC-60-001",
    name: "Door Closer 60",
    category: "Door Closer & Floor Spring",
    customer_price_inr: 1148,
    stock_qty: 50,
    approved: 1,
    active: 1,
  });
  assert.equal(syntheticDistCat.routeGroup, "DISTRIBUTOR_CATEGORY");
  assert.equal(syntheticDistCat.isDirectCheckoutEligible, false);
  console.log("[PASS] Door Closer classified as Distributor Category (direct checkout locked)");

  const syntheticMissingPrice = classifyCatalogueProduct({
    sku: "SA-SCR-999",
    name: "Custom Pleated Screen",
    category: "Insect Screens",
    customer_price_inr: null,
    stock_qty: 20,
    approved: 1,
    active: 1,
  });
  assert.equal(syntheticMissingPrice.routeGroup, "SAI_AJANTHA_DIRECT");
  assert.equal(syntheticMissingPrice.isQuoteOnly, true);
  assert.equal(syntheticMissingPrice.isDirectCheckoutEligible, false);
  console.log("[PASS] Missing buyer price falls back to Quote-Only (never ₹0 checkout)");

  // 2. Authoritative API dataset verification
  const authRes = await fetch(`${ADMIN_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@sai-ajanta.com", password: "Admin1234!" }),
  });
  const auth = await authRes.json();
  assert.ok(auth.token, "Admin auth token required");

  const portalRes = await fetch(`${ADMIN_URL}/admin/sai-ajanta/portal`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  const portal = await portalRes.json();
  const products = portal.products || [];

  let direct = 0;
  let distCat = 0;
  let floorSprings = [];
  let directEligible = 0;

  for (const p of products) {
    const cls = classifyCatalogueProduct(p);
    if (cls.routeGroup === "SAI_AJANTHA_DIRECT") direct++;
    else if (cls.routeGroup === "DISTRIBUTOR_CATEGORY") distCat++;
    else if (cls.routeGroup === "FLOOR_SPRING_QUOTE_ONLY") {
      assert.equal(cls.isQuoteOnly, true, `Floor Spring ${p.sku} must be quote-only`);
      assert.equal(
        cls.isDirectCheckoutEligible,
        false,
        `Floor Spring ${p.sku} must not allow Buy Now checkout`
      );
      floorSprings.push(p.sku);
    }
    if (cls.isDirectCheckoutEligible) directEligible++;
  }

  console.log("\nLive Reconciled Dataset Breakdown:");
  console.log(`  Total SKUs:                   ${products.length}`);
  console.log(`  Sai Ajantha Direct (9 cats):  ${direct}`);
  console.log(`  Distributor Category (DC+KB): ${distCat}`);
  console.log(`  Floor Springs (Quote Only):   ${floorSprings.length}`);
  console.log(`  Direct Checkout-Eligible:     ${directEligible}`);
  console.log(`  Floor Spring SKUs verified:   ${floorSprings.join(", ")}`);

  assert.equal(products.length, 281, "Expected 281 SKUs in current rehearsal dataset");
  assert.equal(direct, 153, "Expected 153 Sai Ajantha Direct SKUs");
  assert.equal(distCat, 120, "Expected 120 Distributor-Category SKUs (Door Closers + Kitchen Baskets)");
  assert.equal(floorSprings.length, 8, "Expected exactly 8 SA-I-FS-* Floor Spring SKUs");
  assert.equal(direct + distCat + floorSprings.length, 281, "Reconciled total must equal 281");

  console.log("\n=== ALL QA-V25-02 CLASSIFICATION & FLOOR SPRING GUARD TESTS PASSED ===");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

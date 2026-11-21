/**
 * SAI AJANTHA — PHASE 08 SELLER ROUTER, REAL AVAILABILITY, PERSISTENT CART & MULTI-SELLER SUITE
 * 
 * Verifies:
 * - Disposable Database Isolation Guard (DEC-001)
 * - P8.1: Canonical Server-Side Seller Resolution Matrix:
 *     - Direct 9 Categories -> SAI_AJANTHA_DIRECT (Central Warehouse)
 *     - Floor Springs Override -> ENQUIRY_ONLY (DEC-003)
 *     - Door Closers & Kitchen Baskets -> Active Territory Distributor
 *     - Unserved PIN -> ENQUIRY_ONLY manual queue
 *     - Client parameter spoofing strictly ignored
 * - P8.2: Truthful Availability & Trade Tier Pricing Privacy
 * - P8.3: Persistent Cart, Guest Session Token, Atomic Updates & Validation
 * - P8.4: Mixed-Seller Cart Decomposition (Direct vs Distributor vs Floor Springs)
 * - P8.3: Idempotent Guest-to-Customer Cart Merge on Login
 * - P8.4 & P8.5: Multi-Seller Checkout Intent & Quotation Scaffold (DEC-002: Live Payments Disabled)
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";
import { DistributorLifecycleService } from "../apps/backend/src/services/distributor-lifecycle.service.ts";

process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";

const envPath = path.resolve(process.cwd(), "apps/backend/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const dbUrl = process.env.DISPOSABLE_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("FATAL: DISPOSABLE_DATABASE_URL or DATABASE_URL must be defined");
  process.exit(1);
}

const BACKEND_PORT = 9000;
const Client = pg.Client || pg.default?.Client || pg.default;
const client = new Client({ connectionString: dbUrl });

let PUBLISHABLE_KEY = "";
try {
  const pubConfig = JSON.parse(fs.readFileSync("local-nas/medusa-public-config.json", "utf8"));
  PUBLISHABLE_KEY = pubConfig.publishableKey;
} catch {
  // fallback if not found
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function pass(description) {
  totalTests++;
  passedTests++;
  console.log(`  [PASS] ${description}`);
}

function fail(description, details) {
  totalTests++;
  failedTests++;
  console.error(`  [FAIL] ${description}`);
  if (details) console.error("        Details:", details);
}

function assert(condition, description, details) {
  if (condition) pass(description);
  else fail(description, details);
}

async function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const headers = { ...(options.headers || {}) };
    if (options.path && options.path.startsWith("/store") && !headers["x-publishable-api-key"] && PUBLISHABLE_KEY) {
      headers["x-publishable-api-key"] = PUBLISHABLE_KEY;
    }
    const finalOptions = { ...options, headers };

    const req = http.request(finalOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });
    req.on("error", reject);
    if (body) {
      req.write(typeof body === "string" ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runPhase08Suite() {
  console.log("===============================================================================");
  console.log("PHASE 08 — SELLER ROUTER, REAL AVAILABILITY & PERSISTENT CART TEST SUITE");
  console.log("Database:", dbUrl.split("/").pop());
  console.log("===============================================================================\n");

  await client.connect();
  const { currentDb } = await assertDisposableDbConnection(client);

  // ---------------------------------------------------------------------------
  // SECTION 1: Disposable Safety Guard (DEC-001)
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Database Safety & Target Guard (DEC-001) ---");
  try {
    assertDisposableDbTarget("postgres://medusa:secret@127.0.0.1:5432/medusa");
    fail("Safety guard failed to reject primary database 'medusa'");
  } catch {
    pass("Safety guard strictly rejects primary database 'medusa'");
  }

  assert(
    currentDb.includes("disposable") || currentDb.includes("test"),
    `Active database session is verified isolated (${currentDb})`
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: Multi-Actor Setup & Clean Fixtures
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Multi-Actor Setup & Fixtures ---");
  const ts = Date.now();

  // Clean previous cart test records
  await client.query(`DELETE FROM "dms_mixed_seller_checkout_intent"`);
  await client.query(`DELETE FROM "dms_cart_line"`);
  await client.query(`DELETE FROM "dms_cart"`);

  // Helper to register actor in Medusa
  async function createActor(rolePrefix, role, status) {
    const email = `${rolePrefix}.${ts}@sai-ajanta-test.internal`;
    const password = "TestPassword123!";

    const regRes = await httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: "/auth/customer/emailpass/register",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { email, password }
    );
    const regToken = regRes.data?.token;

    const custRes = await httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: "/store/customers",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${regToken}`,
        },
      },
      { first_name: rolePrefix, last_name: "TestUser", email, phone: "9876543210" }
    );
    const customerId = custRes.data?.customer?.id;

    const loginRes = await httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: "/auth/customer/emailpass",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      { email, password }
    );
    const token = loginRes.data?.token;

    const profileId = `dms_prof_${customerId}`;
    await client.query(`DELETE FROM "account_profile" WHERE customer_id = $1`, [customerId]);
    await client.query(
      `INSERT INTO "account_profile" 
       (id, customer_id, role, status, business_name, territory)
       VALUES ($1, $2, $3, $4, $5, 'Tamil Nadu')`,
      [profileId, customerId, role, status, `${rolePrefix.toUpperCase()} Hardware`]
    );

    return { customerId, token, email };
  }

  const distAlpha = await createActor("dist.alpha", "DISTRIBUTOR", "ACTIVE");
  const distBeta = await createActor("dist.beta", "DISTRIBUTOR", "ACTIVE");
  const dealerGamma = await createActor("dealer.gamma", "DEALER", "ACTIVE");
  const customerDelta = await createActor("customer.delta", "CUSTOMER", "ACTIVE");

  pass("Created real actors: Distributor Alpha (Trichy), Distributor Beta (Madurai), Dealer Gamma, Customer Delta");

  // Assign territory coverage
  await client.query(`DELETE FROM "dms_distributor_coverage" WHERE postal_code IN ('620001', '625001')`);

  await DistributorLifecycleService.assignCoverage(client, {
    distributorId: distAlpha.customerId,
    postalCode: "620001",
    categorySlug: "door-closer-floor-spring",
    assignedBy: "staff_admin",
  });
  await DistributorLifecycleService.assignCoverage(client, {
    distributorId: distAlpha.customerId,
    postalCode: "620001",
    categorySlug: "kitchen-basket",
    assignedBy: "staff_admin",
  });
  await DistributorLifecycleService.assignCoverage(client, {
    distributorId: distBeta.customerId,
    postalCode: "625001",
    categorySlug: "door-closer-floor-spring",
    assignedBy: "staff_admin",
  });
  pass("Assigned territory coverage: Dist Alpha (PIN 620001), Dist Beta (PIN 625001)");

  // Preset inventory
  // 1. Central Warehouse stock for Direct SKU (C-Clips-001)
  await client.query(
    `UPDATE "dms_product_import_row" 
     SET stock_qty = 50, customer_price_inr = 1540, dealer_price_inr = 1350, distributor_price_inr = 1150, gst_rate = 18, updated_at = now()
     WHERE UPPER(sku) = 'C-CLIPS-001'`
  );
  // 2. Central Warehouse stock for Door Closer (SA-M-DC-60-001)
  await client.query(
    `UPDATE "dms_product_import_row" 
     SET stock_qty = 50, customer_price_inr = 1148, dealer_price_inr = 950, distributor_price_inr = 750, gst_rate = 18, updated_at = now()
     WHERE UPPER(sku) = 'SA-M-DC-60-001'`
  );
  // 3. Distributor Alpha owned inventory for SA-M-DC-60-001
  await client.query(
    `INSERT INTO "dms_distributor_inventory" 
     (id, distributor_id, sku, title, location_id, stocked_qty, reserved_qty, damaged_qty, in_transit_qty, unit_cost_paise)
     VALUES ($1, $2, 'SA-M-DC-60-001', 'Hydraulic Door Closer 60kg', 'loc_dist_trichy', 15, 0, 0, 0, 75000)
     ON CONFLICT ("distributor_id", "sku", "location_id") WHERE deleted_at IS NULL
     DO UPDATE SET stocked_qty = 15, reserved_qty = 0`,
    [`dinv_test_${distAlpha.customerId}`, distAlpha.customerId]
  );
  pass("Preset inventory: C-Clips-001 Central (50 units), SA-M-DC-60-001 Dist Alpha (15 units)");

  // ---------------------------------------------------------------------------
  // SECTION 3: P8.1 Canonical Server-Side Seller Resolution Matrix
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: P8.1 Canonical Server-Side Seller Resolution Matrix ---");

  // 3.1 Direct Category (C-Clips-001) -> SAI_AJANTHA_DIRECT
  const resDirect = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { sku: "C-Clips-001", postalCode: "620001" }
  );
  assert(resDirect.status === 200, "Direct SKU resolution returns 200 OK");
  assert(
    resDirect.data?.resolution?.resolvedRoute === "SAI_AJANTHA_DIRECT",
    "C-Clips-001 resolves to SAI_AJANTHA_DIRECT"
  );
  assert(
    resDirect.data?.resolution?.sellerId === "SAI_AJANTHA_CENTRAL",
    "Direct SKU sellerId is SAI_AJANTHA_CENTRAL"
  );
  assert(
    resDirect.data?.resolution?.warehouseId === "loc_central",
    "Direct SKU warehouseId is loc_central"
  );

  // 3.2 Floor Springs Override (SA-I-FS-TON90-007) -> strictly ENQUIRY_ONLY (DEC-003)
  const resFs = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { sku: "SA-I-FS-TON90-007", postalCode: "620001" }
  );
  assert(resFs.status === 200, "Floor Spring SKU resolution returns 200 OK");
  assert(
    resFs.data?.resolution?.resolvedRoute === "ENQUIRY_ONLY",
    "Floor Spring SKU strictly resolves to ENQUIRY_ONLY (DEC-003 override)"
  );
  assert(
    resFs.data?.resolution?.isQuoteOnly === true,
    "Floor Spring isQuoteOnly is strictly true"
  );
  assert(
    resFs.data?.resolution?.allowedNextAction === "REQUEST_QUOTE",
    "Floor Spring allowedNextAction is REQUEST_QUOTE"
  );

  // 3.3 Covered PIN for Door Closer (620001) -> DISTRIBUTOR_RESALE (Distributor Alpha)
  const resDist = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { sku: "SA-M-DC-60-001", postalCode: "620001" }
  );
  assert(resDist.status === 200, "Door closer resolution for PIN 620001 returns 200 OK");
  assert(
    resDist.data?.resolution?.resolvedRoute === "DISTRIBUTOR_RESALE",
    "Door closer resolves to DISTRIBUTOR_RESALE"
  );
  assert(
    resDist.data?.resolution?.sellerId === distAlpha.customerId,
    `Door closer routed to Distributor Alpha (${distAlpha.customerId})`
  );
  assert(
    resDist.data?.resolution?.allowedNextAction === "REQUEST_QUOTE",
    "Distributor resale online checkout disabled per DEC-002: allowedNextAction is REQUEST_QUOTE"
  );

  // 3.4 Unserved PIN for Door Closer (600001 Chennai) -> ENQUIRY_ONLY manual queue
  const resUnserved = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { sku: "SA-M-DC-60-001", postalCode: "600001" }
  );
  assert(resUnserved.status === 200, "Unserved PIN resolution returns 200 OK");
  assert(
    resUnserved.data?.resolution?.resolvedRoute === "ENQUIRY_ONLY",
    "Unserved PIN 600001 routes to ENQUIRY_ONLY"
  );
  assert(
    resUnserved.data?.resolution?.reason?.includes("manual enquiry queue"),
    "Unserved PIN reason indicates manual enquiry queue"
  );

  // 3.5 Client-Side Spoofing Rejection
  const resSpoof = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      sku: "SA-M-DC-60-001",
      postalCode: "620001",
      sellerId: "HACKER_STORE",
      warehouseId: "HACKER_WH",
      isPaid: true,
      allowedNextAction: "BUY_NOW_INSTANT",
    }
  );
  assert(
    resSpoof.data?.resolution?.sellerId === distAlpha.customerId,
    "Server-authoritative enforcement: Spoofed client sellerId ignored"
  );
  assert(
    resSpoof.data?.resolution?.allowedNextAction === "REQUEST_QUOTE",
    "Server-authoritative enforcement: Spoofed allowedNextAction ignored"
  );

  // 3.6 Unknown SKU rejection
  const resUnknown = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { sku: "DEMO-NONEXISTENT-SKU", postalCode: "620001" }
  );
  assert(
    resUnknown.status === 404 && resUnknown.data?.code === "PRODUCT_NOT_FOUND",
    "Unknown / unpublished catalog SKU rejected with 404 PRODUCT_NOT_FOUND"
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: P8.2 Availability & Trade Tier Pricing Privacy
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: P8.2 Availability & Trade Tier Pricing Privacy ---");

  // 4.1 Stock availability
  assert(
    resDirect.data?.resolution?.availableStock === 50,
    "Direct SKU available stock matches Central physical stock (50 units)"
  );
  assert(
    resDist.data?.resolution?.availableStock === 15,
    "Distributor SKU available stock matches Distributor owned stock (15 units)"
  );

  // 4.2 Anonymous Caller gets MRP, Dealer/Distributor wholesale prices strictly hidden
  assert(
    resDirect.data?.resolution?.unitPricePaise === 154000,
    "Anonymous caller sees retail price: ₹1540 (154000 paise)"
  );

  // 4.3 Dealer Caller gets Dealer price tier
  const resDealerPrice = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dealerGamma.token}`,
      },
    },
    { sku: "C-Clips-001", postalCode: "620001" }
  );
  assert(
    resDealerPrice.data?.resolution?.unitPricePaise === 135000,
    "Dealer caller sees Dealer price tier: ₹1350 (135000 paise)"
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: P8.3 Persistent Cart Lifecycle (Guest, Atomicity & Concurrency)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: P8.3 Persistent Cart Lifecycle ---");

  // 5.1 Add item to guest cart
  const guestAddRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    {
      sku: "SA-M-DC-60-001",
      quantity: 2,
      postalCode: "620001",
    }
  );
  assert(guestAddRes.status === 201, `Guest item added to cart (201 Created)`);
  const guestCart = guestAddRes.data?.cart;
  assert(Boolean(guestCart?.id), "Cart created with persistent ID");
  assert(Boolean(guestCart?.sessionToken), "Guest session token returned");
  assert(guestCart?.lines?.length === 1, "Cart has 1 line item");
  assert(guestCart?.lines[0]?.quantity === 2, "Line item has quantity: 2");

  const line1Id = guestCart?.lines[0]?.id;

  // 5.2 Cart Persistence across reloads (with valid guest session token)
  const getCartRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/store/sai-ajanta/cart?cartId=${guestCart.id}`,
    method: "GET",
    headers: { "x-session-token": guestCart.sessionToken },
  });
  assert(getCartRes.status === 200, "Fetched cart by cartId with matching session token (200 OK)");
  assert(getCartRes.data?.cart?.id === guestCart.id, "Persisted cart ID matches");
  assert(getCartRes.data?.cart?.lines[0]?.quantity === 2, "Quantity preserved in database");

  // 5.2b Security: Forged/unauthorized cartId access without session token rejected with 403
  const forgedGetRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/store/sai-ajanta/cart?cartId=${guestCart.id}`,
    method: "GET",
  });
  assert(
    forgedGetRes.status === 403 && forgedGetRes.data?.code === "FORBIDDEN_CART_ACCESS",
    "Security: Forged/unauthenticated cartId GET rejected with 403 FORBIDDEN_CART_ACCESS"
  );

  // 5.2c Security: Wrong guest session token rejected on mutation with 403
  const wrongTokenPinRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/postal-code",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": "gst_forged_attacker_token",
      },
    },
    { cartId: guestCart.id, postalCode: "600001" }
  );
  assert(
    wrongTokenPinRes.status === 403 && wrongTokenPinRes.data?.code === "FORBIDDEN_CART_ACCESS",
    "Security: Wrong guest session token mutation rejected with 403 FORBIDDEN_CART_ACCESS"
  );

  // 5.3 Update Line Quantity
  const updateLineRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/cart/lines/${line1Id}`,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": guestCart.sessionToken,
      },
    },
    { cartId: guestCart.id, quantity: 4 }
  );
  assert(updateLineRes.status === 200, "Updated line quantity (200 OK)");
  assert(updateLineRes.data?.cart?.lines[0]?.quantity === 4, "Line quantity updated to 4 in database");

  // 5.4 Input Validation: Negative quantity rejected
  const badQtyRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/cart`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": guestCart.sessionToken,
      },
    },
    { cartId: guestCart.id, sku: "SA-M-DC-60-001", quantity: -3 }
  );
  assert(badQtyRes.status === 400, "Negative quantity rejected with 400 VALIDATION_FAILED");

  // 5.5 Dynamic PIN Revalidation
  console.log("\n--- TEST 5.5: Dynamic Delivery PIN Revalidation ---");
  const changePinRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/postal-code",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": guestCart.sessionToken,
      },
    },
    { cartId: guestCart.id, postalCode: "600001" } // Unserved Chennai
  );
  assert(changePinRes.status === 200, "Updated cart postal code to 600001 (200 OK)");
  const revalidatedLine = changePinRes.data?.cart?.lines[0];
  assert(
    revalidatedLine?.sellerRoute === "ENQUIRY_ONLY",
    "Dynamic revalidation: Unserved PIN 600001 flipped Door Closer route to ENQUIRY_ONLY"
  );
  assert(
    revalidatedLine?.isQuoteOnly === true,
    "Dynamic revalidation: Line marked isQuoteOnly: true"
  );

  // Reset PIN back to 620001 (Trichy)
  const resetPinRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/postal-code",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": guestCart.sessionToken,
      },
    },
    { cartId: guestCart.id, postalCode: "620001" }
  );
  assert(
    resetPinRes.data?.cart?.lines[0]?.sellerRoute === "DISTRIBUTOR_RESALE",
    "Dynamic revalidation: PIN 620001 flipped Door Closer back to DISTRIBUTOR_RESALE (Distributor Alpha)"
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: P8.4 Mixed-Seller Cart Decomposition
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: P8.4 Mixed-Seller Cart Decomposition ---");

  // Add Direct SKU (C-Clips-001, qty 3)
  await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": guestCart.sessionToken,
      },
    },
    { cartId: guestCart.id, sku: "C-Clips-001", quantity: 3, postalCode: "620001" }
  );

  // Add Floor Spring SKU (SA-I-FS-TON90-007, qty 1)
  await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-token": guestCart.sessionToken,
      },
    },
    { cartId: guestCart.id, sku: "SA-I-FS-TON90-007", quantity: 1, postalCode: "620001" }
  );

  const mixedCartRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/store/sai-ajanta/cart?cartId=${guestCart.id}`,
    method: "GET",
    headers: { "x-session-token": guestCart.sessionToken },
  });
  const mixedCart = mixedCartRes.data?.cart;

  assert(mixedCart?.isMixedSeller === true, "Cart isMixedSeller is true");
  assert(mixedCart?.groups?.length === 3, `Cart decomposed into exactly 3 seller groups (got: ${mixedCart?.groups?.length})`);

  const groupDirect = mixedCart?.groups?.find((g) => g.sellerRoute === "SAI_AJANTHA_DIRECT");
  const groupDist = mixedCart?.groups?.find((g) => g.sellerRoute === "DISTRIBUTOR_RESALE");
  const groupFs = mixedCart?.groups?.find((g) => g.sellerRoute === "ENQUIRY_ONLY");

  assert(Boolean(groupDirect), "Group 1: SAI_AJANTHA_DIRECT present");
  assert(
    groupDirect?.checkoutEligibility?.canCheckout === true,
    "Direct Group is eligible for checkout: canCheckout: true"
  );
  assert(
    groupDirect?.checkoutEligibility?.nextAction === "READY_FOR_TEST_CHECKOUT",
    "Direct Group nextAction is READY_FOR_TEST_CHECKOUT"
  );

  assert(Boolean(groupDist), "Group 2: DISTRIBUTOR_RESALE present");
  assert(
    groupDist?.checkoutEligibility?.canCheckout === false,
    "Distributor Group online checkout is disabled: canCheckout: false"
  );
  assert(
    groupDist?.checkoutEligibility?.nextAction === "REQUEST_QUOTE",
    "Distributor Group nextAction is REQUEST_QUOTE"
  );

  assert(Boolean(groupFs), "Group 3: Floor Springs ENQUIRY_ONLY present");
  assert(
    groupFs?.checkoutEligibility?.canCheckout === false,
    "Floor Springs Group canCheckout is strictly false"
  );
  assert(
    groupFs?.checkoutEligibility?.nextAction === "REQUEST_QUOTE",
    "Floor Springs Group nextAction is REQUEST_QUOTE"
  );

  // ---------------------------------------------------------------------------
  // SECTION 7: P8.3 Idempotent Guest-to-Customer Cart Merge on Login
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: P8.3 Idempotent Guest-to-Customer Cart Merge ---");

  const mergeRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/merge",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerDelta.token}`,
      },
    },
    { guestSessionToken: guestCart.sessionToken }
  );
  if (mergeRes.status !== 200) {
    console.error("  [DEBUG merge failure]", mergeRes.status, mergeRes.data);
  }
  assert(mergeRes.status === 200, "Guest cart merged into Customer Delta account (200 OK)");
  const mergedCart = mergeRes.data?.cart;
  assert(
    mergedCart?.customerId === customerDelta.customerId,
    `Merged cart is now owned by Customer Delta (${customerDelta.customerId})`
  );
  assert(mergedCart?.lines?.length === 3, "All 3 items transferred to customer cart");

  // Verify guest cart was retired
  const retiredGuestCart = await client.query(
    `SELECT status FROM "dms_cart" WHERE id = $1`,
    [guestCart.id]
  );
  assert(
    retiredGuestCart.rows[0].status === "MERGED",
    "Guest cart status transitioned to MERGED in database"
  );

  // Idempotency: Second merge call does NOT duplicate lines
  const repeatMergeRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/merge",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerDelta.token}`,
      },
    },
    { guestSessionToken: guestCart.sessionToken }
  );
  assert(repeatMergeRes.status === 200, "Repeated merge call succeeded (200 OK)");
  assert(
    repeatMergeRes.data?.cart?.lines?.length === 3,
    "Idempotent merge: Line count remained 3 (NO duplicate lines inserted)"
  );

  // ---------------------------------------------------------------------------
  // SECTION 8: P8.4 & P8.5 Multi-Seller Checkout Intent & Quotation Scaffold
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: P8.4 & P8.5 Multi-Seller Checkout Intent & Quotation Scaffold ---");

  const intentRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/checkout-intent",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerDelta.token}`,
      },
    },
    { cartId: mergedCart.id, customerEmail: customerDelta.email }
  );
  assert(intentRes.status === 201, "Multi-seller checkout intent created (201 Created)");
  const intent = intentRes.data?.checkoutIntent;

  assert(Boolean(intent?.correlationId), `Generated multi-group correlationId: ${intent?.correlationId}`);
  assert(Boolean(intent?.directGroup?.orderDraftId), "Direct group generated test order draft ID");
  assert(
    intent?.distributorGroups?.length === 2,
    "Distributor & Floor Spring groups generated separate quote requests (NOT paid orders)"
  );

  // 8.1 Idempotency Key Support: Replay returns identical response with 200
  const testIdemKey = `idem_test_${Date.now()}`;
  const intentWithIdem = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/checkout-intent",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerDelta.token}`,
        "x-idempotency-key": testIdemKey,
      },
    },
    { cartId: mergedCart.id, customerEmail: customerDelta.email }
  );
  assert(intentWithIdem.status === 201, "Checkout intent with idempotency key created (201 Created)");

  // Replay with identical key and payload
  const replayIntent = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/checkout-intent",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerDelta.token}`,
        "x-idempotency-key": testIdemKey,
      },
    },
    { cartId: mergedCart.id, customerEmail: customerDelta.email }
  );
  assert(replayIntent.status === 200, "Replayed checkout intent returns 200 OK");
  assert(
    replayIntent.data?.checkoutIntent?.correlationId === intentWithIdem.data?.checkoutIntent?.correlationId,
    "Idempotency replay returns identical correlationId"
  );

  // Reused key with altered payload -> 409 Conflict
  const conflictIntent = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/checkout-intent",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerDelta.token}`,
        "x-idempotency-key": testIdemKey,
      },
    },
    { cartId: mergedCart.id, customerEmail: "different_tampered@example.com" }
  );
  assert(
    conflictIntent.status === 409 && conflictIntent.data?.code === "IDEMPOTENCY_CONFLICT",
    "Tampered payload with existing idempotency key rejected with 409 IDEMPOTENCY_CONFLICT"
  );

  // 8.2 Bounded quantity limits
  const hugeQtyRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/cart`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerDelta.token}`,
      },
    },
    { cartId: mergedCart.id, sku: "C-Clips-001", quantity: 50000 }
  );
  assert(
    hugeQtyRes.status === 400 && hugeQtyRes.data?.code === "VALIDATION_FAILED",
    "Excessive line quantity (>10000) rejected with 400 VALIDATION_FAILED"
  );

  // Verify database record in dms_mixed_seller_checkout_intent
  const dbIntent = await client.query(
    `SELECT * FROM "dms_mixed_seller_checkout_intent" WHERE correlation_id = $1`,
    [intent.correlationId]
  );
  assert(dbIntent.rows.length === 1, "Intent record persisted in dms_mixed_seller_checkout_intent");
  assert(dbIntent.rows[0].status === "DRAFT", "Intent record status is DRAFT");

  // Verify zero live payments, zero commingling
  const finSummary = await DistributorLifecycleService.getFinancialSeparationSummary(client);
  assert(
    finSummary.isRealGatewayEnabled === false,
    "DEC-002: Live payment gateway remains strictly false"
  );
  assert(
    finSummary.distributorCompletedResaleGmvPaise === 0,
    "Distributor completed resale GMV remains strictly 0 (no unauthorized revenue recognized)"
  );

  // ---------------------------------------------------------------------------
  // SECTION 9: Adversarial Ownership, Suspended Privacy, Null Tax & Concurrency
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Adversarial Security, Unverified Tax & Concurrency ---");

  // 9.1 Cross-Customer Cart Isolation: Dealer Gamma cannot read Customer Delta's merged cart
  const crossCustGet = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/store/sai-ajanta/cart?cartId=${mergedCart.id}`,
    method: "GET",
    headers: { Authorization: `Bearer ${dealerGamma.token}` },
  });
  assert(
    crossCustGet.status === 403 && crossCustGet.data?.code === "FORBIDDEN_CART_ACCESS",
    "Cross-customer isolation: Dealer Gamma blocked from reading Customer Delta's cart (403)"
  );

  // 9.2 Cross-Customer Checkout Intent Isolation
  const crossCustIntent = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart/checkout-intent",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dealerGamma.token}`,
      },
    },
    { cartId: mergedCart.id, customerEmail: dealerGamma.email }
  );
  assert(
    crossCustIntent.status === 403 && crossCustIntent.data?.code === "FORBIDDEN_CART_ACCESS",
    "Cross-customer isolation: Dealer Gamma blocked from checking out Customer Delta's cart (403)"
  );

  // 9.3 Suspended Trade Account Privacy (Fail-Closed to Retail Price)
  await client.query(
    `UPDATE "account_profile" SET status = 'SUSPENDED' WHERE customer_id = $1`,
    [dealerGamma.customerId]
  );
  const suspendedRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${dealerGamma.token}`,
      },
    },
    { sku: "C-Clips-001", postalCode: "620001" }
  );
  assert(
    suspendedRes.status === 200 && suspendedRes.data?.resolution?.unitPricePaise === 154000,
    "Suspended dealer fails closed to retail price ₹1540 (dealer tier ₹1350 strictly hidden)"
  );
  await client.query(
    `UPDATE "account_profile" SET status = 'ACTIVE' WHERE customer_id = $1`,
    [dealerGamma.customerId]
  );

  // 9.4 GET /store/sai-ajanta/seller-resolution query endpoint parity
  const getSellerRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/store/sai-ajanta/seller-resolution?sku=C-Clips-001&postalCode=620001",
    method: "GET",
  });
  assert(
    getSellerRes.status === 200 && getSellerRes.data?.resolution?.resolvedRoute === "SAI_AJANTHA_DIRECT",
    "GET /store/sai-ajanta/seller-resolution returns canonical SAI_AJANTHA_DIRECT route"
  );

  // 9.5 Safety Rule 6: Unverified (NULL) GST must NOT synthesize 18% GST and must force quote-only
  await client.query(
    `UPDATE "dms_product_import_row" SET gst_rate = NULL WHERE UPPER(sku) = 'C-CLIPS-001'`
  );
  const nullTaxAddRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/cart",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { sku: "C-Clips-001", quantity: 2, postalCode: "620001" }
  );
  const nullTaxGroup = nullTaxAddRes.data?.cart?.groups?.[0];
  assert(nullTaxAddRes.status === 201, "Null-GST SKU added to cart for quote evaluation (201)");
  assert(
    nullTaxGroup?.gstAmountPaise === 0,
    `Safety Rule 6: Null GST does NOT invent synthetic 18% tax (gstAmountPaise === ${nullTaxGroup?.gstAmountPaise})`
  );
  assert(
    nullTaxGroup?.isQuoteOnly === true && nullTaxGroup?.checkoutEligibility?.canCheckout === false,
    "Safety Rule 6: Null-GST direct group forced to quote-only (canCheckout === false)"
  );
  // Restore verified gst_rate
  await client.query(
    `UPDATE "dms_product_import_row" SET gst_rate = 18 WHERE UPPER(sku) = 'C-CLIPS-001'`
  );

  // 9.6 Concurrent 2-Worker Line Quantity Updates
  const targetLineId = mergedCart.lines[0].id;
  const [race1, race2] = await Promise.all([
    httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: `/store/sai-ajanta/cart/lines/${targetLineId}`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerDelta.token}`,
        },
      },
      { cartId: mergedCart.id, quantity: 5 }
    ),
    httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: `/store/sai-ajanta/cart/lines/${targetLineId}`,
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${customerDelta.token}`,
        },
      },
      { cartId: mergedCart.id, quantity: 6 }
    ),
  ]);
  assert(
    race1.status === 200 && race2.status === 200,
    "2-worker concurrent line quantity updates completed cleanly without 500 or DB error"
  );
  const finalRaceGet = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/store/sai-ajanta/cart?cartId=${mergedCart.id}`,
    method: "GET",
    headers: { Authorization: `Bearer ${customerDelta.token}` },
  });
  const finalLine = finalRaceGet.data?.cart?.lines?.find((l) => l.id === targetLineId);
  assert(
    finalLine && (finalLine.quantity === 5 || finalLine.quantity === 6),
    `Concurrent update left deterministic valid quantity (${finalLine?.quantity})`
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`PHASE 08 TEST SUITE COMPLETED: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================================\n");

  await client.end();
  process.exit(failedTests > 0 ? 1 : 0);
}

runPhase08Suite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});

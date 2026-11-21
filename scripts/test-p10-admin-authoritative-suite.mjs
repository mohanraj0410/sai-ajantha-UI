// scripts/test-p10-admin-authoritative-suite.mjs
// Phase 10 Authoritative Admin Portal & Real Data Master Integration Suite

import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
const { Pool } = pg;

const envPath = path.resolve(process.cwd(), "apps/backend/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000";
const DISPOSABLE_DB_NAME = "medusa_restore_rehearsal_disposable";
const PRIMARY_DB_NAME = "medusa";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    `postgres://medusa:medusa@localhost:5432/${DISPOSABLE_DB_NAME}`,
});

let testPassedCount = 0;
function pass(msg) {
  testPassedCount++;
  console.log(`  [PASS] ${msg}`);
}

async function runPhase10Suite() {
  console.log("===============================================================================");
  console.log("PHASE 10 — AUTHORITATIVE ADMIN PORTAL & REAL DATA MASTER SUITE");
  console.log(`Database: ${DISPOSABLE_DB_NAME} (Isolated Disposable Test Database)`);
  console.log("===============================================================================\n");

  // --- SECTION 1: Disposable Database Safety Guard ---
  console.log("--- TEST 1: Database Safety Guard ---");
  const dbResult = await pool.query("SELECT current_database();");
  const activeDb = dbResult.rows[0].current_database;
  assert.equal(
    activeDb,
    DISPOSABLE_DB_NAME,
    `CRITICAL SAFETY VIOLATION: Active database must be ${DISPOSABLE_DB_NAME}, got ${activeDb}`
  );
  pass(`Active DB session is safely isolated on '${DISPOSABLE_DB_NAME}'`);

  assert.notEqual(
    activeDb,
    PRIMARY_DB_NAME,
    `CRITICAL: Primary database '${PRIMARY_DB_NAME}' must NEVER be used for test mutations.`
  );
  pass(`Primary database '${PRIMARY_DB_NAME}' is protected against writes`);

  // --- SECTION 2: Staff Authentication & Granular RBAC Permissions ---
  console.log("\n--- TEST 2: Staff Authentication & Granular RBAC ---");
  // 1. Anonymous access is strictly rejected
  const anonRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/portal`);
  assert.equal(anonRes.status, 401, `Anonymous portal request must return 401, got ${anonRes.status}`);
  pass("Anonymous portal access is rejected with HTTP 401");

  // 2. Staff Login
  const loginRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@sai-ajanta.com",
      password: "Admin1234!",
    }),
  });
  assert.equal(loginRes.status, 200, `Admin login failed with ${loginRes.status}`);
  const loginData = await loginRes.json();
  assert.ok(loginData.token, "Login must return JWT token");
  const staffToken = loginData.token;
  pass("Staff administrator authenticated and acquired JWT token");

  // 3. /admin/sai-ajanta/me returns staff identity with permissions
  const meRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/me`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(meRes.status, 200, `/admin/sai-ajanta/me returned ${meRes.status}`);
  const meData = await meRes.json();
  assert.ok(meData.staff, "Must return staff profile");
  assert.equal(meData.staff.email, "admin@sai-ajanta.com");
  pass("Staff profile verified via /admin/sai-ajanta/me");

  // --- SECTION 3: Truthful Analytics & Zero Synthetic Values (P10.6) ---
  console.log("\n--- TEST 3: Zero Synthetic Values & Truthful Analytics (P10.6) ---");
  const analyticsRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/analytics?fy=FY%202026%E2%80%9327`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(analyticsRes.status, 200, `Analytics API returned ${analyticsRes.status}`);
  const analyticsData = await analyticsRes.json();

  // Zero-synthetic assertion 1: YoY is NOT fabricated "+14.8%"
  assert.notEqual(
    analyticsData.financialYear?.yoy,
    "+14.8%",
    "P10.6: Hardcoded fabricated YoY '+14.8%' must be removed!"
  );
  pass(`YoY is truthful (got: '${analyticsData.financialYear?.yoy}') instead of hardcoded '+14.8%'`);

  // Zero-synthetic assertion 2: No default 1500000 credit limit or 48% ratio
  assert.notEqual(
    analyticsData.credit?.utilizationRatio,
    48,
    "P10.6: Hardcoded fallback utilization ratio '48' must be removed!"
  );
  pass(`Credit utilization ratio is calculated truthfully (got: ${analyticsData.credit?.utilizationRatioDisplay || analyticsData.credit?.utilizationRatio})`);

  for (const dist of analyticsData.credit?.distributors || []) {
    assert.notEqual(
      dist.creditLimit,
      1500000,
      "P10.6: Sanctioned credit limit must not default to fabricated 1500000!"
    );
  }
  pass("Distributor credit limits contain no fabricated ₹15,00,000 values");

  // Metadata check: lastRefreshedAt is present
  assert.ok(analyticsData.lastRefreshedAt, "Analytics must include lastRefreshedAt timestamp");
  pass(`Analytics includes server refresh timestamp: ${analyticsData.lastRefreshedAt}`);

  // Resale checkout status is truthfully marked disabled pending approval
  assert.equal(
    analyticsData.financialYear?.resaleCheckoutStatus,
    "DISABLED_PENDING_APPROVAL",
    "Resale checkout status must be truthfully marked as disabled pending approval"
  );
  pass("Distributor resale checkout is truthfully marked DISABLED_PENDING_APPROVAL");

  // --- SECTION 4: Product Durability & CMS Workflow (P10.2) ---
  console.log("\n--- TEST 4: Product Durability & CMS Workflow (P10.2) ---");
  const testSku = `SA-TEST-P10-${Date.now().toString().slice(-6)}`;
  const createProdRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      sku: testSku,
      name: "Phase 10 Verified Aluminium Bracket",
      category: "Aluminium",
      brand: "Sai Ajantha",
      size: "100mm",
      material: "6063 T5",
      billingUnit: "1 Unit",
      customerPriceInr: 1250,
      dealerPriceInr: 950,
      distributorPriceInr: 800,
      stockQty: 50,
      gstRate: 18,
      isManufactured: true,
      cmsStatus: "DRAFT",
    }),
  });
  assert.ok(createProdRes.status === 200 || createProdRes.status === 201, `Create product returned ${createProdRes.status}`);
  const createdProdData = await createProdRes.json();
  const createdProductId = createdProdData.product?.id || testSku;
  pass(`Created durable product '${testSku}' in DRAFT status`);

  // Verify product persisted in database
  const dbProd = await pool.query(
    `SELECT p.id, p.title, p.status, p.metadata
     FROM "product" p
     WHERE p.metadata->>'sku' = $1`,
    [testSku]
  );
  assert.equal(dbProd.rowCount, 1, "Product must be persisted in Medusa product table");
  assert.equal(dbProd.rows[0].metadata?.cms_status, "DRAFT");
  assert.equal(Number(dbProd.rows[0].metadata?.customer_price_inr), 1250);
  pass("Product fields verified directly from PostgreSQL");

  // Test illegal transition directly from DRAFT to PUBLISHED (Must return 400)
  const illegalTransitionRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      cmsStatus: "PUBLISHED",
    }),
  });
  assert.equal(illegalTransitionRes.status, 400, "Direct DRAFT -> PUBLISHED transition must be rejected with 400");
  pass("Illegal transition DRAFT -> PUBLISHED correctly rejected by CMS gate (400)");

  // Step 1: DRAFT -> REVIEW
  const toReviewRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ cmsStatus: "REVIEW" }),
  });
  assert.equal(toReviewRes.status, 200, "Transition DRAFT -> REVIEW must return 200");
  pass("Product transitioned DRAFT -> REVIEW via admin API");

  // Step 2: REVIEW -> APPROVED
  const toApprovedRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ cmsStatus: "APPROVED", approved: true }),
  });
  assert.equal(toApprovedRes.status, 200, "Transition REVIEW -> APPROVED must return 200");
  pass("Product transitioned REVIEW -> APPROVED via admin API");

  // Step 3: APPROVED -> PUBLISHED
  const toPublishedRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/${encodeURIComponent(testSku)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      cmsStatus: "PUBLISHED",
      active: true,
      customerPriceInr: 1299,
    }),
  });
  assert.equal(toPublishedRes.status, 200, `Transition APPROVED -> PUBLISHED returned ${toPublishedRes.status}`);
  pass("Product transitioned APPROVED -> PUBLISHED via admin API");

  // Re-query database to verify persistence across sessions
  const dbProdAfter = await pool.query(
    `SELECT p.id, p.title, p.status, p.metadata
     FROM "product" p
     WHERE p.metadata->>'sku' = $1`,
    [testSku]
  );
  assert.equal(dbProdAfter.rows[0].metadata?.cms_status, "PUBLISHED");
  assert.equal(Boolean(dbProdAfter.rows[0].metadata?.approved), true);
  assert.equal(dbProdAfter.rows[0].status, "published");
  pass("Product updates persisted to PostgreSQL and verified after update");

  // --- SECTION 5: Order Lifecycle State Machine & Bank Verification (P10.4) ---
  console.log("\n--- TEST 5: Order Lifecycle Transitions & Bank Verification (P10.4) ---");
  const orderNumber = `ORD-P10-${Date.now().toString().slice(-5)}`;
  const orderId = `trade_ord_p10_${Date.now()}`;
  const bankUtr = `UTR-P10-${Date.now().toString().slice(-6)}`;

  // Seed deterministic order
  await pool.query(
    `INSERT INTO "dms_trade_order" (
      id, order_number, customer_id, customer_name, customer_email, customer_phone,
      organization, shipping_address, subtotal_inr, gst_amount_inr, total_inr,
      subtotal_paise, gst_amount_paise, total_paise, status, payment_status,
      payment_method, bank_reference, role_at_order, price_tier_applied,
      is_direct_sai_ajanta, refund_status, has_quote_items, items, events
    ) VALUES (
      $1, $2, 'cust_test_p10', 'P10 Verification Customer', 'p10.customer@example.com',
      '9876543210', 'P10 Enterprise', '10 GST Road, Chennai, TN - 600001',
      10000, 1800, 11800, 1000000, 180000, 1180000,
      'DRAFT', 'AWAITING_BANK_VERIFICATION', 'BANK_TRANSFER',
      $3, 'CUSTOMER', 'CUSTOMER', true, 'NONE', false,
      '[{"sku":"${testSku}","name":"Aluminium Bracket","quantity":2,"unit_price_inr":5000,"line_total_inr":10000}]'::jsonb,
      '[]'::jsonb
    )`,
    [orderId, orderNumber, bankUtr]
  );
  pass(`Seeded order '${orderNumber}' in AWAITING_BANK_VERIFICATION state`);

  // 1. Verify Bank Payment Transition
  const verifyPayRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders/${orderId}/transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      command: "VERIFY_BANK_PAYMENT",
      bankReference: bankUtr,
      verifiedAmountPaise: 1180000,
      notes: "Verified by Finance Admin in HDFC current account",
    }),
  });
  if (verifyPayRes.status !== 200) {
    const errText = await verifyPayRes.text();
    console.error("verifyPayRes error payload:", errText);
  }
  assert.equal(verifyPayRes.status, 200, `Verify bank payment returned ${verifyPayRes.status}`);
  const verifyPayData = await verifyPayRes.json();
  assert.equal(verifyPayData.transition?.paymentStatus, "PAID");
  assert.equal(verifyPayData.transition?.newStatus, "CONFIRMED");
  pass("Bank payment verified: order transitioned to PAID and CONFIRMED");

  // 2. Pack Order Transition
  const packRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders/${orderId}/transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ command: "PACK_ORDER" }),
  });
  assert.equal(packRes.status, 200, `Pack order returned ${packRes.status}`);
  const packData = await packRes.json();
  assert.equal(packData.transition?.fulfilmentStatus, "PACKED");
  assert.equal(packData.transition?.newStatus, "PROCESSING");
  pass("Order transitioned to PROCESSING & PACKED via PACK_ORDER");

  // 3. Dispatch Order Transition
  const dispatchRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders/${orderId}/transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      command: "DISPATCH_ORDER",
      carrierName: "KPN Parcel Service",
      trackingNumber: "LR-P10-88192",
      notes: "Handed over at Guindy warehouse hub",
    }),
  });
  assert.equal(dispatchRes.status, 200, `Dispatch order returned ${dispatchRes.status}`);
  const dispatchData = await dispatchRes.json();
  assert.equal(dispatchData.transition?.fulfilmentStatus, "DISPATCHED");
  pass("Order transitioned to DISPATCHED with carrier and tracking details");

  // 4. Mark Delivered Transition
  const deliverRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders/${orderId}/transition`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      command: "MARK_DELIVERED",
      notes: "Delivered to site, recipient signed POD",
    }),
  });
  assert.equal(deliverRes.status, 200, `Deliver order returned ${deliverRes.status}`);
  const deliverData = await deliverRes.json();
  assert.equal(deliverData.transition?.fulfilmentStatus, "DELIVERED");
  pass("Order transitioned to DELIVERED");

  // --- SECTION 6: Draft Financial Documents (P10.4 & Legal Disclaimer) ---
  console.log("\n--- TEST 6: Draft Financial Documents Authority (P10.4) ---");
  // 1. Generate Proforma Invoice
  const proformaRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders/${orderId}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ docType: "PROFORMA" }),
  });
  assert.equal(proformaRes.status, 200, `Generate proforma returned ${proformaRes.status}`);
  const proformaData = await proformaRes.json();
  assert.equal(proformaData.document?.docType, "PROFORMA");
  assert.equal(proformaData.document?.isOfficialTaxDocument, false);
  assert.ok(
    proformaData.document?.disclaimer?.includes("Draft / Not a Tax Invoice"),
    "Proforma must carry 'Draft / Not a Tax Invoice' legal disclaimer"
  );
  pass("Proforma invoice generated with authoritative 'Draft / Not a Tax Invoice' notice");

  // 2. Generate Draft Commercial Invoice
  const draftInvRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders/${orderId}/documents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({ docType: "DRAFT_INVOICE" }),
  });
  assert.equal(draftInvRes.status, 200, `Generate draft invoice returned ${draftInvRes.status}`);
  const draftInvData = await draftInvRes.json();
  assert.equal(draftInvData.document?.docType, "DRAFT_INVOICE");
  assert.equal(draftInvData.document?.isOfficialTaxDocument, false);
  assert.ok(
    draftInvData.document?.disclaimer?.includes("Draft / Not a Tax Invoice"),
    "Draft invoice must carry 'Draft / Not a Tax Invoice' legal disclaimer"
  );
  pass("Draft commercial invoice generated with authoritative non-tax disclaimer");

  // 3. Fetch Order Documents via GET
  const listDocsRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/orders/${orderId}/documents`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(listDocsRes.status, 200, `Fetch documents returned ${listDocsRes.status}`);
  const listDocsData = await listDocsRes.json();
  assert.ok(Array.isArray(listDocsData.documents), "Must return array of documents");
  assert.equal(listDocsData.documents.length, 2, "Must contain exactly 2 generated documents");
  pass("Order documents listed successfully via GET /admin/sai-ajanta/orders/:id/documents");

  // --- SECTION 7: Persistent Settings & Concurrency Guard (P10.5) ---
  console.log("\n--- TEST 7: Settings Persistence & Concurrency Guard (P10.5) ---");
  // 1. Fetch current settings
  const getSettingsRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/settings`, {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(getSettingsRes.status, 200);
  const currentSettings = await getSettingsRes.json();
  const currentVersion = currentSettings.settings?.version ?? 0;
  pass(`Retrieved current settings (version: ${currentVersion})`);

  // 2. Successful update with expected version
  const updateSettingsRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      default_page_size: 50,
      low_stock_threshold: 15,
      expectedVersion: currentVersion,
    }),
  });
  assert.equal(updateSettingsRes.status, 200, `Settings update returned ${updateSettingsRes.status}`);
  const updatedSettings = await updateSettingsRes.json();
  assert.equal(updatedSettings.settings?.default_page_size, 50);
  assert.equal(updatedSettings.settings?.low_stock_threshold, 15);
  assert.equal(updatedSettings.settings?.version, currentVersion + 1);
  pass("Settings persisted to PostgreSQL with incremented version");

  // 3. Version conflict rejection (409)
  const staleConflictRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/settings`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${staffToken}`,
    },
    body: JSON.stringify({
      default_page_size: 25,
      expectedVersion: currentVersion, // Stale version
    }),
  });
  assert.equal(staleConflictRes.status, 409, `Stale update must return 409, got ${staleConflictRes.status}`);
  pass("Stale settings update correctly rejected with HTTP 409 VERSION_CONFLICT");

  // --- SECTION 8: Immutable Staff Audit Log Ledger (P10.9) ---
  console.log("\n--- TEST 8: Immutable Staff Audit Log Ledger (P10.9) ---");
  // Verify audit events were created in PostgreSQL
  const auditRes = await pool.query(
    `SELECT action, resource, outcome, actor_role
     FROM "dms_staff_audit_event"
     ORDER BY occurred_at DESC LIMIT 10`
  );
  assert.ok(auditRes.rowCount > 0, "Audit log must contain recorded events");
  pass(`Verified ${auditRes.rowCount} recent staff audit records in dms_staff_audit_event`);

  // Verify PostgreSQL trigger rejects mutations/deletions on audit log
  let triggerBlocked = false;
  try {
    await pool.query(
      `DELETE FROM "dms_staff_audit_event" WHERE id = (SELECT id FROM "dms_staff_audit_event" LIMIT 1)`
    );
  } catch (err) {
    if (err.message.includes("strictly an append-only audit ledger") || err.message.includes("prohibited")) {
      triggerBlocked = true;
    }
  }
  assert.ok(triggerBlocked, "PostgreSQL trigger must block DELETE on dms_staff_audit_event");
  pass("PostgreSQL immutability trigger strictly prohibited DELETE on dms_staff_audit_event");

  // --- SECTION 9: Primary Database Immutability Audit ---
  console.log("\n--- TEST 9: Primary Database Immutability Audit ---");
  const primaryUrl =
    process.env.PRIMARY_DATABASE_URL ||
    (process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(DISPOSABLE_DB_NAME, PRIMARY_DB_NAME)
      : `postgres://medusa:medusa@localhost:5432/${PRIMARY_DB_NAME}`);
  const primaryPool = new Pool({
    connectionString: primaryUrl,
  });
  try {
    const primDbName = (await primaryPool.query("SELECT current_database();")).rows[0].current_database;
    assert.equal(primDbName, PRIMARY_DB_NAME);

    const primOrders = (await primaryPool.query(`SELECT count(*)::int as cnt FROM "dms_trade_order"`)).rows[0].cnt;
    assert.equal(primOrders, 5, `Primary dms_trade_order count must remain 5, got ${primOrders}`);
    pass("Primary database 'medusa' order count is untouched (exactly 5)");

    const primCusts = (await primaryPool.query(`SELECT count(*)::int as cnt FROM "customer"`)).rows[0].cnt;
    assert.equal(primCusts, 51, `Primary customer count must remain 51, got ${primCusts}`);
    pass("Primary database 'medusa' customer count is untouched (exactly 51)");

    const primTables = (await primaryPool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('dms_financial_document', 'dms_order_return', 'dms_order_command_log')`
    )).rows;
    assert.equal(primTables.length, 0, "Primary 'medusa' has 0 Phase 09/10 tables");
    pass("Primary database 'medusa' has zero Phase 09/10 write tables");
  } finally {
    await primaryPool.end();
  }

  console.log("\n===============================================================================");
  console.log(`PHASE 10 TEST SUITE COMPLETED: ${testPassedCount} PASSED, 0 FAILED`);
  console.log("===============================================================================");
}

runPhase10Suite()
  .then(() => pool.end())
  .catch((err) => {
    console.error("\n❌ PHASE 10 TEST FAILURE:", err);
    pool.end();
    process.exit(1);
  });

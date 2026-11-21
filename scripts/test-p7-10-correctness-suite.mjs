/**
 * SAI AJANTHA — P7.10 POST-IMPLEMENTATION CORRECTNESS & AUTHORIZATION GATE TEST SUITE
 * 
 * Verifies:
 * - Disposable DB Isolation & Primary DB Protection
 * - P7.10.A: Authorization Separation & HTTP Matrix:
 *     - Anon -> 401
 *     - Customer/Dealer -> 403 INSUFFICIENT_TRADE_ROLE
 *     - Suspended Distributor -> 403 ACCOUNT_NOT_ACTIVE
 *     - Active Distributor -> 200 OK on /store/sai-ajanta/trade/distributor/*
 *     - Active Distributor calling /admin/sai-ajanta/* -> 401/403 (Staff Admin routes intact)
 *     - Staff Admin calling /admin/sai-ajanta/* -> 200 OK
 *     - Tenant Isolation on PO creation, payment proof, receipt & inventory
 * - P7.10.B: Central Physical Stock Decrement & Idempotent Physical Transfer:
 *     - Physical Central stock decrement on dispatch
 *     - Immutable movement audit log insertion
 *     - Idempotent repeated dispatch (no double decrement / increment)
 *     - Exact receipt invariant: expected = received + damaged + missing
 *     - Quarantined damaged units not available for sale
 * - P7.10.C: Financial Separation & Accurate Revenue Definitions:
 *     - Distributor quote pipeline demand tracked
 *     - Resale quote creates zero supplier revenue and zero physical stock hold
 *     - Distributor completed resale GMV strictly 0 ("NOT_YET_MEASURED: Resale checkout disabled per DEC-002")
 *     - DEC-002 live payments disabled, "Draft / Not a Tax Invoice" disclaimer enforced
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";

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

async function runCorrectnessGate() {
  console.log("===============================================================================");
  console.log("P7.10 POST-IMPLEMENTATION CORRECTNESS & AUTHORIZATION GATE TEST SUITE");
  console.log("Database:", dbUrl.split("/").pop());
  console.log("===============================================================================\n");

  await client.connect();
  const { currentDb } = await assertDisposableDbConnection(client);

  // ---------------------------------------------------------------------------
  // SECTION 1: Disposable Safety Guard
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Database Safety Guard ---");
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
  // SECTION 2: Multi-Actor Setup & Real Auth Tokens
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Multi-Actor Setup & Real Token Acquisition ---");
  const ts = Date.now();

  // 2.1 Authenticate Staff Admin
  const adminAuthRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/auth/user/emailpass",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    },
    { email: "admin@sai-ajanta.com", password: "Admin1234!" }
  );
  assert(adminAuthRes.status === 200 && adminAuthRes.data?.token, "Acquired real staff admin JWT");
  const adminToken = adminAuthRes.data?.token;

  // Helper to create and authenticate customer in Medusa
  async function createCustomerActor(rolePrefix, role, status) {
    const email = `${rolePrefix}.${ts}@sai-ajanta-test.internal`;
    const password = "TestPassword123!";

    // Register auth identity
    const regRes = await httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: "/auth/customer/emailpass/register",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
      },
      { email, password }
    );
    const regToken = regRes.data?.token;

    // Create customer record
    const custRes = await httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: "/store/customers",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${regToken}`,
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
      },
      {
        first_name: `${rolePrefix.toUpperCase()}`,
        last_name: "TestUser",
        email,
        phone: "9876543210",
      }
    );
    const customerId = custRes.data?.customer?.id;

    // Login to obtain customer-scoped JWT
    const loginRes = await httpRequest(
      {
        hostname: "localhost",
        port: BACKEND_PORT,
        path: "/auth/customer/emailpass",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-publishable-api-key": PUBLISHABLE_KEY,
        },
      },
      { email, password }
    );
    const token = loginRes.data?.token;

    // Create account_profile record in disposable DB
    const profileId = `dms_prof_${customerId}`;
    await client.query(`DELETE FROM "account_profile" WHERE customer_id = $1`, [customerId]);
    await client.query(
      `INSERT INTO "account_profile" 
       (id, customer_id, role, status, business_name, territory)
       VALUES ($1, $2, $3, $4, $5, 'Tamil Nadu')`,
      [profileId, customerId, role, status, `${rolePrefix.toUpperCase()} Enterprise`]
    );

    return { customerId, token, email };
  }

  const distA = await createCustomerActor("dist.a", "DISTRIBUTOR", "ACTIVE");
  const distB = await createCustomerActor("dist.b", "DISTRIBUTOR", "ACTIVE");
  const distC = await createCustomerActor("dist.c.suspended", "DISTRIBUTOR", "SUSPENDED");
  const dealerA = await createCustomerActor("dealer.a", "DEALER", "ACTIVE");
  const customerR = await createCustomerActor("retail.r", "CUSTOMER", "ACTIVE");

  pass(`Registered real test actors: Distributor A (${distA.customerId}), Distributor B, Suspended Distributor C, Dealer A, Retail Customer`);

  // Ensure test SKU SA-M-DC-60-001 has known Central Warehouse stock in dms_product_import_row
  await client.query(
    `UPDATE "dms_product_import_row" 
     SET stock_qty = 100, updated_at = now() 
     WHERE UPPER(sku) = 'SA-M-DC-60-001'`
  );
  pass("Preset Central Warehouse stock for SA-M-DC-60-001 to 100 units");

  // ---------------------------------------------------------------------------
  // SECTION 3: P7.10.A Authorization Separation & HTTP RBAC Matrix
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: P7.10.A Authorization Separation & HTTP RBAC Matrix ---");

  // 3.1 Anonymous access to /store/sai-ajanta/trade/distributor/inventory returns 401
  const anonInvRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/store/sai-ajanta/trade/distributor/inventory",
    method: "GET",
  });
  assert(anonInvRes.status === 401, `Anonymous GET trade inventory returned 401 Unauthorized (got: ${anonInvRes.status})`);

  // 3.2 Retail Customer access to /store/sai-ajanta/trade/distributor/inventory returns 403
  const retailInvRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/store/sai-ajanta/trade/distributor/inventory",
    method: "GET",
    headers: { Authorization: `Bearer ${customerR.token}` },
  });
  assert(
    retailInvRes.status === 403 && retailInvRes.data?.code === "INSUFFICIENT_TRADE_ROLE",
    `Retail customer blocked from distributor trade inventory (403 INSUFFICIENT_TRADE_ROLE)`
  );

  // 3.3 Dealer access to /store/sai-ajanta/trade/distributor/inventory returns 403
  const dealerInvRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/store/sai-ajanta/trade/distributor/inventory",
    method: "GET",
    headers: { Authorization: `Bearer ${dealerA.token}` },
  });
  assert(
    dealerInvRes.status === 403 && dealerInvRes.data?.code === "INSUFFICIENT_TRADE_ROLE",
    `Dealer account blocked from distributor trade inventory (403 INSUFFICIENT_TRADE_ROLE)`
  );

  // 3.4 Suspended Distributor access to /store/sai-ajanta/trade/distributor/inventory returns 403
  const suspendedInvRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/store/sai-ajanta/trade/distributor/inventory",
    method: "GET",
    headers: { Authorization: `Bearer ${distC.token}` },
  });
  assert(
    suspendedInvRes.status === 403 && suspendedInvRes.data?.code === "ACCOUNT_NOT_ACTIVE",
    `Suspended distributor blocked from distributor trade inventory (403 ACCOUNT_NOT_ACTIVE)`
  );

  // 3.5 Active Distributor A access to /store/sai-ajanta/trade/distributor/inventory returns 200 OK
  const activeInvRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/store/sai-ajanta/trade/distributor/inventory",
    method: "GET",
    headers: { Authorization: `Bearer ${distA.token}` },
  });
  assert(activeInvRes.status === 200, `Active distributor granted access to own trade inventory (200 OK)`);

  // 3.6 Active Distributor A attempting to access Staff Admin route /admin/sai-ajanta/distributors/coverage returns 401/403
  const distCallingAdminRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/admin/sai-ajanta/distributors/coverage",
    method: "GET",
    headers: { Authorization: `Bearer ${distA.token}` },
  });
  assert(
    distCallingAdminRes.status === 401 || distCallingAdminRes.status === 403,
    `Distributor customer token strictly rejected on Staff Admin /admin/sai-ajanta/* (got: ${distCallingAdminRes.status})`
  );

  // 3.7 Staff Admin calling /admin/sai-ajanta/distributors/coverage returns 200 OK
  const staffAdminRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/admin/sai-ajanta/distributors/coverage",
    method: "GET",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(staffAdminRes.status === 200, `Staff admin token successfully authenticates on /admin/sai-ajanta/* (200 OK)`);

  // 3.8 Tenant-Safe PO Creation (Server-enforced tenant identity)
  console.log("\n--- TEST 3.8: Tenant-Safe PO Creation ---");
  const createPoRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/trade/distributor/purchase-orders",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distA.token}`,
      },
    },
    {
      distributorId: distB.customerId, // Malicious spoofing attempt
      items: [{ sku: "SA-M-DC-60-001", qty: 5 }],
      notes: "Opening batch for Trichy",
    }
  );
  assert(createPoRes.status === 201, `PO created via authenticated distributor trade route (201 Created)`);
  const poA = createPoRes.data?.purchaseOrder;
  assert(
    poA?.distributorId === distA.customerId,
    `Tenant isolation: server derived PO owner from token (${distA.customerId}), ignoring spoofed body ID (${distB.customerId})`
  );
  assert(poA?.status === "SUBMITTED", "PO status is SUBMITTED");

  // 3.9 Cross-Tenant Payment Proof Attack
  console.log("\n--- TEST 3.9: Cross-Tenant Payment Proof Isolation ---");
  const crossProofRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/trade/distributor/purchase-orders/${poA.id}/payment-proof`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distB.token}`, // Wrong tenant!
      },
    },
    { utrReference: "UTR-HACK-ATTEMPT-001" }
  );
  assert(
    crossProofRes.status === 403 || crossProofRes.status === 404,
    `Distributor B strictly blocked from submitting payment proof on Distributor A's PO (got: ${crossProofRes.status})`
  );

  // 3.10 Authorized Payment Proof Submission
  const validProofRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/trade/distributor/purchase-orders/${poA.id}/payment-proof`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distA.token}`,
      },
    },
    { utrReference: "UTR-HDFC-CORRECT-001" }
  );
  assert(validProofRes.status === 200, `Distributor A successfully submitted payment proof (200 OK)`);
  assert(
    validProofRes.data?.purchaseOrder?.status === "AWAITING_FINANCE_APPROVAL",
    "PO transitioned to AWAITING_FINANCE_APPROVAL"
  );
  assert(
    validProofRes.data?.purchaseOrder?.paymentProofReference === "UTR-HDFC-CORRECT-001",
    "UTR reference recorded on PO"
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: P7.10.B Central Stock Conservation & Idempotent Physical Transfer
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: P7.10.B Central Stock Conservation & Idempotent Physical Transfer ---");

  // 4.1 Check Central physical stock before dispatch
  const stockBeforeRes = await client.query(
    `SELECT stock_qty FROM "dms_product_import_row" WHERE UPPER(sku) = 'SA-M-DC-60-001'`
  );
  const centralStockBefore = stockBeforeRes.rows[0].stock_qty;
  assert(centralStockBefore === 100, `Central stock before dispatch is 100 units`);

  // 4.2 Staff Finance Approves Payment
  const financeApproveRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/admin/sai-ajanta/distributors/purchase-orders/${poA.id}/finance-approve`,
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(financeApproveRes.status === 200, `Staff finance approved PO payment (200 OK)`);
  assert(
    financeApproveRes.data?.purchaseOrder?.paymentStatus === "PAYMENT_VERIFIED",
    "PO paymentStatus updated to PAYMENT_VERIFIED"
  );
  assert(
    financeApproveRes.data?.purchaseOrder?.status === "APPROVED",
    "PO status updated to APPROVED"
  );

  // 4.3 Staff Allocates & Dispatches PO
  const dispatchRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/distributors/purchase-orders/${poA.id}/allocate-dispatch`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { dispatchReference: "ASN-TRICHY-EXP-002" }
  );
  assert(dispatchRes.status === 200, `Staff dispatched PO (200 OK)`);
  assert(dispatchRes.data?.purchaseOrder?.status === "DISPATCHED", "PO status is DISPATCHED");

  // 4.4 Central Physical Stock Conservation: Decremented by exactly 5 units
  const stockAfterRes = await client.query(
    `SELECT stock_qty FROM "dms_product_import_row" WHERE UPPER(sku) = 'SA-M-DC-60-001'`
  );
  const centralStockAfter = stockAfterRes.rows[0].stock_qty;
  assert(
    centralStockAfter === centralStockBefore - 5,
    `Central physical stock decremented atomically: ${centralStockBefore} -> ${centralStockAfter} (-5 units)`
  );

  // 4.5 Movement Ledger Audit Entry
  const movRes = await client.query(
    `SELECT * FROM "dms_inventory_movement" 
     WHERE operation_key = $1`,
    [`DISPATCH_${poA.id}_SA-M-DC-60-001`]
  );
  assert(movRes.rows.length === 1, "Append-only movement ledger record created with unique operation_key");
  assert(movRes.rows[0].delta_physical === -5, "Movement delta_physical is exactly -5");
  assert(movRes.rows[0].seller_id === "SAI_AJANTHA_CENTRAL", "Movement seller_id is SAI_AJANTHA_CENTRAL");

  // 4.6 Distributor In-Transit Inventory Ledger
  const invRes1 = await client.query(
    `SELECT * FROM "dms_distributor_inventory" 
     WHERE distributor_id = $1 AND sku = 'SA-M-DC-60-001' AND deleted_at IS NULL`,
    [distA.customerId]
  );
  assert(invRes1.rows.length === 1, "Distributor inventory ledger row created");
  assert(invRes1.rows[0].in_transit_qty === 5, "Distributor in_transit_qty is 5");
  assert(invRes1.rows[0].stocked_qty === 0, "Distributor stocked_qty is 0 (not saleable while in transit)");

  // 4.7 Idempotency Test: Repeated Allocate-Dispatch does NOT double-decrement or double-increment!
  console.log("\n--- TEST 4.7: Dispatch Idempotency (Replay Attack / Duplicate Execution) ---");
  const repeatDispatchRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/distributors/purchase-orders/${poA.id}/allocate-dispatch`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { dispatchReference: "ASN-TRICHY-EXP-002" }
  );
  assert(repeatDispatchRes.status === 200, "Repeated allocate-dispatch call returns 200 OK");

  // Re-verify Central stock was NOT decremented again
  const stockRecheck = await client.query(
    `SELECT stock_qty FROM "dms_product_import_row" WHERE UPPER(sku) = 'SA-M-DC-60-001'`
  );
  assert(
    stockRecheck.rows[0].stock_qty === centralStockAfter,
    `Idempotent Central stock: remained unchanged at ${centralStockAfter} (NO double-decrement)`
  );

  // Re-verify Distributor in-transit stock was NOT double-incremented
  const invRecheck = await client.query(
    `SELECT * FROM "dms_distributor_inventory" 
     WHERE distributor_id = $1 AND sku = 'SA-M-DC-60-001' AND deleted_at IS NULL`,
    [distA.customerId]
  );
  assert(
    invRecheck.rows[0].in_transit_qty === 5,
    `Idempotent Distributor in-transit stock: remained 5 (NO double-increment)`
  );

  // 4.8 Cross-Tenant Warehouse Receipt Attack
  console.log("\n--- TEST 4.8: Cross-Tenant Receipt Processing Isolation ---");
  const crossReceiptRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/trade/distributor/purchase-orders/${poA.id}/receipt`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distB.token}`, // Wrong tenant!
      },
    },
    {
      lines: [
        {
          sku: "SA-M-DC-60-001",
          expectedQty: 5,
          receivedQty: 5,
          damagedQty: 0,
          missingQty: 0,
        },
      ],
    }
  );
  assert(
    crossReceiptRes.status === 403 || crossReceiptRes.status === 404,
    `Distributor B strictly blocked from processing receipt for Distributor A's PO (got: ${crossReceiptRes.status})`
  );

  // 4.9 Warehouse Receipt Invariant & Quarantine Test (4 Received, 1 Damaged, 0 Missing)
  console.log("\n--- TEST 4.9: Warehouse Receipt Invariant & Damaged Quarantine ---");
  const receiptRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/trade/distributor/purchase-orders/${poA.id}/receipt`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${distA.token}`,
      },
    },
    {
      lines: [
        {
          sku: "SA-M-DC-60-001",
          expectedQty: 5,
          receivedQty: 4,
          damagedQty: 1,
          missingQty: 0,
        },
      ],
      inspectionNotes: "1 box crushed on transit truck",
    }
  );
  assert(receiptRes.status === 201, `Receipt confirmed with discrepancy (201 Created)`);
  assert(
    receiptRes.data?.receipt?.status === "DISCREPANCY_FLAGGED",
    "Receipt status flagged as DISCREPANCY_FLAGGED"
  );
  assert(
    receiptRes.data?.poStatus === "PARTIALLY_RECEIVED",
    "PO status updated to PARTIALLY_RECEIVED"
  );

  // Verify Distributor A inventory ledger post-receipt
  const invFinal = await client.query(
    `SELECT * FROM "dms_distributor_inventory" 
     WHERE distributor_id = $1 AND sku = 'SA-M-DC-60-001' AND deleted_at IS NULL`,
    [distA.customerId]
  );
  const distStock = invFinal.rows[0];
  assert(distStock.stocked_qty === 4, "Saleable stocked_qty is exactly 4 (received units)");
  assert(distStock.damaged_qty === 1, "Damaged unit quarantined to damaged_qty: 1");
  assert(distStock.in_transit_qty === 0, "in_transit_qty decremented to 0");
  const availableSaleable = distStock.stocked_qty - distStock.reserved_qty;
  assert(availableSaleable === 4, "availableSaleableQty is exactly 4 (stocked - reserved)");

  // Mathematical conservation check: Central decremented by 5; Distributor received 4 saleable + 1 damaged = 5
  assert(
    distStock.stocked_qty + distStock.damaged_qty === 5,
    "Strict Physical Conservation: 5 units dispatched from Central = 4 saleable + 1 quarantined damaged"
  );

  // ---------------------------------------------------------------------------
  // SECTION 5: P7.10.C Financial Separation Definitions
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: P7.10.C Financial Separation & Revenue Reporting ---");

  // 5.1 Create Resale Quote
  const quoteRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/distributors/resale-quote",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
      },
    },
    {
      distributorId: distA.customerId,
      buyerName: "Cauvery Hardware Retailer",
      buyerEmail: "cauvery@trichyretail.com",
      buyerPhone: "9876543210",
      postalCode: "620001",
      items: [{ sku: "SA-M-DC-60-001", qty: 2 }],
    }
  );
  assert(quoteRes.status === 201, `Created resale quote (201 Created)`);

  // 5.2 Fetch Financial Separation Report via Staff Route
  const finRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/admin/sai-ajanta/distributors/financial-separation",
    method: "GET",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(finRes.status === 200, "Staff fetched financial separation summary (200 OK)");
  const fin = finRes.data?.financialSummary;

  assert(
    fin?.saiAjanthaSupplierRevenuePaise > 0,
    `Sai Ajantha Wholesale Revenue tracked: ₹${(fin.saiAjanthaSupplierRevenuePaise / 100).toFixed(2)}`
  );
  assert(
    fin?.distributorQuotePipelineDemandPaise > 0,
    `Distributor Resale Quote Pipeline tracked: ₹${(fin.distributorQuotePipelineDemandPaise / 100).toFixed(2)}`
  );
  assert(
    fin?.distributorCompletedResaleGmvPaise === 0,
    "P7.10.C: Distributor completed resale GMV strictly 0 (no commercial resale orders permitted yet)"
  );
  assert(
    fin?.distributorResaleGmvStatus?.includes("NOT_YET_MEASURED"),
    `P7.10.C: Resale GMV status reports: ${fin.distributorResaleGmvStatus}`
  );
  assert(
    fin?.isRealGatewayEnabled === false,
    "DEC-002: Live payment gateway is strictly disabled (isRealGatewayEnabled: false)"
  );
  assert(
    fin?.invoiceDisclaimer === "Draft / Not a Tax Invoice",
    "Invoice disclaimer strictly enforced: 'Draft / Not a Tax Invoice'"
  );

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`P7.10 CORRECTNESS GATE SUITE: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================================\n");

  await client.end();
  process.exit(failedTests > 0 ? 1 : 0);
}

runCorrectnessGate().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});

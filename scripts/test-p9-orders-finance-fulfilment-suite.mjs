/**
 * SAI AJANTHA — PHASE 09 ORDERS, FINANCE, GST, FULFILMENT & RETURNS TEST SUITE
 *
 * Verifies:
 * - Disposable Database Isolation Guard (DEC-001)
 * - P9.1 & P9.2: Order Lifecycle Transitions, Command Invariants & Terminal Lockout
 * - P9.3: Tax Engine, Exact Paise, Intra/Inter-state Split & Missing GST Quote-Only Guard
 * - P9.4: Draft Financial Documents (Proforma, Draft Invoice, Credit Note) & Draft Disclaimer
 * - P9.5: Offline Bank Payment (UTR) Lifecycle & Staff Finance Verification Authorization
 * - P9.6: Fulfilment Dispatch, Tracking Reference, Return Inspection & Restock Ledger
 * - P9.7: Financial Reconciliation Summary, Net Invariant & Exception Queue
 * - P9.8: Multi-Tenant Access Isolation (Customer A vs Customer B Documents & Returns)
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";
import { TaxEngineService } from "../apps/backend/src/services/tax-engine.service.ts";
import { validateOrderTransition } from "../packages/types/src/contracts.ts";

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

async function runPhase09Suite() {
  console.log("===============================================================================");
  console.log("PHASE 09 — ORDERS, FINANCE, GST, FULFILMENT & RETURNS TEST SUITE");
  console.log("Database:", dbUrl.split("/").pop());
  console.log("===============================================================================\n");

  await client.connect();
  const { currentDb } = await assertDisposableDbConnection(client);

  // ---------------------------------------------------------------------------
  // SECTION 1: Database Safety & Target Guard (DEC-001)
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
  // SECTION 2: Tax Engine Unit & Mathematical Invariants
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Tax Calculation Engine & Invariants ---");

  // Intra-state (Tamil Nadu 33 -> Tamil Nadu 33): 50% CGST + 50% SGST
  const intraTax = TaxEngineService.calculateOrderTaxes(
    [
      { sku: "AJ-HINGE-01", quantity: 2, unitPricePaise: 100000, gstRatePercent: 18, hsnCode: "8302" }, // 2 * 1000 = 2000 INR
    ],
    { sellerStateCode: "33", buyerStateCode: "33" }
  );

  assert(intraTax.taxType === "INTRA_STATE", "Intra-state resolution detects matching state code 33");
  assert(intraTax.subtotalPaise === 200000, "Subtotal correctly calculated as 200,000 paise (Rs 2,000)");
  assert(intraTax.cgstPaise === 18000, "CGST correctly calculated as 9% = 18,000 paise (Rs 180)");
  assert(intraTax.sgstPaise === 18000, "SGST correctly calculated as 9% = 18,000 paise (Rs 180)");
  assert(intraTax.igstPaise === 0, "IGST is 0 for intra-state supply");
  assert(intraTax.totalTaxPaise === 36000, "Total tax matches CGST + SGST (36,000 paise)");
  assert(intraTax.grandTotalPaise === 236000, "Grand total mathematically conserves subtotal + tax (236,000 paise)");
  assert(intraTax.isTaxVerified === true, "Tax is verified when valid GST rate is present");
  assert(intraTax.requiresQuotation === false, "Does not require quotation when tax is verified");

  // Inter-state (Tamil Nadu 33 -> Karnataka 29): 100% IGST
  const interTax = TaxEngineService.calculateOrderTaxes(
    [
      { sku: "AJ-LOCK-01", quantity: 1, unitPricePaise: 500000, gstRatePercent: 18, hsnCode: "8301" }, // 5000 INR
    ],
    { sellerStateCode: "33", buyerStateCode: "29" }
  );

  assert(interTax.taxType === "INTER_STATE", "Inter-state resolution detects distinct state code 33 -> 29");
  assert(interTax.cgstPaise === 0, "CGST is 0 for inter-state supply");
  assert(interTax.sgstPaise === 0, "SGST is 0 for inter-state supply");
  assert(interTax.igstPaise === 90000, "IGST is 18% = 90,000 paise (Rs 900)");
  assert(interTax.grandTotalPaise === 590000, "Inter-state grand total is subtotal + IGST (590,000 paise)");

  // Missing GST Rate / Unverified GST Guard (Rule 6: Never synthesize 18%)
  const unverifiedTax = TaxEngineService.calculateOrderTaxes(
    [
      { sku: "AJ-UNKNOWN-01", quantity: 1, unitPricePaise: 100000, gstRatePercent: null },
    ],
    { sellerStateCode: "33", buyerStateCode: "33" }
  );

  assert(unverifiedTax.taxType === "UNVERIFIED", "Missing GST rate marks taxType as UNVERIFIED");
  assert(unverifiedTax.isTaxVerified === false, "isTaxVerified flags false");
  assert(unverifiedTax.totalTaxPaise === 0, "Zero synthetic tax computed on missing rate (totalTaxPaise = 0)");
  assert(unverifiedTax.requiresQuotation === true, "requiresQuotation flags true for missing GST rate");

  // ---------------------------------------------------------------------------
  // SECTION 3: State Machine Validation Contracts
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: State Machine Validation & Transition Guard ---");

  // Valid transitions
  assert(
    validateOrderTransition("PENDING_PAYMENT", "MARK_CONFIRMED").allowed === true,
    "PENDING_PAYMENT -> MARK_CONFIRMED is allowed"
  );
  assert(
    validateOrderTransition("CONFIRMED", "PACK_ORDER").allowed === true,
    "CONFIRMED -> PACK_ORDER is allowed"
  );
  assert(
    validateOrderTransition("PROCESSING", "DISPATCH_ORDER").allowed === true,
    "PROCESSING -> DISPATCH_ORDER is allowed"
  );
  assert(
    validateOrderTransition("PROCESSING", "MARK_DELIVERED").allowed === true,
    "PROCESSING -> MARK_DELIVERED is allowed"
  );

  // Illegal transitions
  assert(
    validateOrderTransition("CANCELLED", "MARK_CONFIRMED").allowed === false,
    "Terminal CANCELLED -> MARK_CONFIRMED is strictly disallowed"
  );
  assert(
    validateOrderTransition("COMPLETED", "CANCEL_ORDER").allowed === false,
    "Terminal COMPLETED -> CANCEL_ORDER is strictly disallowed"
  );
  assert(
    validateOrderTransition("PENDING_PAYMENT", "MARK_DELIVERED").allowed === false,
    "Premature PENDING_PAYMENT -> MARK_DELIVERED is strictly disallowed"
  );

  // ---------------------------------------------------------------------------
  // SECTION 4: Multi-Actor Setup & Real HTTP Integration
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Multi-Actor Setup & Staff Admin Authentication ---");
  const ts = Date.now();

  // 4.1 Authenticate Staff Admin
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

  // 4.2 Create Customer Actors
  async function createCustomerActor(rolePrefix) {
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
      { first_name: rolePrefix, last_name: "Customer", email, phone: "9876543210" }
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

    return { customerId, token, email };
  }

  const customerA = await createCustomerActor("cust.alpha");
  const customerB = await createCustomerActor("cust.beta");
  assert(customerA.customerId && customerA.token, "Created Customer A test fixture");
  assert(customerB.customerId && customerB.token, "Created Customer B test fixture");

  // ---------------------------------------------------------------------------
  // SECTION 5: Order Lifecycle Transitions via API
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Order Lifecycle Transitions via API ---");

  // Seed a test order for Customer A
  const testOrderId = `ord_test_${ts}`;
  const testOrderNumber = `SO-${ts.toString().slice(-6)}`;
  await client.query(
    `INSERT INTO "dms_trade_order"
     (id, order_number, customer_id, role_at_order, price_tier_applied, status, payment_status, payment_method,
      customer_name, customer_email, customer_phone, organization, shipping_address,
      subtotal_inr, gst_amount_inr, total_inr, has_quote_items, refund_status, items, events,
      fulfillment_type, is_direct_sai_ajanta, return_status, damaged_qty, damage_claim_status,
      delivery_attempts, fulfilment_status, bank_proof_status, place_of_supply_state_code)
     VALUES ($1, $2, $3, 'CUSTOMER', 'CUSTOMER', 'PENDING_PAYMENT', 'PENDING', 'Bank Transfer',
             $4, $5, '9876543210', 'Alpha Hardware', '123 Test St, Chennai, Tamil Nadu 600001',
             1000.00, 180.00, 1180.00, false, 'NONE', $6, '[]',
             'DELIVERY', true, 'NONE', 0, 'NONE',
             0, 'UNFULFILLED', 'NOT_SUBMITTED', '33')`,
    [
      testOrderId,
      testOrderNumber,
      customerA.customerId,
      "Customer Alpha",
      customerA.email,
      JSON.stringify([
        {
          sku: "AJ-TEST-01",
          name: "Test Heavy Duty Concealed Hinge",
          quantity: 2,
          unitPriceInr: 500,
          unitPricePaise: 50000,
          gstRate: 18,
          hsnCode: "8302",
        },
      ]),
    ]
  );
  pass("Created test order in database with PENDING_PAYMENT status");

  // 5.1 Staff executes MARK_CONFIRMED
  const confirmRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${testOrderId}/transition`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { command: "MARK_CONFIRMED", notes: "Order confirmed by staff" }
  );
  assert(confirmRes.status === 200, "Staff MARK_CONFIRMED returns 200 OK");
  assert(confirmRes.data?.transition?.newStatus === "CONFIRMED", "Order state transitioned to CONFIRMED");

  // 5.2 Staff executes PACK_ORDER
  const packRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${testOrderId}/transition`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { command: "PACK_ORDER", notes: "Packed at Central Logistics Hub" }
  );
  assert(packRes.status === 200, "Staff PACK_ORDER returns 200 OK");
  assert(packRes.data?.transition?.fulfilmentStatus === "PACKED", "Fulfilment state transitioned to PACKED");
  assert(packRes.data?.transition?.newStatus === "PROCESSING", "Order status transitioned to PROCESSING");

  // 5.3 Staff executes DISPATCH_ORDER with Carrier & Tracking Reference
  const dispatchRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${testOrderId}/transition`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    {
      command: "DISPATCH_ORDER",
      carrierName: "BlueDart Express",
      trackingNumber: "BD987654321IN",
      notes: "Handed over to carrier",
    }
  );
  assert(dispatchRes.status === 200, "Staff DISPATCH_ORDER returns 200 OK");
  assert(dispatchRes.data?.transition?.fulfilmentStatus === "DISPATCHED", "Fulfilment transitioned to DISPATCHED");

  // Verify carrier and tracking persisted in database
  const orderCheckRes = await client.query(
    `SELECT shipping_carrier, tracking_reference FROM "dms_trade_order" WHERE id = $1`,
    [testOrderId]
  );
  assert(
    orderCheckRes.rows[0].shipping_carrier === "BlueDart Express" &&
      orderCheckRes.rows[0].tracking_reference === "BD987654321IN",
    "Shipping carrier and tracking reference persisted accurately in database"
  );

  // 5.4 Staff executes MARK_DELIVERED
  const deliverRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${testOrderId}/transition`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { command: "MARK_DELIVERED", notes: "Delivered to customer" }
  );
  assert(deliverRes.status === 200, "Staff MARK_DELIVERED returns 200 OK");
  assert(deliverRes.data?.transition?.fulfilmentStatus === "DELIVERED", "Fulfilment transitioned to DELIVERED");
  assert(deliverRes.data?.transition?.newStatus === "COMPLETED", "Order status transitioned to COMPLETED");

  // 5.5 Illegal transition rejection: Attempting CANCEL on COMPLETED order fails
  const illegalCancelRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${testOrderId}/transition`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { command: "CANCEL_ORDER", cancellationReason: "Testing illegal cancel" }
  );
  assert(
    illegalCancelRes.status === 400,
    "Illegal transition (CANCEL on COMPLETED order) is strictly rejected with 400"
  );

  // 5.6 Command audit log check
  const cmdLogRes = await client.query(
    `SELECT command, previous_status, new_status FROM "dms_order_command_log" WHERE order_id = $1 ORDER BY created_at ASC`,
    [testOrderId]
  );
  assert(cmdLogRes.rows.length >= 4, "Every transition produced an immutable audit log entry");
  assert(
    cmdLogRes.rows[0].command === "MARK_CONFIRMED" &&
      cmdLogRes.rows[1].command === "PACK_ORDER" &&
      cmdLogRes.rows[2].command === "DISPATCH_ORDER" &&
      cmdLogRes.rows[3].command === "MARK_DELIVERED",
    "Audit log recorded commands in exact chronological order"
  );

  // ---------------------------------------------------------------------------
  // SECTION 6: Offline Bank Payment (UTR) Lifecycle & Verification
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Offline Bank Payment (UTR) Lifecycle ---");

  // Seed another order awaiting bank transfer
  const bankOrderId = `ord_bank_${ts}`;
  await client.query(
    `INSERT INTO "dms_trade_order"
     (id, order_number, customer_id, role_at_order, price_tier_applied, status, payment_status, payment_method,
      customer_name, customer_email, customer_phone, organization, shipping_address,
      subtotal_inr, gst_amount_inr, total_inr, has_quote_items, refund_status, items, events,
      fulfillment_type, is_direct_sai_ajanta, return_status, damaged_qty, damage_claim_status,
      delivery_attempts, fulfilment_status, bank_proof_status, place_of_supply_state_code)
     VALUES ($1, $2, $3, 'CUSTOMER', 'CUSTOMER', 'PENDING_PAYMENT', 'PENDING', 'Bank Transfer',
             $4, $5, '9876543210', 'Alpha Hardware', '123 Test St, Chennai, Tamil Nadu 600001',
             2118.64, 381.36, 2500.00, false, 'NONE', '[]', '[]',
             'DELIVERY', true, 'NONE', 0, 'NONE',
             0, 'UNFULFILLED', 'NOT_SUBMITTED', '33')`,
    [bankOrderId, `SO-B-${ts.toString().slice(-6)}`, customerA.customerId, "Customer Alpha", customerA.email]
  );

  // 6.1 Customer submits UTR proof
  const testUtrRef = `UTR${ts.toString().slice(-6)}${Math.random().toString(36).slice(-4)}`;
  const utrSubmitRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/orders/${bankOrderId}/bank-proof`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerA.token}`,
      },
    },
    { bankReference: testUtrRef, notes: "Transferred via NEFT" }
  );
  assert(utrSubmitRes.status === 200, "Customer submitting bank proof UTR returns 200 OK");
  assert(
    utrSubmitRes.data?.transition?.paymentStatus === "AWAITING_BANK_VERIFICATION",
    "Payment status transitions to AWAITING_BANK_VERIFICATION (not PAID)"
  );

  // Verify database status
  const bankCheck = await client.query(
    `SELECT payment_status, bank_proof_status, bank_reference FROM "dms_trade_order" WHERE id = $1`,
    [bankOrderId]
  );
  assert(
    bankCheck.rows[0].bank_proof_status === "UTR_SUBMITTED" &&
      bankCheck.rows[0].bank_reference === testUtrRef,
    "bank_proof_status is UTR_SUBMITTED and UTR reference is persisted"
  );

  // 6.2 Customer B attempting to submit bank proof for Customer A's order returns 403
  const forbiddenProofRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/orders/${bankOrderId}/bank-proof`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerB.token}`,
      },
    },
    { bankReference: "SPOOFED_UTR" }
  );
  assert(
    forbiddenProofRes.status === 403,
    "Cross-customer bank proof submission strictly rejected with 403 FORBIDDEN_ORDER_ACCESS"
  );

  // 6.3 Customer attempting to execute VERIFY_BANK_PAYMENT returns 401/403
  const customerVerifyRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${bankOrderId}/transition`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerA.token}`,
      },
    },
    { command: "VERIFY_BANK_PAYMENT" }
  );
  assert(
    customerVerifyRes.status === 401 || customerVerifyRes.status === 403,
    "Customer strictly prevented from calling administrative verification route (401/403)"
  );

  // 6.4 Authenticated Staff executes VERIFY_BANK_PAYMENT
  const staffVerifyRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${bankOrderId}/transition`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    {
      command: "VERIFY_BANK_PAYMENT",
      bankReference: "UTR202611189999",
      verifiedAmountPaise: 250000,
      notes: "Bank statement verified against HDFC current account",
    }
  );
  assert(staffVerifyRes.status === 200, "Finance staff VERIFY_BANK_PAYMENT returns 200 OK");
  assert(staffVerifyRes.data?.transition?.paymentStatus === "PAID", "Payment status transitioned to PAID");

  // Verify staff audit record
  const verifyDbCheck = await client.query(
    `SELECT bank_proof_status, bank_verified_by, bank_verified_at FROM "dms_trade_order" WHERE id = $1`,
    [bankOrderId]
  );
  assert(
    verifyDbCheck.rows[0].bank_proof_status === "VERIFIED" &&
      verifyDbCheck.rows[0].bank_verified_by !== null &&
      verifyDbCheck.rows[0].bank_verified_at !== null,
    "bank_proof_status is VERIFIED with bank_verified_by and bank_verified_at recorded"
  );

  // ---------------------------------------------------------------------------
  // SECTION 7: Draft Financial Documents & Disclaimers
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Draft Financial Documents & Disclaimers ---");

  // 7.1 Staff generates PROFORMA document
  const proformaRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${testOrderId}/documents`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { docType: "PROFORMA" }
  );
  assert(proformaRes.status === 200, "Staff generates PROFORMA document returns 200 OK");
  const proformaDoc = proformaRes.data?.document;
  assert(proformaDoc?.docType === "PROFORMA", "Document type is PROFORMA");
  assert(
    proformaDoc?.disclaimer === "Draft / Not a Tax Invoice",
    "Document contains mandatory 'Draft / Not a Tax Invoice' disclaimer"
  );
  assert(proformaDoc?.isOfficialTaxDocument === false, "isOfficialTaxDocument is explicitly false");

  // 7.2 Staff generates DRAFT_INVOICE document
  const draftInvRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/${testOrderId}/documents`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { docType: "DRAFT_INVOICE" }
  );
  assert(draftInvRes.status === 200, "Staff generates DRAFT_INVOICE returns 200 OK");
  assert(
    draftInvRes.data?.document?.docNumber.startsWith("INV-DRAFT-"),
    "Draft invoice number has INV-DRAFT- prefix"
  );

  // 7.3 Customer A fetches documents for their order
  const custDocRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/store/sai-ajanta/orders/${testOrderId}/documents`,
    method: "GET",
    headers: { Authorization: `Bearer ${customerA.token}` },
  });
  assert(custDocRes.status === 200, "Customer A fetches documents returns 200 OK");
  assert(custDocRes.data?.documents?.length >= 2, "Customer A receives both generated documents");

  // 7.4 Customer B attempting to fetch Customer A's documents returns 403
  const crossDocRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: `/store/sai-ajanta/orders/${testOrderId}/documents`,
    method: "GET",
    headers: { Authorization: `Bearer ${customerB.token}` },
  });
  assert(
    crossDocRes.status === 403,
    "Customer B attempting to fetch Customer A's documents returns 403 FORBIDDEN_ORDER_ACCESS"
  );

  // ---------------------------------------------------------------------------
  // SECTION 8: Returns Lifecycle, Inspection & Usable Restock Ledger
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Returns Lifecycle & Usable Restock Ledger ---");

  // Use verified catalog SKU from dms_product_import_row
  const testSku = "SA-M-DC-80-002";
  const initialStockRes = await client.query(
    `SELECT stock_qty FROM "dms_product_import_row" WHERE UPPER(sku) = $1`,
    [testSku]
  );
  const initialStock = Number(initialStockRes.rows[0]?.stock_qty || 50);

  // 8.1 Customer A submits Return Request
  const retReqRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/orders/${testOrderId}/return`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerA.token}`,
      },
    },
    {
      sku: testSku,
      quantity: 2,
      reason: "Item delivered with minor scratches",
      customerNotes: "Requesting replacement or credit note",
    }
  );
  assert(retReqRes.status === 201, "Customer submit return request returns 201 Created");
  const returnId = retReqRes.data?.returnRequest?.id;
  assert(returnId && retReqRes.data?.returnRequest?.status === "REQUESTED", "Return status is REQUESTED");

  // 8.2 Customer B attempting to submit return for Customer A's order returns 403
  const crossRetRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/store/sai-ajanta/orders/${testOrderId}/return`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${customerB.token}`,
      },
    },
    {
      sku: testSku,
      quantity: 1,
      reason: "Unauthorized attempt",
    }
  );
  assert(
    crossRetRes.status === 403,
    "Customer B attempting to submit return for Customer A's order returns 403 FORBIDDEN_ORDER_ACCESS"
  );

  // 8.3 Staff inspection quantity mismatch is rejected (sum != requested)
  const mismatchInspectRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/returns/${returnId}/inspect`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    { inspectedQtyAccepted: 1, inspectedQtyScrapped: 0 } // sum = 1, requested = 2
  );
  assert(
    mismatchInspectRes.status === 400,
    "Staff inspection quantity mismatch (sum != requested) is strictly rejected with 400"
  );

  // 8.4 Staff executes valid inspection: 1 accepted (usable), 1 scrapped
  const validInspectRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: `/admin/sai-ajanta/orders/returns/${returnId}/inspect`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
    },
    {
      inspectedQtyAccepted: 1,
      inspectedQtyScrapped: 1,
      notes: "1 unit verified undamaged; 1 unit packaging compromised and scrapped",
    }
  );
  assert(validInspectRes.status === 200, "Valid return inspection returns 200 OK");
  assert(
    validInspectRes.data?.inspection?.status === "INSPECTED_ACCEPTED",
    "Return status transitions to INSPECTED_ACCEPTED"
  );
  assert(validInspectRes.data?.inspection?.restockedQty === 1, "Restocked quantity recorded as 1");

  // 8.5 Verify inventory incremented only for usable accepted units
  const stockCheck = await client.query(
    `SELECT stock_qty FROM "dms_product_import_row" WHERE UPPER(sku) = $1`,
    [testSku]
  );
  assert(
    Number(stockCheck.rows[0].stock_qty) === initialStock + 1,
    `Catalog physical inventory restocked exactly by accepted units (${initialStock} -> ${initialStock + 1})`
  );

  // 8.6 Verify immutable inventory ledger entry in dms_inventory_movement
  const movCheck = await client.query(
    `SELECT * FROM "dms_inventory_movement" WHERE movement_type = 'RETURN_RESTOCK' AND operation_key = $1`,
    [`RETURN_RESTOCK_${returnId}_${testSku}`]
  );
  assert(
    movCheck.rows.length === 1 && Number(movCheck.rows[0].delta_physical) === 1,
    "dms_inventory_movement records immutable ledger entry for restocked units"
  );

  // ---------------------------------------------------------------------------
  // SECTION 9: Financial Reconciliation & Net Invariant
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 9: Financial Reconciliation & Net Invariants ---");

  // 9.1 Staff fetches reconciliation summary
  const reconRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/admin/sai-ajanta/orders/reconciliation",
    method: "GET",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert(reconRes.status === 200, "Staff fetching reconciliation summary returns 200 OK");
  const reconSummary = reconRes.data?.summary;
  assert(reconSummary?.totalOrders > 0, "Reconciliation summary contains totalOrders > 0");
  assert(
    typeof reconSummary?.collectedInr === "number" &&
      typeof reconSummary?.creditNoteInr === "number" &&
      typeof reconSummary?.netCollectionsInr === "number",
    "Reconciliation amounts are valid numbers"
  );
  assert(
    Math.abs(reconSummary.collectedInr - reconSummary.creditNoteInr - reconSummary.netCollectionsInr) < 0.001,
    "Net collection invariant holds exactly: collectedInr - creditNoteInr == netCollectionsInr"
  );

  // 9.2 Non-staff caller accessing reconciliation returns 401/403
  const forbiddenReconRes = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/admin/sai-ajanta/orders/reconciliation",
    method: "GET",
    headers: { Authorization: `Bearer ${customerA.token}` },
  });
  assert(
    forbiddenReconRes.status === 401 || forbiddenReconRes.status === 403,
    "Non-staff customer strictly blocked from reconciliation route (401/403)"
  );

  // ---------------------------------------------------------------------------
  // SECTION 10: Primary Database Immutability Audit
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 10: Primary Database Immutability Read-Only Audit ---");
  const primaryDbClient = new Client({
    connectionString: "postgres://medusa:medusa@localhost:5432/medusa",
  });
  try {
    await primaryDbClient.connect();
    const primaryOrders = await primaryDbClient.query(`SELECT COUNT(*)::int as count FROM "dms_trade_order"`);
    const primaryCustomers = await primaryDbClient.query(`SELECT COUNT(*)::int as count FROM "customer"`);
    const primaryReturns = await primaryDbClient.query(
      `SELECT to_regclass('public.dms_order_return') as return_tbl`
    );

    assert(primaryOrders.rows[0].count === 5, "Primary database 'medusa' trade_orders strictly unchanged (count = 5)");
    assert(primaryCustomers.rows[0].count === 51, "Primary database 'medusa' customers strictly unchanged (count = 51)");
    assert(
      primaryReturns.rows[0].return_tbl === null,
      "Primary database 'medusa' has 0 Phase 09 tables (strictly unmigrated & clean)"
    );
  } finally {
    await primaryDbClient.end();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY REPORT
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`PHASE 09 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  if (failedTests > 0) {
    console.error(`FAILED: ${failedTests} assertions failed.`);
    process.exit(1);
  } else {
    console.log("ALL PHASE 09 ASSERTIONS COMPLETED SUCCESSFULLY WITH ZERO DEFECTS.");
    console.log("===============================================================================");
  }

  await client.end();
}

runPhase09Suite().catch((err) => {
  console.error("Fatal exception during Phase 09 suite execution:", err);
  process.exit(1);
});

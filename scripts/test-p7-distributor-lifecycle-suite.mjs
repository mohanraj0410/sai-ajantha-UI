/**
 * SAI AJANTHA — PHASE 07 DISTRIBUTOR BUSINESS LIFECYCLE & INVENTORY TEST SUITE
 * 
 * Verifies P7.0 through P7.8 against isolated disposable database:
 * - Disposable DB Safety & Isolation Guard
 * - Distributor Coverage Assignment, Overlap Prevention & Suspension Revocation (P7.1)
 * - Supplier Stock PO Lifecycle, Floor Spring Blocking & Opening Stock Advisory (P7.2)
 * - Warehouse Receipt Reconciliation & Tenant-Scoped Inventory Ledger (P7.3)
 * - Server-Authoritative Seller Resolution & Resale Quote Scaffold (P7.4)
 * - Strict Financial Separation (Supplier Revenue vs Resale GMV) (P7.5)
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
} catch (e) {
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
    const req = http.request(options, (res) => {
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

async function runSuite() {
  console.log("===============================================================================");
  console.log("PHASE 07 — DISTRIBUTOR BUSINESS LIFECYCLE & INVENTORY SUITE");
  console.log("Database:", dbUrl.split("/").pop());
  console.log("===============================================================================\n");

  await client.connect();
  const { currentDb } = await assertDisposableDbConnection(client);

  // ---------------------------------------------------------------------------
  // SECTION 1: Disposable Database Safety Preflight
  // ---------------------------------------------------------------------------
  console.log("--- TEST 1: Disposable Database Safety Guard ---");
  try {
    assertDisposableDbTarget("postgres://medusa:secret@127.0.0.1:5432/medusa");
    fail("Safety guard failed to reject primary database 'medusa'");
  } catch (e) {
    pass("Safety guard rejects primary database 'medusa'");
  }

  assert(
    currentDb.includes("disposable") || currentDb.includes("test"),
    `Active database session is verified isolated (${currentDb})`
  );

  // ---------------------------------------------------------------------------
  // SECTION 2: Test Fixture Setup
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Multi-Actor Test Fixture Setup ---");

  // Clean up any previous test run records for idempotent testing
  await client.query(`DELETE FROM "dms_distributor_coverage" WHERE postal_code IN ('620001', '625001')`);
  await client.query(`DELETE FROM "dms_distributor_inventory" WHERE distributor_id LIKE 'dist_%'`);
  await client.query(`DELETE FROM "dms_distributor_po" WHERE distributor_id LIKE 'dist_%'`);
  await client.query(`DELETE FROM "dms_distributor_receipt" WHERE distributor_id LIKE 'dist_%'`);
  await client.query(`DELETE FROM "dms_distributor_resale_quote" WHERE distributor_id LIKE 'dist_%'`);
  await client.query(`DELETE FROM "account_profile" WHERE customer_id LIKE 'dist_%' OR customer_id LIKE 'dealer_%'`);

  const distA_id = `dist_a_${Date.now()}`;
  const distB_id = `dist_b_${Date.now()}`;
  const distC_id = `dist_c_suspended_${Date.now()}`;
  const dealerA_id = `dealer_a_${Date.now()}`;

  // Insert Distributor A (ACTIVE, Trichy)
  await client.query(
    `INSERT INTO "account_profile" (id, customer_id, role, status, business_name, territory)
     VALUES ($1, $2, 'DISTRIBUTOR', 'ACTIVE', 'Trichy Hardware Distributors', 'Tiruchirappalli')`,
    [`dms_prof_${distA_id}`, distA_id]
  );
  // Insert Distributor B (ACTIVE, Madurai)
  await client.query(
    `INSERT INTO "account_profile" (id, customer_id, role, status, business_name, territory)
     VALUES ($1, $2, 'DISTRIBUTOR', 'ACTIVE', 'Madurai Glass & Fittings Dist', 'Madurai')`,
    [`dms_prof_${distB_id}`, distB_id]
  );
  // Insert Distributor C (SUSPENDED)
  await client.query(
    `INSERT INTO "account_profile" (id, customer_id, role, status, business_name, territory)
     VALUES ($1, $2, 'DISTRIBUTOR', 'SUSPENDED', 'Defunct Traders Co', 'Salem')`,
    [`dms_prof_${distC_id}`, distC_id]
  );
  // Insert Dealer A (ACTIVE, linked to Distributor A)
  await client.query(
    `INSERT INTO "account_profile" (id, customer_id, role, status, business_name, parent_distributor_id)
     VALUES ($1, $2, 'DEALER', 'ACTIVE', 'Cauvery Retail Hardware', $3)`,
    [`dms_prof_${dealerA_id}`, dealerA_id, distA_id]
  );

  pass("Created test actors: DIST-A (Active), DIST-B (Active), DIST-C (Suspended), DEALER-A (Linked)");

  // ---------------------------------------------------------------------------
  // SECTION 3: Distributor Territory & Category Coverage (P7.1)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Territory & Category Coverage Rules (P7.1) ---");

  // Rule 3.1: Reject non-active distributors
  try {
    await DistributorLifecycleService.assignCoverage(client, {
      distributorId: distC_id,
      postalCode: "620001",
      categorySlug: "door-closer-floor-spring",
      assignedBy: "staff_super",
    });
    fail("Suspended distributor was erroneously assigned coverage");
  } catch (err) {
    assert(
      err.message.includes("not ACTIVE") || err.code === "DISTRIBUTOR_NOT_ACTIVE",
      "Assign coverage rejects SUSPENDED distributor (dist_c)"
    );
  }

  // Rule 3.2: Reject unauthorized direct categories
  try {
    await DistributorLifecycleService.assignCoverage(client, {
      distributorId: distA_id,
      postalCode: "620001",
      categorySlug: "finished-insect-screens",
      assignedBy: "staff_super",
    });
    fail("Direct catalog category was erroneously assigned for distributor resale");
  } catch (err) {
    assert(
      err.message.includes("not authorized for distributor resale"),
      "Assign coverage rejects direct catalog categories (Insect Screens)"
    );
  }

  // Rule 3.3: Successfully assign active coverage for Door Closers to Distributor A on PIN 620001
  const covA = await DistributorLifecycleService.assignCoverage(client, {
    distributorId: distA_id,
    postalCode: "620001",
    categorySlug: "door-closer-floor-spring",
    assignedBy: "staff_super",
    notes: "Trichy East primary coverage",
  });
  assert(covA.status === "ACTIVE", "Distributor A successfully assigned PIN 620001 for Door Closers");

  // Rule 3.4: Successfully assign Kitchen Baskets to Distributor A on PIN 620001
  const covA_kb = await DistributorLifecycleService.assignCoverage(client, {
    distributorId: distA_id,
    postalCode: "620001",
    categorySlug: "kitchen-basket",
    assignedBy: "staff_super",
    notes: "Trichy East kitchen line",
  });
  assert(covA_kb.status === "ACTIVE", "Distributor A successfully assigned PIN 620001 for Kitchen Baskets");

  // Rule 3.5: Conflict prevention — Distributor B cannot claim PIN 620001 for Door Closers
  try {
    await DistributorLifecycleService.assignCoverage(client, {
      distributorId: distB_id,
      postalCode: "620001",
      categorySlug: "door-closer-floor-spring",
      assignedBy: "staff_super",
    });
    fail("Overlapping active coverage was erroneously allowed");
  } catch (err) {
    assert(
      err.code === "COVERAGE_CONFLICT" || err.message.includes("Coverage conflict"),
      "Coverage conflict prevents duplicate active seller for same PIN and category"
    );
  }

  // Assign Distributor B to PIN 625001 (Madurai)
  const covB = await DistributorLifecycleService.assignCoverage(client, {
    distributorId: distB_id,
    postalCode: "625001",
    categorySlug: "door-closer-floor-spring",
    assignedBy: "staff_super",
  });
  assert(covB.status === "ACTIVE", "Distributor B assigned separate PIN 625001 (Madurai)");

  // Rule 3.6: Coverage revocation
  const revoked = await DistributorLifecycleService.revokeCoverage(
    client,
    covB.id,
    "staff_super",
    "Territory adjustment"
  );
  assert(revoked === true, "Staff can revoke distributor coverage");

  // Re-assign Distributor B to 625001
  await DistributorLifecycleService.assignCoverage(client, {
    distributorId: distB_id,
    postalCode: "625001",
    categorySlug: "door-closer-floor-spring",
    assignedBy: "staff_super",
  });

  // ---------------------------------------------------------------------------
  // SECTION 4: Distributor 'Buy Stock' PO Workflow (P7.2)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Distributor 'Buy Stock' PO Workflow (P7.2) ---");

  // Rule 4.1: Hydraulic Floor Springs strictly blocked per DEC-003
  try {
    await DistributorLifecycleService.createPurchaseOrder(client, {
      distributorId: distA_id,
      items: [{ sku: "SA-I-FS-TON90-007", qty: 5 }],
    });
    fail("Floor spring SKU was erroneously allowed on distributor stock PO");
  } catch (err) {
    assert(
      err.message.includes("Floor springs remain ENQUIRY_ONLY per DEC-003") ||
        err.message.includes("Floor Springs"),
      "Distributor PO strictly blocks Hydraulic Floor Springs per DEC-003"
    );
  }

  // Rule 4.2: Small PO creates successfully with advisory warning (₹3L target is proposed, not hard barrier)
  const poSmall = await DistributorLifecycleService.createPurchaseOrder(client, {
    distributorId: distA_id,
    items: [{ sku: "SA-M-DC-60-001", qty: 10 }], // 10 units of Door Closer (~₹11,480)
    notes: "Opening test batch",
  });
  assert(poSmall.status === "SUBMITTED", "PO created with status SUBMITTED");
  assert(poSmall.isBelowOpeningStockTarget === true, "PO under ₹3L correctly flags isBelowOpeningStockTarget: true");
  assert(
    poSmall.targetAdvisoryMessage?.includes("configurable policy"),
    "PO under ₹3L contains advisory guidance without blocking creation"
  );

  // Rule 4.3: Submit offline bank transfer payment proof
  const poWithUtr = await DistributorLifecycleService.submitPaymentProof(
    client,
    poSmall.id,
    distA_id,
    "UTR-HDFC-998877665544"
  );
  assert(
    poWithUtr.status === "AWAITING_FINANCE_APPROVAL",
    "Submitting offline transfer proof transitions PO to AWAITING_FINANCE_APPROVAL"
  );
  assert(
    poWithUtr.paymentProofReference === "UTR-HDFC-998877665544",
    "UTR payment reference persisted on PO"
  );

  // Rule 4.4: Finance approves payment
  const poApproved = await DistributorLifecycleService.financeApprovePayment(
    client,
    poSmall.id,
    "staff_finance_mgr"
  );
  assert(poApproved.paymentStatus === "PAYMENT_VERIFIED", "Finance approval marks paymentStatus: PAYMENT_VERIFIED");
  assert(poApproved.status === "APPROVED", "PO status transitions to APPROVED");

  // Rule 4.5: Staff allocates and dispatches inventory from Central Warehouse
  const poDispatched = await DistributorLifecycleService.allocateAndDispatchPo(
    client,
    poSmall.id,
    "ASN-TRICHY-EXP-001"
  );
  assert(poDispatched.status === "DISPATCHED", "PO status transitions to DISPATCHED");
  assert(poDispatched.dispatchReference === "ASN-TRICHY-EXP-001", "ASN tracking reference recorded");

  // Verify distributor's in-transit inventory ledger
  const invAfterDispatch = await DistributorLifecycleService.getDistributorInventory(
    client,
    distA_id,
    { role: "STAFF" }
  );
  const dcItem = invAfterDispatch.find((i) => i.sku === "SA-M-DC-60-001");
  assert(dcItem?.inTransitQty === 10, "Distributor inventory shows inTransitQty: 10");
  assert(dcItem?.stockedQty === 0, "Stocked quantity remains 0 while in transit (not saleable yet)");

  // ---------------------------------------------------------------------------
  // SECTION 5: Warehouse Receipt & Inventory Ledger (P7.3)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Warehouse Receipt & Inventory Transfer (P7.3) ---");

  // Rule 5.1: Tenant Isolation — Distributor B cannot receive Distributor A's goods
  try {
    await DistributorLifecycleService.processWarehouseReceipt(client, {
      poId: poSmall.id,
      distributorId: distB_id, // Wrong tenant!
      lines: [
        {
          sku: "SA-M-DC-60-001",
          expectedQty: 10,
          receivedQty: 10,
          damagedQty: 0,
          missingQty: 0,
        },
      ],
      verifiedBy: distB_id,
    });
    fail("Cross-tenant receipt processing was erroneously allowed");
  } catch (err) {
    assert(
      err.code === "CROSS_TENANT_VIOLATION" || err.message.includes("Tenant violation"),
      "Tenant isolation blocks Distributor B from receiving Distributor A's PO"
    );
  }

  // Rule 5.2: Invariant Check — expectedQty must equal received + damaged + missing
  try {
    await DistributorLifecycleService.processWarehouseReceipt(client, {
      poId: poSmall.id,
      distributorId: distA_id,
      lines: [
        {
          sku: "SA-M-DC-60-001",
          expectedQty: 10,
          receivedQty: 7,
          damagedQty: 1,
          missingQty: 0, // 7 + 1 + 0 = 8 !== 10
        },
      ],
      verifiedBy: distA_id,
    });
    fail("Mathematical reconciliation mismatch was erroneously accepted");
  } catch (err) {
    assert(
      err.message.includes("Quantity mismatch") || err.code === "VALIDATION_FAILED",
      "Receipt validation enforces expectedQty === received + damaged + missing"
    );
  }

  // Rule 5.3: Process Receipt with Discrepancy (8 Received, 1 Damaged, 1 Missing)
  const receiptResult = await DistributorLifecycleService.processWarehouseReceipt(client, {
    poId: poSmall.id,
    distributorId: distA_id,
    lines: [
      {
        sku: "SA-M-DC-60-001",
        expectedQty: 10,
        receivedQty: 8,
        damagedQty: 1,
        missingQty: 1,
      },
    ],
    inspectionNotes: "1 box crushed during transit, 1 piece missing from carton",
    verifiedBy: distA_id,
  });

  assert(
    receiptResult.receipt.status === "DISCREPANCY_FLAGGED",
    "Receipt with damaged/missing items flagged as DISCREPANCY_FLAGGED"
  );
  assert(
    receiptResult.poStatus === "PARTIALLY_RECEIVED",
    "PO status transitions to PARTIALLY_RECEIVED"
  );

  // Rule 5.4: Verify updated inventory ledger
  const invAfterReceipt = await DistributorLifecycleService.getDistributorInventory(
    client,
    distA_id,
    { role: "DISTRIBUTOR", distributorId: distA_id }
  );
  const dcAfterReceipt = invAfterReceipt.find((i) => i.sku === "SA-M-DC-60-001");
  assert(dcAfterReceipt?.stockedQty === 8, "Saleable stockedQty is exactly 8 (received units)");
  assert(dcAfterReceipt?.damagedQty === 1, "Damaged unit quarantined to damagedQty: 1");
  assert(dcAfterReceipt?.inTransitQty === 0, "inTransitQty decremented to 0");
  assert(dcAfterReceipt?.availableSaleableQty === 8, "availableSaleableQty is 8 (stocked - reserved)");

  // Rule 5.5: Cross-tenant inventory privacy
  try {
    await DistributorLifecycleService.getDistributorInventory(client, distA_id, {
      role: "DISTRIBUTOR",
      distributorId: distB_id, // Distributor B trying to view Distributor A's inventory
    });
    fail("Cross-distributor inventory read was erroneously permitted");
  } catch (err) {
    assert(
      err.code === "CROSS_TENANT_VIOLATION" || err.message.includes("Tenant isolation"),
      "Distributor B strictly blocked from viewing Distributor A's inventory (403)"
    );
  }

  // Rule 5.6: SKU Reconciliation Report
  const recon = await DistributorLifecycleService.getInventoryReconciliationReport(client, distA_id);
  const reconItem = recon.items.find((i) => i.sku === "SA-M-DC-60-001");
  assert(reconItem?.isReconciled === true, "SKU reconciliation balance is verified consistent");
  assert(reconItem?.receivedQty === 8, "Reconciliation report shows 8 received");
  assert(reconItem?.damagedQuarantineQty === 1, "Reconciliation report shows 1 damaged quarantine");

  // ---------------------------------------------------------------------------
  // SECTION 6: Territory Resolution & Resale Quote Scaffold (P7.4)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 6: Territory Seller Resolution & Resale Quote (P7.4) ---");

  // Rule 6.1: Active PIN match -> Resolves Distributor A
  const resMatched = await DistributorLifecycleService.resolveSellerForTerritory(client, {
    postalCode: "620001",
    categorySlug: "door-closer-floor-spring",
  });
  assert(
    resMatched.resolvedRoute === "DISTRIBUTOR_RESALE",
    "Resolved route for covered PIN 620001 is DISTRIBUTOR_RESALE"
  );
  assert(
    resMatched.sellerId === distA_id,
    `Resolved seller matches Distributor A (${distA_id})`
  );

  // Rule 6.2: Unserved PIN -> Route to Manual Enquiry
  const resUnserved = await DistributorLifecycleService.resolveSellerForTerritory(client, {
    postalCode: "600001", // Chennai (no active distributor assigned)
    categorySlug: "door-closer-floor-spring",
  });
  assert(
    resUnserved.resolvedRoute === "ENQUIRY_ONLY",
    "Unserved PIN 600001 routes to ENQUIRY_ONLY"
  );
  assert(
    resUnserved.reason.includes("manual enquiry queue"),
    "Unserved PIN reason indicates manual enquiry queue"
  );

  // Rule 6.3: Floor Springs SKU -> Always ENQUIRY_ONLY (DEC-003)
  const resFloorSpring = await DistributorLifecycleService.resolveSellerForTerritory(client, {
    postalCode: "620001",
    categorySlug: "door-closer-floor-spring",
    sku: "SA-I-FS-TON90-007",
  });
  assert(
    resFloorSpring.resolvedRoute === "ENQUIRY_ONLY",
    "Floor Springs SKU strictly resolves to ENQUIRY_ONLY regardless of distributor PIN"
  );
  assert(
    resFloorSpring.isQuoteOnly === true,
    "Floor Springs isQuoteOnly is strictly true"
  );

  // Rule 6.4: Direct 9 Categories -> Always SAI_AJANTHA_DIRECT
  const resDirect = await DistributorLifecycleService.resolveSellerForTerritory(client, {
    postalCode: "620001",
    categorySlug: "finished-insect-screens",
  });
  assert(
    resDirect.resolvedRoute === "SAI_AJANTHA_DIRECT",
    "Direct category resolves to SAI_AJANTHA_DIRECT from Central Warehouse"
  );

  // Rule 6.5: Suspension immediately invalidates territory resolution
  await DistributorLifecycleService.suspendDistributorCoverages(client, distA_id);
  const resAfterSuspension = await DistributorLifecycleService.resolveSellerForTerritory(client, {
    postalCode: "620001",
    categorySlug: "door-closer-floor-spring",
  });
  assert(
    resAfterSuspension.resolvedRoute === "ENQUIRY_ONLY",
    "Suspension of Distributor A immediately invalidates coverage -> routes to ENQUIRY_ONLY"
  );

  // Re-instate coverage for resale quote testing
  await client.query(
    `UPDATE "dms_distributor_coverage" SET status = 'ACTIVE' WHERE distributor_id = $1`,
    [distA_id]
  );

  // Rule 6.6: Resale Quote Scaffold (does NOT hold or decrement stock)
  const quoteResult = await DistributorLifecycleService.createResaleQuote(client, {
    distributorId: distA_id,
    buyerId: dealerA_id,
    buyerRole: "DEALER",
    buyerName: "Cauvery Hardware Retailer",
    buyerEmail: "cauvery@trichyretail.com",
    buyerPhone: "9876543210",
    postalCode: "620001",
    items: [{ sku: "SA-M-DC-60-001", qty: 4 }],
  });
  assert(quoteResult.status === "REQUESTED", "Resale quote created with status REQUESTED");

  // Verify stock was NOT decremented by quote
  const invAfterQuote = await DistributorLifecycleService.getDistributorInventory(
    client,
    distA_id,
    { role: "STAFF" }
  );
  const dcAfterQuote = invAfterQuote.find((i) => i.sku === "SA-M-DC-60-001");
  assert(
    dcAfterQuote?.stockedQty === 8 && dcAfterQuote?.reservedQty === 0,
    "Quotes strictly bypass stock reservation (stockedQty remains 8, reservedQty remains 0)"
  );

  // ---------------------------------------------------------------------------
  // SECTION 7: Strict Financial Separation (P7.5)
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 7: Financial Separation & Revenue Isolation (P7.5) ---");

  const finSummary = await DistributorLifecycleService.getFinancialSeparationSummary(client);
  assert(
    finSummary.saiAjanthaSupplierRevenuePaise > 0,
    `Sai Ajantha Wholesale Revenue tracked: ₹${(finSummary.saiAjanthaSupplierRevenuePaise / 100).toFixed(2)}`
  );
  assert(
    finSummary.distributorQuotePipelineDemandPaise > 0,
    `Distributor Resale Quote Pipeline tracked: ₹${(finSummary.distributorQuotePipelineDemandPaise / 100).toFixed(2)}`
  );
  assert(
    finSummary.distributorCompletedResaleGmvPaise === 0,
    "P7.10.C: Distributor completed resale GMV strictly 0 (no commercial resale orders permitted yet)"
  );
  assert(
    finSummary.distributorResaleGmvStatus.includes("NOT_YET_MEASURED"),
    `P7.10.C: Resale GMV status reports: ${finSummary.distributorResaleGmvStatus}`
  );
  assert(
    finSummary.isRealGatewayEnabled === false,
    "DEC-002: Live payment gateway is strictly disabled (isRealGatewayEnabled: false)"
  );
  assert(
    finSummary.invoiceDisclaimer === "Draft / Not a Tax Invoice",
    "Invoice disclaimer strictly enforced: 'Draft / Not a Tax Invoice'"
  );

  // ---------------------------------------------------------------------------
  // SECTION 8: HTTP Endpoints Integration Test
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 8: Backend HTTP API Surface Integration ---");

  // 8.1 Seller Resolution Public API
  const httpResRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
      },
    },
    { postalCode: "620001", categorySlug: "door-closer-floor-spring" }
  );
  assert(httpResRes.status === 200, `POST /store/sai-ajanta/seller-resolution returned 200 OK (got: ${httpResRes.status})`);
  assert(
    httpResRes.data?.resolution?.resolvedRoute === "DISTRIBUTOR_RESALE",
    "HTTP Seller Resolution returns DISTRIBUTOR_RESALE"
  );

  // 8.2 Floor Springs Resolution via HTTP
  const httpFsRes = await httpRequest(
    {
      hostname: "localhost",
      port: BACKEND_PORT,
      path: "/store/sai-ajanta/seller-resolution",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-publishable-api-key": PUBLISHABLE_KEY,
      },
    },
    { postalCode: "620001", categorySlug: "door-closer-floor-spring", sku: "SA-I-FS-TON90-007" }
  );
  assert(httpFsRes.status === 200, "POST Floor Springs resolution returned 200 OK");
  assert(
    httpFsRes.data?.resolution?.resolvedRoute === "ENQUIRY_ONLY",
    "HTTP Floor Springs resolution is strictly ENQUIRY_ONLY"
  );

  // 8.3 Resale Quote Public API
  const httpQuoteRes = await httpRequest(
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
      distributorId: distA_id,
      buyerName: "Thanjavur Builder",
      buyerEmail: "builder@thanjavur.com",
      buyerPhone: "9876543211",
      postalCode: "620001",
      items: [{ sku: "SA-M-DC-60-001", qty: 2 }],
    }
  );
  assert(httpQuoteRes.status === 201, `POST /store/sai-ajanta/distributors/resale-quote returned 201 Created (got: ${httpQuoteRes.status})`);
  assert(
    httpQuoteRes.data?.status === "REQUESTED",
    "HTTP Resale Quote returned status: REQUESTED"
  );

  // 8.4 Anonymous request to /admin/sai-ajanta/distributors/coverage returns 401
  const httpAnonCoverage = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/admin/sai-ajanta/distributors/coverage",
    method: "GET",
  });
  assert(
    httpAnonCoverage.status === 401,
    `Anonymous GET /admin/sai-ajanta/distributors/coverage returned 401 Unauthorized (got: ${httpAnonCoverage.status})`
  );

  // 8.5 Anonymous request to /admin/sai-ajanta/distributors/purchase-orders returns 401
  const httpAnonPo = await httpRequest({
    hostname: "localhost",
    port: BACKEND_PORT,
    path: "/admin/sai-ajanta/distributors/purchase-orders",
    method: "GET",
  });
  assert(
    httpAnonPo.status === 401,
    `Anonymous GET /admin/sai-ajanta/distributors/purchase-orders returned 401 Unauthorized (got: ${httpAnonPo.status})`
  );

  // ---------------------------------------------------------------------------
  // SECTION 9: Summary & Acceptance
  // ---------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(`PHASE 07 TEST SUITE COMPLETED: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log("===============================================================================\n");

  await client.end();
  process.exit(failedTests > 0 ? 1 : 0);
}

runSuite().catch((err) => {
  console.error("Test Suite Fatal Error:", err);
  process.exit(1);
});

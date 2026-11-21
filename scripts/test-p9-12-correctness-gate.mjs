/**
 * SAI AJANTHA — P9.12 FINANCE, INVENTORY & RELEASE CORRECTNESS GATE
 *
 * Verifies:
 * - P9.12.0: Disposable Database Session Guard & Primary DB Protection
 * - P9.12.1: Authoritative Physical Inventory Restock, Medusa inventory_level sync & Inspection Idempotency
 * - P9.12.2: Authentic Bank Payment Verification, Duplicate UTR Replay Prevention & Finance Role Separation
 * - P9.12.3: Place of Supply & Indian Postal Code Verification (No Tax Guesswork)
 * - P9.12.4: Financial Document Draft Authority & Mandatory 'Draft / Not a Tax Invoice' Disclaimer
 * - P9.12.5: Cross-Tenant Customer & Distributor Isolation
 */

import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import dotenv from "../apps/backend/node_modules/dotenv/dist/index.cjs";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";
import { TaxEngineService } from "../apps/backend/src/services/tax-engine.service.ts";
import { OrderLifecycleService } from "../apps/backend/src/services/order-lifecycle.service.ts";

process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";

const envPath = path.resolve(process.cwd(), "apps/backend/.env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const dbUrl = process.env.DISPOSABLE_DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("FATAL: DATABASE_URL must be defined");
  process.exit(1);
}

const Client = pg.Client || pg.default?.Client || pg.default;
const client = new Client({ connectionString: dbUrl });
await client.connect();

let totalAssertions = 0;
let passedAssertions = 0;

function assert(condition, message) {
  totalAssertions++;
  if (condition) {
    passedAssertions++;
    console.log(`  [PASS] ${message}`);
  } else {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log("===============================================================================");
  console.log("P9.12 FINAL FINANCE, INVENTORY & RELEASE CORRECTNESS GATE");
  console.log("===============================================================================\n");

  // --- GATE 1: DATABASE SAFETY & SESSION GUARD ---
  console.log("--- GATE 1: Database Safety & Session Guard ---");
  try {
    assertDisposableDbTarget("postgres://user:pass@localhost:5432/medusa");
    assert(false, "Should have thrown on primary 'medusa'");
  } catch (err) {
    assert(err.message.includes("DATA_SAFETY_GUARD") && err.message.includes("primary database"), "Guard rejects primary database 'medusa'");
  }

  const dbRes = await client.query("SELECT current_database()");
  const activeDb = dbRes.rows[0].current_database;
  assert(activeDb === "medusa_restore_rehearsal_disposable", `Active database is strictly disposable (${activeDb})`);
  await assertDisposableDbConnection(client);
  assert(true, "assertDisposableDbConnection passes on disposable database");

  // --- GATE 2: GST & POSTAL CODE VERIFICATION (NO TAX GUESSWORK) ---
  console.log("\n--- GATE 2: Place of Supply & Indian Postal Code Verification ---");
  const tnCode = TaxEngineService.resolveStateCodeFromPostalCode("620001");
  assert(tnCode === "33", "Tamil Nadu PIN (620001) resolves to state code '33'");

  const kaCode = TaxEngineService.resolveStateCodeFromPostalCode("560001");
  assert(kaCode === "29", "Karnataka PIN (560001) resolves to state code '29'");

  const klCode = TaxEngineService.resolveStateCodeFromPostalCode("682001");
  assert(klCode === "32", "Kerala PIN (682001) resolves to state code '32'");

  const invalidPin = TaxEngineService.resolveStateCodeFromPostalCode("999999");
  assert(invalidPin === null, "Unregistered/unknown PIN returns null (no guesswork)");

  const malformedPin = TaxEngineService.resolveStateCodeFromPostalCode("ABC123");
  assert(malformedPin === null, "Malformed PIN returns null");

  const unverifiedTaxCalc = TaxEngineService.calculateOrderTaxes(
    [{ sku: "TEST-SKU", quantity: 1, unitPricePaise: 10000, gstRatePercent: 18 }],
    { buyerPostalCode: "999999" } // Unknown PIN
  );
  assert(unverifiedTaxCalc.isTaxVerified === false, "Tax calculation with unknown PIN marks isTaxVerified as false");
  assert(unverifiedTaxCalc.requiresQuotation === true, "Tax calculation with unknown PIN marks requiresQuotation as true");
  assert(unverifiedTaxCalc.taxType === "UNVERIFIED", "Tax type is UNVERIFIED when place of supply is unknown");

  // --- GATE 3: DUPLICATE UTR SUBMISSION & REPLAY PREVENTION ---
  console.log("\n--- GATE 3: Bank Payment Verification & Duplicate UTR Guard ---");
  const orderId1 = `ord_p912_utr1_${Date.now()}`;
  const orderId2 = `ord_p912_utr2_${Date.now()}`;
  const testUtr = `UTR-UNIQUE-${Date.now()}`;

  const orderNum1 = `ORD-UTR-1-${Date.now().toString().slice(-6)}`;
  const orderNum2 = `ORD-UTR-2-${Date.now().toString().slice(-6)}`;

  await client.query(
    `INSERT INTO "dms_trade_order"
     (id, order_number, customer_id, customer_name, customer_email, customer_phone, organization, role_at_order, price_tier_applied, payment_method, total_inr, subtotal_inr, gst_amount_inr, status, payment_status, shipping_address, items, events, fulfillment_type, is_direct_sai_ajanta, return_status, damaged_qty, damage_claim_status, delivery_attempts, fulfilment_status, bank_proof_status, place_of_supply_state_code)
     VALUES 
     ($1, $3, 'cust_1', 'Buyer 1', 'buyer1@example.com', '9999999991', 'Org 1', 'CUSTOMER', 'CUSTOMER', 'Bank Transfer', 1000, 847, 153, 'PENDING_PAYMENT', 'UNPAID', 'Address 1', '[]', '[]', 'DELIVERY', true, 'NONE', 0, 'NONE', 0, 'UNALLOCATED', 'NONE', '33'),
     ($2, $4, 'cust_2', 'Buyer 2', 'buyer2@example.com', '9999999992', 'Org 2', 'CUSTOMER', 'CUSTOMER', 'Bank Transfer', 2000, 1694, 306, 'PENDING_PAYMENT', 'UNPAID', 'Address 2', '[]', '[]', 'DELIVERY', true, 'NONE', 0, 'NONE', 0, 'UNALLOCATED', 'NONE', '33')`,
    [orderId1, orderId2, orderNum1, orderNum2]
  );

  // Submit UTR on Order 1
  const subRes1 = await OrderLifecycleService.executeOrderCommand(client, {
    orderId: orderId1,
    command: "SUBMIT_BANK_PROOF",
    actorRole: "CUSTOMER",
    actorId: "cust_1",
    bankReference: testUtr,
  });
  assert(subRes1.paymentStatus === "AWAITING_BANK_VERIFICATION", "Order 1 payment status moves to AWAITING_BANK_VERIFICATION");

  // Attempt to submit identical UTR on Order 2 -> Must be rejected with 409 DUPLICATE_BANK_REFERENCE
  try {
    await OrderLifecycleService.executeOrderCommand(client, {
      orderId: orderId2,
      command: "SUBMIT_BANK_PROOF",
      actorRole: "CUSTOMER",
      actorId: "cust_2",
      bankReference: testUtr,
    });
    assert(false, "Should have thrown on duplicate UTR submission");
  } catch (err) {
    assert(err.code === "DUPLICATE_BANK_REFERENCE", "Duplicate UTR submission rejected with DUPLICATE_BANK_REFERENCE");
  }

  // Verify that only STAFF_FINANCE can verify bank payment
  try {
    await OrderLifecycleService.executeOrderCommand(client, {
      orderId: orderId1,
      command: "VERIFY_BANK_PAYMENT",
      actorRole: "STAFF_LOGISTICS",
      actorId: "staff_logistics_1",
    });
    assert(false, "Should have thrown on unauthorized staff verification");
  } catch (err) {
    assert(err.code === "FORBIDDEN_FINANCE_ACTION", "Non-finance staff verification strictly rejected with FORBIDDEN_FINANCE_ACTION");
  }

  const verRes = await OrderLifecycleService.executeOrderCommand(client, {
    orderId: orderId1,
    command: "VERIFY_BANK_PAYMENT",
    actorRole: "STAFF_FINANCE",
    actorId: "staff_fin_1",
  });
  assert(verRes.paymentStatus === "PAID", "Staff Finance verification successfully transitions order to PAID");

  // --- GATE 4: AUTHORITATIVE PHYSICAL INVENTORY RESTOCK & IDEMPOTENCY ---
  console.log("\n--- GATE 4: Authoritative Physical Inventory Restock & Idempotency ---");
  const testSku = "A-DT-12-001";
  
  // Seed initial stock in dms_product_import_row
  await client.query(
    `INSERT INTO "dms_product_import_row" (id, job_id, source_row_number, sku, product_name, category, stock_qty)
     VALUES ($1, 'job_test', 1, $2, 'Aluminium Section', 'Aluminium sections', 50)
     ON CONFLICT DO NOTHING`,
    [`prow_${Date.now()}`, testSku]
  );
  await client.query(
    `UPDATE "dms_product_import_row" SET stock_qty = 50 WHERE UPPER(sku) = $1`,
    [testSku]
  );

  // Check if inventory_level exists for this variant
  const initVarRes = await client.query(
    `SELECT pvii.inventory_item_id, il.stocked_quantity
     FROM product_variant pv
     JOIN product_variant_inventory_item pvii ON pvii.variant_id = pv.id
     JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
     WHERE UPPER(pv.sku) = $1 LIMIT 1`,
    [testSku]
  );
  const hasMedusaInventory = initVarRes.rows.length > 0;
  const initialMedusaStock = hasMedusaInventory ? Number(initVarRes.rows[0].stocked_quantity) : null;

  // Create return request
  const retReq = await OrderLifecycleService.requestReturn(client, {
    orderId: orderId1,
    lineId: "line_1",
    sku: testSku,
    quantity: 2,
    reason: "Damaged packaging on arrival",
  });
  assert(retReq.status === "REQUESTED", "Return request created with status REQUESTED");

  // Inspect return: 2 accepted
  const inspectRes = await OrderLifecycleService.inspectReturn(client, {
    returnId: retReq.id,
    inspectedQtyAccepted: 2,
    inspectedQtyScrapped: 0,
    staffId: "staff_qa_1",
    notes: "Verified undamaged internal goods",
  });
  assert(inspectRes.status === "INSPECTED_ACCEPTED", "Return inspection resolves to INSPECTED_ACCEPTED");
  assert(inspectRes.restockedQty === 2, "2 accepted units restocked");

  // Verify catalog presentation cache stock updated (50 + 2 = 52)
  const afterStockRes = await client.query(
    `SELECT stock_qty FROM "dms_product_import_row" WHERE UPPER(sku) = $1`,
    [testSku]
  );
  assert(Number(afterStockRes.rows[0].stock_qty) === 52, "Catalog presentation stock incremented to 52");

  // Verify Medusa inventory_level incremented if present
  if (hasMedusaInventory) {
    const afterMedusaRes = await client.query(
      `SELECT il.stocked_quantity
       FROM product_variant pv
       JOIN product_variant_inventory_item pvii ON pvii.variant_id = pv.id
       JOIN inventory_level il ON il.inventory_item_id = pvii.inventory_item_id
       WHERE UPPER(pv.sku) = $1 LIMIT 1`,
      [testSku]
    );
    const newMedusaStock = Number(afterMedusaRes.rows[0].stocked_quantity);
    assert(newMedusaStock === initialMedusaStock + 2, `Medusa inventory_level incremented by exactly 2 (${initialMedusaStock} -> ${newMedusaStock})`);
  } else {
    console.log("  [INFO] Test SKU has no Medusa inventory_level row in disposable fixture; catalog and movement ledger verified.");
  }

  // Verify movement ledger entry
  const movRes = await client.query(
    `SELECT * FROM "dms_inventory_movement" WHERE order_id = $1 AND movement_type = 'RETURN_RESTOCK'`,
    [orderId1]
  );
  assert(movRes.rows.length === 1, "dms_inventory_movement has exactly 1 immutable RETURN_RESTOCK entry");
  assert(movRes.rows[0].delta_physical === 2, "Movement delta_physical is exactly 2");

  // Attempt duplicate inspection -> Must be rejected with 409 RETURN_ALREADY_INSPECTED
  try {
    await OrderLifecycleService.inspectReturn(client, {
      returnId: retReq.id,
      inspectedQtyAccepted: 2,
      inspectedQtyScrapped: 0,
      staffId: "staff_qa_1",
    });
    assert(false, "Should have thrown on duplicate return inspection");
  } catch (err) {
    assert(err.code === "RETURN_ALREADY_INSPECTED", "Duplicate inspection call strictly rejected with RETURN_ALREADY_INSPECTED (409)");
  }

  // --- GATE 5: DRAFT FINANCIAL DOCUMENTS & LEGAL AUTHORITY ---
  console.log("\n--- GATE 5: Draft Financial Documents Authority & Disclaimer ---");
  const proformaDoc = await OrderLifecycleService.generateFinancialDocument(client, {
    orderId: orderId1,
    docType: "PROFORMA",
    staffId: "staff_fin_1",
  });
  assert(proformaDoc.disclaimer === "Draft / Not a Tax Invoice", "Proforma contains mandatory 'Draft / Not a Tax Invoice' disclaimer");
  assert(proformaDoc.isOfficialTaxDocument === false, "isOfficialTaxDocument is strictly false");
  assert(proformaDoc.docNumber.startsWith("PI-DRAFT-"), "Proforma document number has draft prefix (PI-DRAFT-)");

  const invoiceDoc = await OrderLifecycleService.generateFinancialDocument(client, {
    orderId: orderId1,
    docType: "DRAFT_INVOICE",
    staffId: "staff_fin_1",
  });
  assert(invoiceDoc.disclaimer === "Draft / Not a Tax Invoice", "Draft Invoice contains mandatory 'Draft / Not a Tax Invoice' disclaimer");
  assert(invoiceDoc.isOfficialTaxDocument === false, "Draft invoice isOfficialTaxDocument is strictly false");
  assert(invoiceDoc.docNumber.startsWith("INV-DRAFT-"), "Draft invoice number has draft prefix (INV-DRAFT-)");

  // --- GATE 6: PRIMARY DATABASE IMMUTABILITY ---
  console.log("\n--- GATE 6: Primary Database Immutability Audit ---");
  const primaryUrl =
    process.env.PRIMARY_DATABASE_URL ||
    (process.env.DATABASE_URL
      ? process.env.DATABASE_URL.replace(/medusa_restore_rehearsal_disposable.*/, "medusa")
      : "postgres://medusa:medusa@localhost:5432/medusa");
  const primaryClient = new Client({ connectionString: primaryUrl });
  await primaryClient.connect();

  const primOrders = await primaryClient.query("SELECT count(*) FROM dms_trade_order");
  assert(Number(primOrders.rows[0].count) === 5, `Primary 'medusa' dms_trade_order unchanged (count = 5)`);

  const primCust = await primaryClient.query("SELECT count(*) FROM customer");
  assert(Number(primCust.rows[0].count) === 51, `Primary 'medusa' customer table unchanged (count = 51)`);

  const primTables = await primaryClient.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('dms_financial_document', 'dms_order_return', 'dms_order_command_log')"
  );
  assert(primTables.rows.length === 0, `Primary 'medusa' has 0 Phase 09 tables (zero write mutations)`);
  await primaryClient.end();

  // Teardown mutable test orders and documents (audit ledgers dms_inventory_movement & dms_order_command_log are strictly append-only)
  await client.query(`DELETE FROM "dms_order_return" WHERE order_id IN ($1, $2)`, [orderId1, orderId2]);
  await client.query(`DELETE FROM "dms_financial_document" WHERE order_id IN ($1, $2)`, [orderId1, orderId2]);
  await client.query(`DELETE FROM "dms_trade_order" WHERE id IN ($1, $2)`, [orderId1, orderId2]);

  console.log("\n===============================================================================");
  console.log(`P9.12 CORRECTNESS GATE SUMMARY: ${passedAssertions} / ${totalAssertions} ASSERTIONS PASSED`);
  console.log("===============================================================================");
}

run()
  .catch((err) => {
    console.error("FATAL in P9.12 Gate:", err);
    process.exit(1);
  })
  .finally(() => client.end());

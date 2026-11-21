import fs from "node:fs";
import path from "node:path";
import pg from "../apps/backend/node_modules/pg/lib/index.js";
import { assertDisposableDbTarget, assertDisposableDbConnection } from "../apps/backend/src/lib/disposable-db-guard.ts";
import { ImportParserService, generateErrorReportCsv } from "../apps/backend/src/services/import-parser.service.ts";

const Client = pg.Client || pg.default?.Client || pg.default;
const BACKEND_URL = "http://127.0.0.1:9000";
const STOREFRONT_URL = "http://127.0.0.1:3000";
const DISPOSABLE_DB_URL =
  process.env.DISPOSABLE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgres://medusa:medusa@127.0.0.1:5432/medusa_restore_rehearsal_disposable";
const pubConfig = JSON.parse(fs.readFileSync("local-nas/medusa-public-config.json", "utf8"));
const PUBLISHABLE_KEY = pubConfig.publishableKey;

let testPassCount = 0;
let testFailCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testPassCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testFailCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function run() {
  console.log("===============================================================================");
  console.log("PHASE 06 — CONTROLLED CATALOG CMS & VERIFIED IMPORT SUITE");
  console.log("Database: medusa_restore_rehearsal_disposable (Isolated Disposable Test Database)");
  console.log("===============================================================================\n");

  const pgClient = new Client({ connectionString: DISPOSABLE_DB_URL });
  await pgClient.connect();

  try {
    // -------------------------------------------------------------------------
    // TEST 1: Disposable DB Safety Guard (P6.0 & DEC-004)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Disposable Database Safety Guard ---");
    let caughtMedusa = false;
    try {
      assertDisposableDbTarget("postgres://medusa:sanitized_pass@127.0.0.1:5432/medusa");
    } catch (e) {
      caughtMedusa = true;
      assert(e.message.includes("[DATA_SAFETY_GUARD]"), "Guard rejects primary database 'medusa'");
    }
    assert(caughtMedusa, "Safety guard prevented writing to production 'medusa' database");

    // Guard allows medusa_restore_rehearsal_disposable when ALLOW_DISPOSABLE_DB_WRITES=true
    let allowedDisposable = false;
    process.env.ALLOW_DISPOSABLE_DB_WRITES = "true";
    try {
      assertDisposableDbTarget(DISPOSABLE_DB_URL);
      allowedDisposable = true;
    } catch (e) {
      allowedDisposable = false;
    }
    assert(allowedDisposable, "Guard permits operations against 'medusa_restore_rehearsal_disposable'");

    // Verify current database in PostgreSQL session
    const { currentDb: activeDbName } = await assertDisposableDbConnection(pgClient);
    assert(
      activeDbName === "medusa_restore_rehearsal_disposable",
      `Active DB session is isolated: '${activeDbName}'`
    );

    // Clean disposable DB test products and import tables for clean reproducible run
    await pgClient.query('DELETE FROM "product_variant_price_set";');
    await pgClient.query('DELETE FROM "product_variant";');
    await pgClient.query('DELETE FROM "product_option_value";');
    await pgClient.query('DELETE FROM "product_option";');
    await pgClient.query('DELETE FROM "product";');
    await pgClient.query('DELETE FROM "dms_product_import_row";');
    await pgClient.query('DELETE FROM "dms_product_import_job";');

    // -------------------------------------------------------------------------
    // TEST 2: Source Workbook Reconciliation (P6.1 & P6.2)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Source Workbook Reconciliation ---");
    const workbookPath = path.resolve("apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx");
    assert(fs.existsSync(workbookPath), "Original source workbook .xlsx is present on disk");

    const xlsxBuffer = fs.readFileSync(workbookPath);
    const parsedXlsx = ImportParserService.parseFile(xlsxBuffer, "Sai_Ajantha_Product_Input_Workbook.xlsx");
    assert(parsedXlsx.totalRows >= 292, `Total workbook raw rows is at least 292 (parsed: ${parsedXlsx.totalRows})`);
    assert(parsedXlsx.excludedSampleRows >= 11, `Illustrative DEMO rows excluded >= 11 (parsed: ${parsedXlsx.excludedSampleRows})`);
    assert(parsedXlsx.candidateRows >= 190, `Candidate rows parsed from workbook (parsed: ${parsedXlsx.candidateRows})`);

    const csvPath = path.resolve("apps/admin/public/sai-ajantha-products.csv");
    const csvBuffer = fs.readFileSync(csvPath);
    const parsedCsv = ImportParserService.parseFile(csvBuffer, "sai-ajantha-products.csv");
    assert(parsedCsv.candidateRows === 281, `CSV candidate rows matches 281 (parsed: ${parsedCsv.candidateRows})`);
    assert(parsedCsv.excludedSampleRows === 0, `CSV has 0 sample rows (parsed: ${parsedCsv.excludedSampleRows})`);
    assert(parsedCsv.validRows === 273, `CSV clean valid rows matches 273 (parsed: ${parsedCsv.validRows})`);
    assert(parsedCsv.warningRows === 8, `CSV warning rows (8 Floor Springs DEC-002) matches 8 (parsed: ${parsedCsv.warningRows})`);
    assert(parsedCsv.validRows + parsedCsv.warningRows === 281, `Total eligible CSV rows is 281`);

    // Verify Floor Springs are classified as ENQUIRY_ONLY
    const floorSpringRows = parsedCsv.rows.filter(
      (r) => r.name.toLowerCase().includes("floor spring") || (r.sku && r.sku.includes("-FS-"))
    );
    assert(floorSpringRows.length === 8, `Found exactly 8 hydraulic floor springs in workbook (got: ${floorSpringRows.length})`);
    const allFsEnquiry = floorSpringRows.every(
      (r) => r.route === "ENQUIRY_ONLY" && r.isQuoteOnly === true
    );
    assert(allFsEnquiry, "All 8 Floor Springs flagged ENQUIRY_ONLY / isQuoteOnly=true (DEC-002)");

    // -------------------------------------------------------------------------
    // TEST 3: Staff Authentication & Security Gate (P6.3 & P6.4)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Staff Authentication & Security Gate ---");
    // Anonymous staging attempt
    const anonStageRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/import/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileContentText: "sku,title\n1,test" }),
    });
    assert(anonStageRes.status === 401, `Anonymous staging returns 401 Unauthorized (got: ${anonStageRes.status})`);

    // Anonymous publish attempt
    const anonPubRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/import/jobs/test-id/publish`, {
      method: "POST",
    });
    assert(anonPubRes.status === 401, `Anonymous publish returns 401 Unauthorized (got: ${anonPubRes.status})`);

    // Authenticate as Staff Admin
    const loginRes = await fetch(`${BACKEND_URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@sai-ajanta.com", password: "Admin1234!" }),
    });
    assert(loginRes.status === 200, "Staff admin login succeeded");
    const { token: staffToken } = await loginRes.json();
    assert(Boolean(staffToken), "Staff admin JWT token acquired");

    // -------------------------------------------------------------------------
    // TEST 4: Backend Staging Lifecycle & Idempotency (P6.3)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Backend Staging Lifecycle & Idempotency ---");
    // Reset disposable test tables for reproducible test runs
    await pgClient.query("TRUNCATE TABLE dms_product_import_row, dms_product_import_job CASCADE;");
    await pgClient.query('TRUNCATE TABLE "product" CASCADE;');

    const testIntentId = `intent_p6_test_${Date.now()}`;
    const stagePayload = {
      intentId: testIntentId,
      fileName: "sai-ajantha-products.csv",
      fileContentText: csvBuffer.toString("utf8"),
    };

    const stageRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/import/stage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify(stagePayload),
    });

    if (stageRes.status !== 201) {
      console.error("Stage error body:", await stageRes.text());
    }
    assert(stageRes.status === 201, `Staff staging returned 201 Created (got: ${stageRes.status})`);
    const stageData = await stageRes.json();
    assert(Boolean(stageData.job?.id), `Created durable import job: ${stageData.job?.id}`);
    assert(stageData.job.status === "STAGED", `Job status is STAGED (got: ${stageData.job.status})`);
    assert(stageData.job.candidate_rows === 281, `Candidate rows persisted is 281 (got: ${stageData.job.candidate_rows})`);
    assert(stageData.job.staged_rows === 281, `Staged rows persisted is 281 (got: ${stageData.job.staged_rows})`);
    assert(stageData.rows.length === 281, `Returned rows count is 281 (got: ${stageData.rows.length})`);

    const jobId = stageData.job.id;

    // Idempotent retry: Re-submitting same intentId
    const replayRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/import/stage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${staffToken}`,
      },
      body: JSON.stringify(stagePayload),
    });
    assert(replayRes.status === 200, `Replay request returned 200 OK`);
    const replayData = await replayRes.json();
    assert(replayData.isReplay === true, "Replay response flagged as isReplay: true");
    assert(replayData.job.id === jobId, "Replay returned identical job ID without duplication");

    // Test Job Details & Error Report CSV Download
    const jobGetRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/import/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(jobGetRes.status === 200, "GET job details returned 200 OK");
    const jobGetData = await jobGetRes.json();
    assert(jobGetData.job.id === jobId, "Retrieved job ID matches");

    const csvReportRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/import/jobs/${jobId}?format=csv`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(csvReportRes.status === 200, "GET error report CSV returned 200 OK");
    assert(csvReportRes.headers.get("content-type")?.includes("text/csv"), "Error report has text/csv content type");
    const reportText = await csvReportRes.text();
    assert(reportText.includes("SourceRowNumber,SKU,ProductName"), "Error report contains standard CSV headers");

    // -------------------------------------------------------------------------
    // TEST 5: Atomic Staff Publishing to Medusa Catalog (P6.3 & P6.6)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Atomic Staff Publishing to Medusa Catalog ---");
    const prePubCountRes = await pgClient.query('SELECT count(*)::int as count FROM "product";');
    const prePubCount = prePubCountRes.rows[0].count;
    console.log(`  Initial products in disposable db: ${prePubCount}`);

    const pubRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/products/import/jobs/${jobId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert(pubRes.status === 200, `Publish returned 200 OK (got: ${pubRes.status})`);
    const pubData = await pubRes.json();
    if (pubData.status !== "COMPLETED") {
      console.error("Publish errors sample:", pubData.errors?.slice(0, 5));
    }
    assert(pubData.status === "COMPLETED", `Publish status is COMPLETED (got: ${pubData.status})`);
    assert(pubData.publishedCount === 281, `Published exactly 281 products (got: ${pubData.publishedCount})`);

    const postPubCountRes = await pgClient.query('SELECT count(*)::int as count FROM "product";');
    const postPubCount = postPubCountRes.rows[0].count;
    assert(postPubCount === prePubCount + 281, `Disposable DB product count increased by 281 (now: ${postPubCount})`);

    // Verify job and row persistence in DMS tables
    const dbJobRes = await pgClient.query(
      "SELECT * FROM dms_product_import_job WHERE id = $1 LIMIT 1;",
      [jobId]
    );
    assert(dbJobRes.rows.length === 1, `Import job '${jobId}' persisted in database`);
    assert(dbJobRes.rows[0].status === "COMPLETED", `Job status in DB is COMPLETED (got: ${dbJobRes.rows[0].status})`);
    assert(dbJobRes.rows[0].published_rows === 281, `Job published_rows in DB is 281 (got: ${dbJobRes.rows[0].published_rows})`);

    const committedRowsRes = await pgClient.query(
      "SELECT count(*)::int as count FROM dms_product_import_row WHERE job_id = $1 AND status = 'COMMITTED' AND review_status = 'APPROVED';",
      [jobId]
    );
    assert(committedRowsRes.rows[0].count === 281, `All 281 rows transitioned to COMMITTED & APPROVED in DB (got: ${committedRowsRes.rows[0].count})`);

    // -------------------------------------------------------------------------
    // TEST 6: Storefront Catalog Price Privacy Projection (P6.6)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Storefront Catalog Price Privacy Projection ---");
    const catRes = await fetch(`${BACKEND_URL}/store/sai-ajanta/catalog`, {
      headers: { "x-publishable-api-key": PUBLISHABLE_KEY },
    });
    assert(catRes.status === 200, `Store catalog API returned 200 OK (got: ${catRes.status})`);
    const catData = await catRes.json();
    assert(catData.products.length >= 281, `Catalog returns all published products (count: ${catData.count})`);

    // Verify Trade Price Confidentiality (BE-07 / SF-01)
    const publicProducts = catData.products;
    const leakedDealer = publicProducts.some((p) => p.dealerPriceInr !== null && p.dealerPriceInr !== undefined);
    assert(!leakedDealer, "Confidential Dealer price is strictly null for anonymous callers");

    const leakedDistributor = publicProducts.some((p) => p.distributorPriceInr !== null && p.distributorPriceInr !== undefined);
    assert(!leakedDistributor, "Confidential Distributor price is strictly null for anonymous callers");

    const leakedCost = publicProducts.some(
      (p) => p.metadata?.supplier_cost !== undefined || p.metadata?.supplier_price !== undefined
    );
    assert(!leakedCost, "Supplier cost price is strictly stripped from metadata");

    // Verify Floor Springs in Public Catalog
    const pubFloorSprings = publicProducts.filter(
      (p) => (p.name && p.name.toLowerCase().includes("floor spring")) || (p.sku && p.sku.includes("-FS-"))
    );
    assert(pubFloorSprings.length === 8, `Catalog contains 8 Floor Springs (got: ${pubFloorSprings.length})`);
    const allFsEnquiryPub = pubFloorSprings.every(
      (p) => p.metadata?.seller_route === "ENQUIRY_ONLY" && p.metadata?.is_quote_only === true
    );
    assert(allFsEnquiryPub, "All 8 Floor Springs in public catalog have seller_route: ENQUIRY_ONLY & is_quote_only: true");

    // -------------------------------------------------------------------------
    // TEST 7: Storefront HTTP Integration (/api/products)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Storefront HTTP Integration (/api/products) ---");
    const sfProdRes = await fetch(`${STOREFRONT_URL}/api/products`);
    assert(sfProdRes.status === 200, `Storefront /api/products returned 200 OK (got: ${sfProdRes.status})`);
    const sfData = await sfProdRes.json();
    assert(sfData.source === "medusa", `Storefront source is authoritative 'medusa' (got: ${sfData.source})`);
    assert(sfData.count >= 281, `Storefront returns 281+ products (got: ${sfData.count})`);

    // Verify specific Floor Spring SKU in Storefront
    const fsSkuTest = sfData.products.find((p) => p.code === "SA-I-FS-TON90-007" || p.sku === "SA-I-FS-TON90-007");
    assert(Boolean(fsSkuTest), "Floor spring SA-I-FS-TON90-007 found in storefront catalog");
    assert(fsSkuTest?.isQuoteOnly === true, "SA-I-FS-TON90-007 isQuoteOnly: true on storefront");
    assert(fsSkuTest?.sellerRoute === "ENQUIRY_ONLY", "SA-I-FS-TON90-007 sellerRoute: ENQUIRY_ONLY");

    // -------------------------------------------------------------------------
    // TEST 8: Media Sync Immutability (P6.5 & BE-24)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Media Sync Immutability (BE-24) ---");
    // Verify syncNasImages preserves approved prices and route
    const sampleSku = "SA-M-DC-60-001";
    const beforeSyncRes = await pgClient.query(
      `SELECT metadata FROM "product" WHERE metadata->>'sku' = $1 LIMIT 1;`,
      [sampleSku]
    );
    assert(beforeSyncRes.rows.length === 1, `Found ${sampleSku} in database`);
    const beforeMeta = beforeSyncRes.rows[0].metadata;
    const initialApproved = beforeMeta.approved;
    const initialPrice = beforeMeta.customer_price_inr;

    // Trigger NAS sync endpoint with staff token
    const nasSyncRes = await fetch(`${BACKEND_URL}/admin/sai-ajanta/sync-nas`, {
      method: "POST",
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    if (nasSyncRes.status !== 200) {
      console.error(`sync-nas status: ${nasSyncRes.status}, body:`, await nasSyncRes.text());
    }
    assert(nasSyncRes.status === 200, "Staff triggered sync-nas endpoint successfully");

    const afterSyncRes = await pgClient.query(
      `SELECT metadata FROM "product" WHERE metadata->>'sku' = $1 LIMIT 1;`,
      [sampleSku]
    );
    const afterMeta = afterSyncRes.rows[0].metadata;
    assert(
      afterMeta.customer_price_inr === initialPrice,
      `BE-24: Media sync did NOT overwrite customer price (${afterMeta.customer_price_inr} === ${initialPrice})`
    );
    assert(
      afterMeta.approved === initialApproved,
      `BE-24: Media sync did NOT overwrite approval status (${afterMeta.approved} === ${initialApproved})`
    );

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log("\n===============================================================================");
    console.log(`PHASE 06 TEST SUITE COMPLETED: ${testPassCount} PASSED, ${testFailCount} FAILED`);
    console.log("===============================================================================");
  } finally {
    await pgClient.end();
  }
}

run().catch((err) => {
  console.error("\nTEST SUITE CRASHED:", err);
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import pg from "../apps/backend/node_modules/pg/lib/index.js";

function parseCsvContent(text) {
  let clean = text;
  if (clean.charCodeAt(0) === 0xfeff) clean = clean.slice(1);
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (ch === '"') {
      if (inQuotes && clean[i + 1] === '"') {
        currentCell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
    } else if ((ch === "\r" || ch === "\n") && !inQuotes) {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      currentRow.push(currentCell.trim());
      currentCell = "";
      if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
      currentRow = [];
    } else {
      currentCell += ch;
    }
  }
  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some(c => c.length > 0)) rows.push(currentRow);
  }
  return rows;
}

const Client = pg.Client || pg.default?.Client || pg.default;

async function run() {
  console.log("===============================================================================");
  console.log("SAI AJANTHA — STRICT READ-ONLY 274 vs 281 SKU AUDIT & RECONCILIATION");
  console.log("===============================================================================\n");

  // 1. Verify Excel file on disk
  const excelPath = path.resolve("docs/SAI Ajantha Products (1).xlsx");
  if (!fs.existsSync(excelPath)) {
    throw new Error(`Excel file not found at ${excelPath}`);
  }
  const excelBuf = fs.readFileSync(excelPath);
  const excelSha256 = crypto.createHash("sha256").update(excelBuf).digest("hex");
  console.log(`Excel file: docs/SAI Ajantha Products (1).xlsx (${excelBuf.length} bytes)`);
  console.log(`Excel SHA-256: ${excelSha256}`);
  const expectedSha256 = "784b81797e0bfe1715ba2b24e764e4c2a71212640319d6afdb3d9f9eda9553b5";
  if (excelSha256 !== expectedSha256) {
    console.warn(`WARNING: Excel SHA-256 differs from expected! Expected: ${expectedSha256}`);
  } else {
    console.log("SHA-256 matches owner upload specification perfectly.");
  }

  // 2. Parse Reference CSV Export of Excel file (which represents all 34 columns and 274 rows)
  // Let's locate the uploaded reference export CSV
  const uploadedCsvPath = "C:/Users/Admin/.gemini/antigravity/brain/8c9dda4b-b66e-4d2d-aa27-c40cbf4f534f/.user_uploaded/media_1795073429829_3b0efffb.csv";
  let refCsvContent = "";
  if (fs.existsSync(uploadedCsvPath)) {
    refCsvContent = fs.readFileSync(uploadedCsvPath, "utf8");
  } else {
    throw new Error("Reference CSV export not found at " + uploadedCsvPath);
  }

  const newRows = parseCsvContent(refCsvContent);
  const newHeader = newRows[0];
  const newRecords = newRows.slice(1);
  console.log(`\nNew Workbook Records: ${newRecords.length} rows, ${newHeader.length} columns`);
  console.log("New Workbook Headers (34):", newHeader.join(" | "));

  // Index new records by SKU
  // Header:
  // 0: Product number
  // 1: Product name
  // 2: Brand
  // 3: Model
  // 4: Product code or SKU
  // 5: Category
  // 6: Description
  // 7: Features
  // 8: Customer benefits
  // 9: Size
  // 10: Measurements and units
  // 11: Material
  // 12: Variants
  // 13: Distributor price
  // 14: Dealer price
  // 15: Contractor price
  // 16: Customer price
  // 17: billing unit
  // 18: GST rate
  // 19: Quantity
  // 20: Delivery Info
  // 21: Images
  // 22: Other document links
  // 23: Warranty Info
  // 24: Reference selling price
  // 25: FAQ
  // 26: Product Specification
  // 27: sale_route
  // 28: isQuoteOnly
  // 29: min_order_qty
  // 30: max_order_qty
  // 31: installation_eligible
  // 32: hsn_code
  // 33: delivery_price

  const newRecordsMap = new Map();
  for (let i = 0; i < newRecords.length; i++) {
    const r = newRecords[i];
    const rawSku = r[4];
    const canonicalSku = rawSku.trim();
    if (newRecordsMap.has(canonicalSku)) {
      console.warn(`WARNING: Duplicate SKU in new workbook: ${canonicalSku} (row ${i + 2})`);
    }
    const recordObj = {};
    newHeader.forEach((h, colIdx) => {
      recordObj[h] = r[colIdx];
    });
    recordObj._sourceRow = i + 2;
    recordObj._rawSku = rawSku;
    recordObj._canonicalSku = canonicalSku;
    newRecordsMap.set(canonicalSku, recordObj);
  }
  console.log(`Unique Canonical SKUs in New Workbook: ${newRecordsMap.size}`);

  // 3. Load Existing 281 Genuine Catalogue Records
  // From apps/admin/public/sai-ajantha-products.csv
  const oldCsvPath = path.resolve("apps/admin/public/sai-ajantha-products.csv");
  const oldCsvContent = fs.readFileSync(oldCsvPath, "utf8");
  const oldRows = parseCsvContent(oldCsvContent);
  const oldHeader = oldRows[0];
  const oldRecords = oldRows.slice(1);
  console.log(`\nExisting Admin CSV Records: ${oldRecords.length} rows, ${oldHeader.length} columns`);
  console.log("Existing Admin CSV Headers:", oldHeader.join(" | "));

  // From apps/storefront/lib/products.ts
  const { pathToFileURL } = await import("node:url");
  const storefrontMod = await import(pathToFileURL(path.resolve("apps/storefront/lib/products.ts")).href);
  const staticProducts = storefrontMod.PRODUCTS;
  console.log(`Storefront static PRODUCTS: ${staticProducts.length} items`);

  // Query Database (medusa_restore_rehearsal_disposable)
  const envContent = fs.readFileSync(path.resolve("apps/backend/.env"), "utf8");
  const dbMatch = envContent.match(/DATABASE_URL=(.+)/);
  const dbUrl = dbMatch ? dbMatch[1].trim() : "postgres://medusa:medusa@127.0.0.1:5432/medusa_restore_rehearsal_disposable";

  const dbClient = new Client({ connectionString: dbUrl });
  await dbClient.connect();

  const dbRowsRes = await dbClient.query(`
    SELECT 
      p.id as product_id,
      p.title,
      p.handle,
      p.status,
      p.thumbnail,
      p.metadata,
      pv.id as variant_id,
      pv.sku,
      pv.title as variant_title
    FROM product p
    LEFT JOIN product_variant pv ON p.id = pv.product_id
    ORDER BY p.created_at ASC
  `);

  console.log(`Total DB product_variant records: ${dbRowsRes.rows.length}`);

  // Separate test fixtures vs genuine products in DB
  const testFixtures = [];
  const dbGenuineProducts = new Map();

  for (const row of dbRowsRes.rows) {
    const sku = row.sku || "";
    if (sku.startsWith("SA-TEST-P10-") || sku.startsWith("COUNTQA") || sku.startsWith("DEMO-") || row.metadata?.is_test) {
      testFixtures.push(row);
    } else {
      const canonicalSku = sku.trim();
      dbGenuineProducts.set(canonicalSku, row);
    }
  }

  console.log(`Database Test Fixtures Identified: ${testFixtures.length}`);
  console.log(`Database Genuine Catalogue Records: ${dbGenuineProducts.size}`);

  await dbClient.end();

  // Reconcile Old Sources: Admin CSV (281) vs Static Products (281) vs DB Genuine (281)
  const oldRecordsMap = new Map();
  for (let i = 0; i < oldRecords.length; i++) {
    const r = oldRecords[i];
    const rawSku = r[0]; // sku
    const canonicalSku = rawSku.trim();
    const recordObj = {};
    oldHeader.forEach((h, colIdx) => {
      recordObj[h] = r[colIdx];
    });
    recordObj._sourceRow = i + 2;
    recordObj._rawSku = rawSku;
    recordObj._canonicalSku = canonicalSku;

    // Attach static product if found
    const staticItem = staticProducts.find(p => p.code.trim() === canonicalSku);
    recordObj._staticProduct = staticItem;

    // Attach DB product if found
    const dbItem = dbGenuineProducts.get(canonicalSku);
    recordObj._dbProduct = dbItem;

    oldRecordsMap.set(canonicalSku, recordObj);
  }

  console.log(`Unique Canonical SKUs in Existing Genuine Catalogue: ${oldRecordsMap.size}`);

  // 4. Mathematical SKU Reconciliation
  const allCanonicalSkus = new Set([...oldRecordsMap.keys(), ...newRecordsMap.keys()]);
  
  const matchedSkus = [];
  const oldOnlySkus = [];
  const newOnlySkus = [];

  for (const sku of allCanonicalSkus) {
    const inOld = oldRecordsMap.has(sku);
    const inNew = newRecordsMap.has(sku);
    if (inOld && inNew) {
      matchedSkus.push(sku);
    } else if (inOld && !inNew) {
      oldOnlySkus.push(sku);
    } else if (!inOld && inNew) {
      newOnlySkus.push(sku);
    }
  }

  matchedSkus.sort();
  oldOnlySkus.sort();
  newOnlySkus.sort();

  const M = matchedSkus.length;
  const oldOnlyCount = oldOnlySkus.length;
  const newOnlyCount = newOnlySkus.length;
  const oldTotal = oldRecordsMap.size;
  const newTotal = newRecordsMap.size;
  const mergedCandidateTotal = oldTotal + (newTotal - M);
  const unionTotal = M + oldOnlyCount + newOnlyCount;

  console.log("\n===============================================================================");
  console.log("FORMAL COUNT RECONCILIATION EQUATIONS");
  console.log("===============================================================================");
  console.log(`Total Genuine Old SKUs:           ${oldTotal} (Formula: M + Old-Only = ${M} + ${oldOnlyCount} = ${M + oldOnlyCount})`);
  console.log(`Total Genuine New SKUs:           ${newTotal} (Formula: M + New-Only = ${M} + ${newOnlyCount} = ${M + newOnlyCount})`);
  console.log(`Matched SKUs (M):                 ${M}`);
  console.log(`Old-Only Retained SKUs (281 - M): ${oldOnlyCount}`);
  console.log(`New-Only Proposed SKUs (274 - M): ${newOnlyCount}`);
  console.log(`Candidate Merged Size:            ${mergedCandidateTotal} (281 + (274 - M))`);
  console.log(`Genuine Source Union:             ${unionTotal} (M + Old-Only + New-Only)`);
  console.log(`Published Test Fixtures (P10):    ${testFixtures.filter(t => t.status === 'published').length}`);
  console.log(`Draft Test Fixtures (P10):        ${testFixtures.filter(t => t.status === 'draft').length}`);
  console.log(`Total Test Fixtures:              ${testFixtures.length}`);

  // 5. Category Breakdown Analysis
  console.log("\n--- Category Breakdown: Old (281) vs New (274) vs Matched (M) ---");
  const oldCategoryCounts = {};
  for (const [sku, r] of oldRecordsMap.entries()) {
    const cat = r.category || "Unknown";
    oldCategoryCounts[cat] = (oldCategoryCounts[cat] || 0) + 1;
  }
  const newCategoryCounts = {};
  for (const [sku, r] of newRecordsMap.entries()) {
    const cat = r.Category || "Unknown";
    newCategoryCounts[cat] = (newCategoryCounts[cat] || 0) + 1;
  }

  console.log("Old Categories (Admin CSV):", oldCategoryCounts);
  console.log("New Categories (Excel 15):", newCategoryCounts);

  // Print Old-Only and New-Only SKUs
  console.log("\n--- Old-Only SKUs (Retained unchanged per owner policy) ---");
  console.log(`Count: ${oldOnlySkus.length}`);
  for (const s of oldOnlySkus) {
    const item = oldRecordsMap.get(s);
    console.log(`  - SKU: ${s} | Name: ${item.name} | Cat: ${item.category} | Sub: ${item.subcategory}`);
  }

  console.log("\n--- New-Only SKUs (Proposed Draft, requiring approval) ---");
  console.log(`Count: ${newOnlySkus.length}`);
  for (const s of newOnlySkus) {
    const item = newRecordsMap.get(s);
    console.log(`  - SKU: ${s} | Name: ${item["Product name"]} | Cat: ${item.Category} | Row: ${item._sourceRow}`);
  }

  // 6. Detailed Field-by-Field Diff for Matched SKUs
  console.log("\n--- Comparing Fields for Matched SKUs ---");
  
  // Mapping between Old CSV columns and New 34 Excel columns
  // Old CSV: sku, name, category, subcategory, brand, size, material, billing_unit, customer_price_inr, contractor_price_inr, dealer_price_inr, distributor_price_inr, gst_rate, stock_qty, is_manufactured, src, description
  // New 34 Excel headers:
  // Product number, Product name, Brand, Model, Product code or SKU, Category, Description, Features, Customer benefits, Size, Measurements and units, Material, Variants, Distributor price, Dealer price, Contractor price, Customer price, billing unit, GST rate, Quantity, Delivery Info, Images, Other document links, Warranty Info, Reference selling price, FAQ, Product Specification, sale_route, isQuoteOnly, min_order_qty, max_order_qty, installation_eligible, hsn_code, delivery_price

  const rowReconciliation = [];
  const fieldDiffs = [];

  let matchedUnchangedCount = 0;
  let matchedChangedCount = 0;
  let blockedNeedsReviewCount = 0;

  for (const sku of allCanonicalSkus) {
    const inOld = oldRecordsMap.has(sku);
    const inNew = newRecordsMap.has(sku);
    const oldItem = oldRecordsMap.get(sku);
    const newItem = newRecordsMap.get(sku);

    let classification = "";
    let blockingReasons = [];
    let changedFieldCount = 0;

    if (inOld && !inNew) {
      classification = "OLD_ONLY_RETAIN";
    } else if (!inOld && inNew) {
      classification = "NEW_ONLY_PROPOSED_DRAFT";
      // Check for blockers in new item
      if (!newItem["Customer price"] || newItem["Customer price"] === "Null") {
        blockingReasons.push("MISSING_CUSTOMER_PRICE");
      }
      if (newItem["Category"] === "Floor Springs" || newItem["isQuoteOnly"] === "true") {
        blockingReasons.push("QUOTE_ONLY_SELLER_ROUTE");
      }
    } else {
      // Matched: Compare fields
      const diffsForThisSku = [];

      // Check specific fields:
      // 1. Product name
      if (oldItem.name !== newItem["Product name"]) {
        diffsForThisSku.push({
          field_name: "Product name",
          old_raw: oldItem.name,
          new_raw: newItem["Product name"],
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "PUBLIC",
          reason: "Updated title from Excel master"
        });
      }

      // 2. Brand
      if ((oldItem.brand || "") !== (newItem["Brand"] || "")) {
        diffsForThisSku.push({
          field_name: "Brand",
          old_raw: oldItem.brand || "",
          new_raw: newItem["Brand"] || "",
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "PUBLIC",
          reason: "Updated brand identifier"
        });
      }

      // 3. Category
      if (oldItem.category !== newItem["Category"]) {
        diffsForThisSku.push({
          field_name: "Category",
          old_raw: oldItem.category,
          new_raw: newItem["Category"],
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "PUBLIC",
          reason: "Fine-grained source category from Excel"
        });
      }

      // 4. Description
      if (oldItem.description !== newItem["Description"]) {
        diffsForThisSku.push({
          field_name: "Description",
          old_raw: oldItem.description,
          new_raw: newItem["Description"],
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "PUBLIC",
          reason: "Enriched description from Excel master"
        });
      }

      // 5. Customer price
      const oldCustPrice = parseFloat(oldItem.customer_price_inr);
      const newCustPrice = parseFloat(newItem["Customer price"]);
      if (isNaN(newCustPrice) && (newItem["Customer price"] === "Null" || !newItem["Customer price"])) {
        diffsForThisSku.push({
          field_name: "Customer price",
          old_raw: oldItem.customer_price_inr,
          new_raw: newItem["Customer price"],
          proposed_action: "KEEP_OLD",
          sensitivity: "PUBLIC_FINANCIAL",
          reason: "Incoming customer price is Null/blank; preserve existing valid price"
        });
        blockingReasons.push("MISSING_CUSTOMER_PRICE");
      } else if (Math.abs(oldCustPrice - newCustPrice) > 0.001) {
        diffsForThisSku.push({
          field_name: "Customer price",
          old_raw: oldItem.customer_price_inr,
          new_raw: newItem["Customer price"],
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "PUBLIC_FINANCIAL",
          reason: "Retail price change from Excel"
        });
      }

      // 6. Dealer price
      const oldDealerPrice = parseFloat(oldItem.dealer_price_inr);
      const newDealerPrice = parseFloat(newItem["Dealer price"]);
      if (Math.abs(oldDealerPrice - newDealerPrice) > 0.001) {
        diffsForThisSku.push({
          field_name: "Dealer price",
          old_raw: oldItem.dealer_price_inr,
          new_raw: newItem["Dealer price"],
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "CONFIDENTIAL_TRADE_PRICE",
          reason: "B2B dealer price adjustment"
        });
      }

      // 7. Contractor price
      const oldContractorPrice = parseFloat(oldItem.contractor_price_inr);
      const newContractorPrice = parseFloat(newItem["Contractor price"]);
      if (Math.abs(oldContractorPrice - newContractorPrice) > 0.001) {
        diffsForThisSku.push({
          field_name: "Contractor price",
          old_raw: oldItem.contractor_price_inr,
          new_raw: newItem["Contractor price"],
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "CONFIDENTIAL_TRADE_PRICE",
          reason: "B2B contractor price adjustment"
        });
      }

      // 8. Distributor price
      const oldDistributorPrice = parseFloat(oldItem.distributor_price_inr);
      const newDistributorPrice = parseFloat(newItem["Distributor price"]);
      if (Math.abs(oldDistributorPrice - newDistributorPrice) > 0.001) {
        diffsForThisSku.push({
          field_name: "Distributor price",
          old_raw: oldItem.distributor_price_inr,
          new_raw: newItem["Distributor price"],
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "CONFIDENTIAL_TRADE_PRICE",
          reason: "B2B distributor price adjustment"
        });
      }

      // 9. GST rate
      const oldGst = parseFloat(oldItem.gst_rate);
      const newGst = parseFloat(newItem["GST rate"]);
      if (Math.abs(oldGst - newGst) > 0.001) {
        diffsForThisSku.push({
          field_name: "GST rate",
          old_raw: oldItem.gst_rate,
          new_raw: newItem["GST rate"],
          proposed_action: "REVIEW",
          sensitivity: "TAX_STATUTORY",
          reason: "Tax rate representation change (requires owner/accountant signoff)"
        });
      }

      // 10. Material
      if ((oldItem.material || "") !== (newItem["Material"] || "")) {
        diffsForThisSku.push({
          field_name: "Material",
          old_raw: oldItem.material || "",
          new_raw: newItem["Material"] || "",
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "PUBLIC",
          reason: "Updated material specification"
        });
      }

      // 11. Size
      if ((oldItem.size || "") !== (newItem["Size"] || "")) {
        diffsForThisSku.push({
          field_name: "Size",
          old_raw: oldItem.size || "",
          new_raw: newItem["Size"] || "",
          proposed_action: "PROPOSE_UPDATE",
          sensitivity: "PUBLIC",
          reason: "Updated size format"
        });
      }

      // 12. Stock / Quantity
      const newQty = newItem["Quantity"];
      if (newQty === "Null" || newQty === "" || newQty === null) {
        // Excel is blank/Null
        diffsForThisSku.push({
          field_name: "Quantity",
          old_raw: oldItem.stock_qty || "0",
          new_raw: "Null",
          proposed_action: "KEEP_OLD",
          sensitivity: "OPERATIONAL",
          reason: "Excel has no quantity; retain current stock or enquiry status"
        });
      }

      // 13. Images
      const newImg = newItem["Images"];
      if (newImg === "Null" || newImg === "" || newImg === null) {
        diffsForThisSku.push({
          field_name: "Images",
          old_raw: oldItem.src || "",
          new_raw: "Null",
          proposed_action: "KEEP_OLD",
          sensitivity: "MEDIA",
          reason: "Excel has no image path; retain current approved image asset"
        });
      }

      // 14. Rich New Fields (Features, Benefits, Specs, Warranty, Delivery, Route, QuoteOnly, MOQ)
      const richFields = [
        "Features", "Customer benefits", "Measurements and units", "Variants",
        "Delivery Info", "Warranty Info", "FAQ", "Product Specification",
        "sale_route", "isQuoteOnly", "min_order_qty", "max_order_qty",
        "installation_eligible", "hsn_code", "delivery_price", "Reference selling price"
      ];

      for (const rf of richFields) {
        const val = newItem[rf];
        if (val && val !== "Null") {
          diffsForThisSku.push({
            field_name: rf,
            old_raw: "(not in old CSV)",
            new_raw: val,
            proposed_action: "PROPOSE_UPDATE",
            sensitivity: rf.includes("price") || rf.includes("route") ? "CONFIDENTIAL" : "PUBLIC",
            reason: `New Excel field populated from master workbook`
          });
        }
      }

      // Check content quality flags
      if (newItem["Product Specification"]?.includes("illustrative specification")) {
        blockingReasons.push("ILLUSTRATIVE_SPECIFICATION_PRESENT");
      }
      if (newItem["Category"] === "Mesh" && (newItem["Product name"]?.includes("SS 304") || newItem["Product name"]?.includes("SS304")) && newItem["Description"]?.toLowerCase().includes("fibreglass")) {
        blockingReasons.push("MESH_MATERIAL_CONFLICT_SS304_VS_FIBREGLASS");
      }
      if (newItem["min_order_qty"] === "50sqt") {
        blockingReasons.push("TEXT_MOQ_50SQT_REQUIRES_UOM_LOGIC");
      }
      if (newItem["Category"] === "Floor Springs" && newItem["isQuoteOnly"] === "true") {
        blockingReasons.push("FLOOR_SPRING_QUOTE_ONLY_OVERRIDE");
      }

      changedFieldCount = diffsForThisSku.length;

      if (blockingReasons.length > 0) {
        classification = "BLOCKED_NEEDS_REVIEW";
        blockedNeedsReviewCount++;
      } else if (changedFieldCount > 0) {
        classification = "MATCHED_CHANGED";
        matchedChangedCount++;
      } else {
        classification = "MATCHED_UNCHANGED";
        matchedUnchangedCount++;
      }

      for (const d of diffsForThisSku) {
        fieldDiffs.push({
          canonical_sku: sku,
          field_name: d.field_name,
          old_raw_value: d.old_raw,
          new_raw_value: d.new_raw,
          proposed_action: d.proposed_action,
          sensitivity: d.sensitivity,
          reason: d.reason,
          approval_status: "PENDING"
        });
      }
    }

    // Row Reconciliation Entry
    const dbItem = inOld ? oldItem._dbProduct : null;
    rowReconciliation.push({
      canonical_sku: sku,
      old_sku_raw: inOld ? oldItem._rawSku : "",
      new_sku_raw: inNew ? newItem._rawSku : "",
      medusa_product_id: dbItem ? dbItem.product_id : "",
      variant_id: dbItem ? dbItem.variant_id : "",
      old_source: inOld ? "apps/admin/public/sai-ajantha-products.csv" : "",
      new_source: inNew ? `docs/SAI Ajantha Products (1).xlsx#Row${newItem._sourceRow}` : "",
      old_category: inOld ? oldItem.category : "",
      new_category: inNew ? newItem.Category : "",
      classification,
      changed_field_count: changedFieldCount,
      approval_required: classification !== "MATCHED_UNCHANGED" ? "YES" : "NO",
      blocking_reasons: blockingReasons.join("; ")
    });
  }

  console.log(`\nReconciliation Classifications:`);
  console.log(`- MATCHED_CHANGED:          ${matchedChangedCount}`);
  console.log(`- MATCHED_UNCHANGED:        ${matchedUnchangedCount}`);
  console.log(`- BLOCKED_NEEDS_REVIEW:     ${blockedNeedsReviewCount}`);
  console.log(`- OLD_ONLY_RETAIN:          ${oldOnlyCount}`);
  console.log(`- NEW_ONLY_PROPOSED_DRAFT:  ${newOnlyCount}`);
  console.log(`- Total Field Diffs:        ${fieldDiffs.length}`);

  // 7. Write Deliverable Files
  console.log("\nGenerating Deliverable Files...");

  // A. PRODUCT_SKU_MERGE_ROW_RECONCILIATION.csv
  const rowCsvHeaders = [
    "canonical_sku", "old_sku_raw", "new_sku_raw", "medusa_product_id",
    "variant_id", "old_source", "new_source", "old_category", "new_category",
    "classification", "changed_field_count", "approval_required", "blocking_reasons"
  ];
  const rowCsvRows = [rowCsvHeaders.join(",")];
  for (const r of rowReconciliation) {
    const rowVals = rowCsvHeaders.map(h => {
      let v = String(r[h] || "");
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        v = `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    });
    rowCsvRows.push(rowVals.join(","));
  }
  fs.writeFileSync("PRODUCT_SKU_MERGE_ROW_RECONCILIATION.csv", rowCsvRows.join("\n"), "utf8");
  console.log("Saved: PRODUCT_SKU_MERGE_ROW_RECONCILIATION.csv");

  // B. PRODUCT_SKU_MERGE_FIELD_DIFFS.csv
  const diffCsvHeaders = [
    "canonical_sku", "field_name", "old_raw_value", "new_raw_value",
    "proposed_action", "sensitivity", "reason", "approval_status"
  ];
  const diffCsvRows = [diffCsvHeaders.join(",")];
  for (const d of fieldDiffs) {
    const rowVals = diffCsvHeaders.map(h => {
      let v = String(d[h] || "");
      if (v.includes(",") || v.includes('"') || v.includes("\n")) {
        v = `"${v.replace(/"/g, '""')}"`;
      }
      return v;
    });
    diffCsvRows.push(rowVals.join(","));
  }
  fs.writeFileSync("PRODUCT_SKU_MERGE_FIELD_DIFFS.csv", diffCsvRows.join("\n"), "utf8");
  console.log("Saved: PRODUCT_SKU_MERGE_FIELD_DIFFS.csv");

  // C. Output Summary Statistics to console
  console.log("\nAudit run completed successfully.");
}

run().catch(console.error);

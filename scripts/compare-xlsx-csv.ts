import fs from "fs";
import { parseCsvContent, parseXlsxContent } from "../apps/backend/src/services/import-parser.service.ts";

const csvText = fs.readFileSync("apps/admin/public/sai-ajantha-products.csv", "utf8");
const csvRows = parseCsvContent(csvText);
const csvHeader = csvRows[0];
const csvSkuIdx = csvHeader.findIndex((h) => h.toLowerCase().includes("sku"));
const csvNameIdx = csvHeader.findIndex((h) => h.toLowerCase().includes("product name") || h.toLowerCase().includes("title"));
const csvCatIdx = csvHeader.findIndex((h) => h.toLowerCase().includes("category"));

const csvSkus = new Set<string>();
const csvProductMap = new Map<string, { name: string; category: string; rowNum: number }>();

for (let i = 1; i < csvRows.length; i++) {
  const r = csvRows[i];
  const sku = (r[csvSkuIdx] || "").trim();
  if (sku) {
    csvSkus.add(sku);
    csvProductMap.set(sku, { name: r[csvNameIdx] || "", category: r[csvCatIdx] || "", rowNum: i + 1 });
  }
}

console.log(`Total rows in CSV: ${csvRows.length - 1}`);
console.log(`Unique SKUs in CSV: ${csvSkus.size}`);

// Now inspect XLSX
const xlsxBuffer = fs.readFileSync("apps/storefront/Sai_Ajantha_Product_Input_Workbook.xlsx");
const sheets = parseXlsxContent(xlsxBuffer);

const xlsxAllRows: Array<{
  sheetIndex: number;
  sheetName: string;
  excelRow: number;
  sku: string;
  name: string;
  classification: string;
  reason: string;
  matchesCsv: boolean;
}> = [];

for (let s = 1; s < sheets.length; s++) {
  const sheet = sheets[s];
  let headerIdx = -1;
  for (let r = 0; r < Math.min(6, sheet.rows.length); r++) {
    const rowStr = sheet.rows[r].join(" ").toLowerCase();
    if (rowStr.includes("sku") || rowStr.includes("product code") || rowStr.includes("product name")) {
      headerIdx = r;
      break;
    }
  }

  if (headerIdx === -1) continue;
  const headers = sheet.rows[headerIdx];
  const skuCol = headers.findIndex((h) => h.toLowerCase().includes("sku") || h.toLowerCase().includes("product code"));
  const nameCol = headers.findIndex((h) => h.toLowerCase().includes("product name") || h.toLowerCase().includes("title"));

  for (let r = headerIdx + 1; r < sheet.rows.length; r++) {
    const row = sheet.rows[r];
    const excelRow = r + 1; // 1-indexed Excel row
    const sku = (skuCol >= 0 ? row[skuCol] : row[1] || "").trim();
    const name = (nameCol >= 0 ? row[nameCol] : row[2] || "").trim();

    let classification = "REAL_CANDIDATE";
    let reason = "Valid product candidate";

    if (!sku && !name) {
      classification = "BLANK";
      reason = "Empty row within worksheet bounds";
    } else if (!sku && name) {
      classification = "EMPTY_TEMPLATE";
      reason = "Product title present but SKU is missing/empty template";
    } else if (sku.startsWith("DEMO-") || name.toLowerCase().includes("demo") || name.toLowerCase().includes("sample")) {
      classification = "SAMPLE";
      reason = "Row 5 illustrative DEMO training row";
    } else if (csvSkus.has(sku)) {
      classification = "REAL_CANDIDATE";
      reason = "Verified SKU matches source CSV";
    } else {
      classification = "NEEDS_REVIEW";
      reason = "SKU present in XLSX but missing from CSV";
    }

    const matchesCsv = csvSkus.has(sku);
    xlsxAllRows.push({
      sheetIndex: s + 1,
      sheetName: sheet.sheetName,
      excelRow,
      sku,
      name,
      classification,
      reason,
      matchesCsv,
    });
  }
}

const breakdown: Record<string, number> = {};
for (const r of xlsxAllRows) {
  breakdown[r.classification] = (breakdown[r.classification] || 0) + 1;
}

console.log("\n--- XLSX Row Classification Breakdown ---");
console.table(breakdown);

const needsReview = xlsxAllRows.filter((r) => r.classification === "NEEDS_REVIEW");
console.log(`\nRows in XLSX that are NEEDS_REVIEW (SKU in XLSX but NOT in CSV): ${needsReview.length}`);
for (const r of needsReview) {
  console.log(`  Sheet ${r.sheetIndex} (${r.sheetName}) Row ${r.excelRow}: SKU="${r.sku}", Name="${r.name}"`);
}

const inCsvNotInXlsx = Array.from(csvSkus).filter((sku) => !xlsxAllRows.some((r) => r.sku === sku));
console.log(`\nSKUs in CSV but NOT found in XLSX: ${inCsvNotInXlsx.length}`);
for (const sku of inCsvNotInXlsx) {
  const item = csvProductMap.get(sku);
  console.log(`  CSV Row ${item?.rowNum}: SKU="${sku}", Name="${item?.name}", Category="${item?.category}"`);
}

const emptyTemplates = xlsxAllRows.filter((r) => r.classification === "EMPTY_TEMPLATE");
console.log(`\nEmpty Template Rows (Placeholder name without SKU): ${emptyTemplates.length}`);
for (const r of emptyTemplates) {
  console.log(`  Sheet ${r.sheetIndex} (${r.sheetName}) Row ${r.excelRow}: name="${r.name}"`);
}

const blankRowsBySheet: Record<string, number> = {};
for (const r of xlsxAllRows.filter((r) => r.classification === "BLANK")) {
  blankRowsBySheet[r.sheetName] = (blankRowsBySheet[r.sheetName] || 0) + 1;
}
console.log("\nBlank Rows within Table Bounds by Sheet:");
console.table(blankRowsBySheet);

